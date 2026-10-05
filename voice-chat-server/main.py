import io
import json
import os
import queue
import threading
from contextlib import asynccontextmanager

import httpx
import numpy as np
import torch
import torchaudio
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

MODEL_CACHE = os.path.join(os.path.dirname(__file__), ".models")
os.environ.setdefault("HF_HOME", MODEL_CACHE)
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", os.path.join(MODEL_CACHE, "hub"))
os.environ.setdefault("PKUSEG_HOME", os.path.join(MODEL_CACHE, "pkuseg"))

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "phi3:latest")
SYSTEM_PROMPT = (
    "Eres un asistente útil que conversa en español claro y natural. "
    "Responde a la intención de la última pregunta desde la primera frase. "
    "Cuando alguien diga '¿sabes qué hace X?' o '¿puedes explicar X?', explica X directamente; "
    "no te limites a decir que sí ni describas tus propias capacidades. "
    "Por ejemplo: '¿Qué hace un arquitecto de datos?' pide explicar ese trabajo, "
    "no presentarte como una inteligencia artificial. "
    "Usa el historial de este chat para interpretar las preguntas de seguimiento. "
    "Conserva el tema, sus calificativos y las entidades mencionadas: después de hablar "
    "de arquitectos de datos, '¿qué herramientas usan para diseñar?' se refiere a datos, "
    "no a edificios. Acepta un cambio de tema cuando la nueva pregunta lo indique. "
    "Si falta un dato indispensable y el historial no lo aclara, haz una pregunta concreta. "
    "Da información específica y útil, con un ejemplo breve cuando ayude. "
    "Sé conciso sin omitir lo esencial; amplía cuando te pidan detalles o pasos. "
    "Usa frases fáciles de escuchar, sin Markdown, tablas ni emojis. "
    "Evita repetir saludos, reformular la pregunta y terminar siempre con '¿en qué puedo ayudarte?'. "
    "No inventes hechos, recuerdos ni acciones realizadas. Si no sabes algo, dilo con claridad. "
    "Trata las anotaciones de respuestas interrumpidas como metadatos, no como palabras del usuario."
)

tts_model = None
kokoro_pipeline = None
whisper_model = None
voxtral_model = None
voxtral_processor = None
VOXTRAL_PATH = os.path.join(
    MODEL_CACHE,
    "voxtral-cuda",
    "hub",
    "models--mistralai--Voxtral-Mini-4B-Realtime-2602",
    "snapshots",
    "2769294da9567371363522aac9bbcfdd19447add",
)


class ChatRequest(BaseModel):
    messages: list[dict[str, str]] = Field(default_factory=list)
    message: str = Field(min_length=1, max_length=4000)
    model: str | None = Field(default=None, max_length=100)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


def conversation_messages(request: ChatRequest):
    # Conserva turnos recientes dentro de un presupuesto acotado para 4096 tokens.
    history = []
    budget = max(0, 6500 - len(request.message))
    for item in reversed(request.messages):
        role, content = item.get("role"), item.get("content", "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        if len(content) > budget:
            break
        history.append({"role": role, "content": content})
        budget -= len(content)
        if len(history) >= 20:
            break
    history.reverse()
    while history and history[0]["role"] != "user":
        history.pop(0)
    return [{"role": "system", "content": SYSTEM_PROMPT}, *history,
            {"role": "user", "content": request.message}]


def get_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def get_tts_model():
    global tts_model
    if tts_model is None:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        tts_model = ChatterboxMultilingualTTS.from_pretrained(
            device=get_device(), t3_model="v3"
        )
    return tts_model


def get_kokoro_pipeline():
    global kokoro_pipeline
    if kokoro_pipeline is None:
        from kokoro import KPipeline
        kokoro_pipeline = KPipeline(lang_code="e")
    return kokoro_pipeline


def get_whisper():
    global whisper_model
    if whisper_model is None:
        from faster_whisper import WhisperModel
        whisper_model = WhisperModel(
            "small",
            device="cuda",
            compute_type="float16",
            download_root=os.path.join(MODEL_CACHE, "faster-whisper"),
            local_files_only=True,
        )
    return whisper_model


def get_voxtral():
    """Carga una vez el reconocimiento de voz nativo en CUDA."""
    global voxtral_model, voxtral_processor
    if voxtral_model is None or voxtral_processor is None:
        if not os.path.isdir(VOXTRAL_PATH):
            raise RuntimeError("No se encontró el modelo Voxtral CUDA local")

        from transformers import (
            VoxtralRealtimeForConditionalGeneration,
            VoxtralRealtimeProcessor,
        )

        voxtral_processor = VoxtralRealtimeProcessor.from_pretrained(VOXTRAL_PATH)
        voxtral_model = (
            VoxtralRealtimeForConditionalGeneration.from_pretrained(
                VOXTRAL_PATH, dtype=torch.bfloat16
            )
            .to(get_device())
            .eval()
        )
    return voxtral_model, voxtral_processor


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title="Voz local", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/models")
async def installed_models():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
        return {"models": sorted({item["name"] for item in response.json().get("models", [])})}
    except httpx.HTTPError as error:
        raise HTTPException(503, "No se pudo consultar los modelos de Ollama") from error


@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
            names = {model["name"] for model in response.json().get("models", [])}
    except httpx.HTTPError as error:
        raise HTTPException(503, "Ollama no está disponible") from error
    return {
        "ollama": "ready",
        "model": MODEL_NAME,
        "model_available": MODEL_NAME in names,
        "tts_device": get_device(),
        "tts_loaded": tts_model is not None,
        "voxtral_cuda_loaded": voxtral_model is not None,
    }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    model_name = request.model or MODEL_NAME
    messages = conversation_messages(request)
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": model_name,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "num_predict": 256,
                        "temperature": 0.4,
                        "num_ctx": 4096,
                    },
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise HTTPException(503, "No se pudo obtener una respuesta de Ollama") from error

    answer = response.json().get("message", {}).get("content", "").strip()
    if not answer:
        raise HTTPException(502, "Phi-3 no devolvió texto")
    return {"answer": answer}


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    async def events():
        messages = conversation_messages(request)
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json={
                    "model": request.model or MODEL_NAME, "messages": messages, "stream": True,
                    "options": {"num_ctx": 4096, "num_predict": 256, "temperature": 0.4},
                }) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        item = json.loads(line)
                        if item.get("error"):
                            raise RuntimeError(item["error"])
                        yield json.dumps({"text": item.get("message", {}).get("content", ""),
                                          "done": item.get("done", False)}) + "\n"
        except Exception:
            yield json.dumps({"error": "No se pudo completar la respuesta de Ollama"}) + "\n"
    return StreamingResponse(events(), media_type="application/x-ndjson")


@app.post("/api/stt/prepare")
async def prepare_voxtral():
    try:
        get_whisper()
    except Exception as error:
        raise HTTPException(500, f"No se pudo preparar Faster-Whisper CUDA: {error}") from error
    return {"status": "ready", "device": get_device()}


@app.post("/api/transcribe")
async def transcribe(request: Request):
    """Transcribe audio PCM float32 mono a 16 kHz enviado por la web."""
    raw_audio = await request.body()
    if len(raw_audio) < 16_000 * 4 // 4:
        return {"text": ""}
    if len(raw_audio) % 4:
        raise HTTPException(400, "El audio debe ser PCM float32")

    try:
        audio = np.frombuffer(raw_audio, dtype=np.float32).copy()
        segments, _ = get_whisper().transcribe(
            audio, language="es", beam_size=1, vad_filter=True
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
    except Exception as error:
        raise HTTPException(500, f"No se pudo transcribir el audio: {error}") from error
    return {"text": text}


@app.websocket("/api/transcribe/live")
async def transcribe_live(websocket: WebSocket):
    """Recibe PCM float32 y devuelve la transcripción parcial desde CUDA."""
    await websocket.accept()
    audio_chunks: queue.Queue[np.ndarray | None] = queue.Queue()
    loop = __import__("asyncio").get_running_loop()
    stopped = threading.Event()
    input_closed = threading.Event()

    def run_streaming():
        try:
            model, processor = get_voxtral()
            collected = np.empty(0, dtype=np.float32)

            def wait_for_samples(required: int) -> bool:
                nonlocal collected
                while len(collected) < required and not stopped.is_set():
                    chunk = audio_chunks.get()
                    if chunk is None:
                        input_closed.set()
                        return False
                    collected = np.concatenate((collected, chunk))
                return not stopped.is_set()

            first_size = processor.num_samples_first_audio_chunk
            if not wait_for_samples(first_size):
                return
            first = processor(
                collected[:first_size],
                is_streaming=True,
                is_first_audio_chunk=True,
                return_tensors="pt",
            )
            first["input_features"] = first["input_features"].to(
                get_device(), dtype=torch.bfloat16
            )
            first["input_ids"] = first["input_ids"].to(get_device())
            hop_length = processor.feature_extractor.hop_length
            n_fft = processor.feature_extractor.n_fft
            samples_per_token = processor.audio_length_per_tok * hop_length

            def input_features():
                yield first["input_features"]
                mel_frames = processor.num_mel_frames_first_audio_chunk
                start = mel_frames * hop_length - n_fft // 2
                while not stopped.is_set():
                    needed = start + processor.num_samples_per_audio_chunk
                    if not wait_for_samples(needed):
                        break
                    end = needed
                    while end + samples_per_token <= len(collected):
                        end += samples_per_token
                    inputs = processor(
                        collected[start:end],
                        is_streaming=True,
                        is_first_audio_chunk=False,
                        return_tensors="pt",
                    )
                    features = inputs["input_features"].to(
                        get_device(), dtype=torch.bfloat16
                    )
                    yield features
                    mel_frames += features.shape[-1]
                    start = mel_frames * hop_length - n_fft // 2

            from transformers.generation.streamers import BaseStreamer

            tokenizer = processor.tokenizer
            special_ids = set(tokenizer.all_special_ids)
            tokens: list[int] = []
            prompt = True
            last_text = ""

            class LiveStreamer(BaseStreamer):
                def put(self, value):
                    nonlocal prompt, last_text
                    if stopped.is_set():
                        return
                    if prompt:
                        prompt = False
                        return
                    next_tokens = value.tolist()
                    if next_tokens and isinstance(next_tokens[0], list):
                        next_tokens = next_tokens[0]
                    if len(next_tokens) == 1 and next_tokens[0] in special_ids:
                        return
                    tokens.extend(next_tokens)
                    text = tokenizer.decode(tokens, skip_special_tokens=True).strip()
                    if text and text != last_text:
                        last_text = text
                        __import__("asyncio").run_coroutine_threadsafe(
                            websocket.send_json({"text": text}), loop
                        )

                def end(self):
                    pass

            model.generate(
                input_ids=first["input_ids"],
                input_features=input_features(),
                max_new_tokens=4096,
                streamer=LiveStreamer(),
            )
        except Exception as error:
            __import__("asyncio").run_coroutine_threadsafe(
                websocket.send_json({"error": str(error)}), loop
            )
        finally:
            __import__("asyncio").run_coroutine_threadsafe(
                websocket.send_json({"done": True}), loop
            )

    worker = __import__("asyncio").create_task(__import__("asyncio").to_thread(run_streaming))
    try:
        while not worker.done():
            message = await websocket.receive()
            if message.get("bytes") is not None:
                raw = message["bytes"]
                if len(raw) % 4 == 0:
                    audio_chunks.put(np.frombuffer(raw, dtype=np.float32).copy())
            elif message.get("text") == "stop":
                # No cancelamos el modelo: solo indicamos que no llegarán más muestras.
                # Así puede emitir las últimas palabras del turno.
                audio_chunks.put(None)
    except WebSocketDisconnect:
        stopped.set()
        audio_chunks.put(None)
    finally:
        stopped.set()
        audio_chunks.put(None)
        await worker


@app.post("/api/speak")
async def speak(request: SpeakRequest):
    try:
        model = get_tts_model()
        waveform = model.generate(request.text, language_id="es")
        audio = io.BytesIO()
        torchaudio.save(audio, waveform.cpu(), model.sr, format="wav")
        audio.seek(0)
    except Exception as error:
        raise HTTPException(500, f"No se pudo generar la voz: {error}") from error
    return StreamingResponse(audio, media_type="audio/wav")


@app.post("/api/speak-kokoro")
async def speak_kokoro(request: SpeakRequest):
    try:
        chunks = [audio for _, _, audio in get_kokoro_pipeline()(request.text, voice="ef_dora", speed=1.05)]
        waveform = torch.from_numpy(np.concatenate(chunks)).unsqueeze(0)
        audio = io.BytesIO()
        torchaudio.save(audio, waveform, 24000, format="wav")
        audio.seek(0)
    except Exception as error:
        raise HTTPException(500, f"No se pudo generar la voz Kokoro: {error}") from error
    return StreamingResponse(audio, media_type="audio/wav")
