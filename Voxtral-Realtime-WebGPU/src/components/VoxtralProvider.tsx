import { turnPause } from "./turnTiming";
import { useState, useRef, useCallback } from "react";
import {
  BaseStreamer,
  VoxtralRealtimeForConditionalGeneration,
  VoxtralRealtimeProcessor,
  type ProgressInfo,
} from "@huggingface/transformers";
import { VoxtralContext, type AppStatus } from "./VoxtralContext";

import type { ReactNode } from "react";

const MODEL_ID = "onnx-community/Voxtral-Mini-4B-Realtime-2602-ONNX";
const SAMPLE_RATE = 16000;
const MODEL_FILE_COUNT = 3;
const CAPTURE_PROCESSOR_NAME = "capture-processor";
const CAPTURE_WORKLET_SOURCE = `
  class CaptureProcessor extends AudioWorkletProcessor {
    process(inputs) {
      const input = inputs[0];
      if (input.length > 0 && input[0].length > 0) {
        this.port.postMessage(input[0]);
      }
      return true;
    }
  }
  registerProcessor("capture-processor", CaptureProcessor);
`;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const VoxtralProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Ready to load model");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [autoSend, setAutoSend] = useState(false);
  const autoSendRef = useRef(false);
  autoSendRef.current = autoSend;
  const [pauseMs, setPauseMs] = useState(1000);
  const [sensitivity, setSensitivity] = useState(0.012);
  const silenceTimerRef = useRef<number | null>(null);

  const [audioLevel, setAudioLevel] = useState(0);
  const [microphoneName, setMicrophoneName] = useState("");
  const [recognitionMs, setRecognitionMs] = useState<number | null>(null);
  const speechStartedAt = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const transcriptionJob = useRef<Promise<void> | null>(null);
  const captureVersion = useRef(0);
  const modelRef = useRef<any>(null);
  const processorRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioBufferRef = useRef<Float32Array>(new Float32Array(0));
  const audioStorageRef = useRef<Float32Array>(new Float32Array(0));
  const isRecordingRef = useRef(false);
  const stopRequestedRef = useRef(false);

  const cleanupAudio = useCallback(() => {
    isRecordingRef.current = false;
    setAudioLevel(0);
    if (silenceTimerRef.current !== null) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }

    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  const appendAudio = useCallback((newSamples: Float32Array) => {
    if (newSamples.length === 0) {
      return;
    }

    const previousSamples = audioBufferRef.current;
    const needed = previousSamples.length + newSamples.length;
    // Grow occasionally instead of copying the full recording every 8 ms.
    if (audioStorageRef.current.length < needed) {
      const storage = new Float32Array(Math.max(needed, SAMPLE_RATE * 10, audioStorageRef.current.length * 2));
      storage.set(previousSamples);
      audioStorageRef.current = storage;
    } else if (previousSamples.buffer !== audioStorageRef.current.buffer) {
      audioStorageRef.current.set(previousSamples);
    }
    audioStorageRef.current.set(newSamples, previousSamples.length);
    audioBufferRef.current = audioStorageRef.current.subarray(0, needed);
  }, []);

  const loadModel = useCallback(async () => {
    if (status === "loading" || modelRef.current) {
      if (modelRef.current) setStatus("ready");
      return;
    }

    setStatus("loading");
    setLoadingProgress(0);
    setLoadingMessage("Preparing model download...");
    setError(null);

    try {
      const progressMap = new Map<string, number>();
      const progressCallback = (info: ProgressInfo) => {
        if (
          info.status !== "progress" ||
          !info.file.endsWith(".onnx_data") ||
          info.total === 0
        ) {
          return;
        }

        progressMap.set(info.file, info.loaded / info.total);

        const totalProgress = Array.from(progressMap.values()).reduce(
          (sum, value) => sum + value,
          0,
        );

        setLoadingMessage("Downloading model...");
        setLoadingProgress(
          Math.min((totalProgress / MODEL_FILE_COUNT) * 100, 100),
        );
      };

      const model =
        await VoxtralRealtimeForConditionalGeneration.from_pretrained(
          MODEL_ID,
          {
            dtype: {
              audio_encoder: "q4f16",
              embed_tokens: "q4f16",
              decoder_model_merged: "q4f16",
            },
            device: "webgpu",
            progress_callback: progressCallback,
          },
        );

      setLoadingMessage("Loading processor...");
      const processor =
        await VoxtralRealtimeProcessor.from_pretrained(MODEL_ID);

      modelRef.current = model;
      processorRef.current = processor;
      setLoadingProgress(100);
      setLoadingMessage("Model ready");
      setStatus("ready");
    } catch (error) {
      console.error("Failed to load model:", error);
      setError(getErrorMessage(error, "Failed to load model"));
      setLoadingMessage("Initialization failed");
      setStatus("error");
    }
  }, [status]);

  const runTranscription = useCallback(
    async (model: any, processor: any, version: number) => {
      const cancelled = () => version !== captureVersion.current;
      const runtimeProcessor = processor as any;
      const audio = () => audioBufferRef.current;
      const numSamplesFirst = runtimeProcessor.num_samples_first_audio_chunk;
      await waitUntil(
        () => audio().length >= numSamplesFirst || stopRequestedRef.current,
      );

      if (cancelled() || audio().length < numSamplesFirst) {
        cleanupAudio();
        setStatus(current => current === "error" ? current : "ready");
        return;
      }

      const firstChunkInputs = await runtimeProcessor(
        audio().subarray(0, numSamplesFirst),
        { is_streaming: true, is_first_audio_chunk: true },
      );

      const featureExtractor = runtimeProcessor.feature_extractor;
      const { hop_length, n_fft } = featureExtractor.config;
      const winHalf = Math.floor(n_fft / 2);
      const samplesPerTok = runtimeProcessor.audio_length_per_tok * hop_length;

      async function* inputFeaturesGenerator() {
        yield firstChunkInputs.input_features;

        let melFrameIdx = runtimeProcessor.num_mel_frames_first_audio_chunk;
        let startIdx = melFrameIdx * hop_length - winHalf;

        while (!cancelled()) {
          const endNeeded =
            startIdx + runtimeProcessor.num_samples_per_audio_chunk;

          await waitUntil(
            () => audio().length >= endNeeded || stopRequestedRef.current,
          );

          if (cancelled() || (stopRequestedRef.current && audio().length < endNeeded)) break;

          const availableSamples = audio().length;
          let batchEndSample = endNeeded;
          while (batchEndSample + samplesPerTok <= availableSamples && batchEndSample + samplesPerTok <= endNeeded + 2 * samplesPerTok) {
            batchEndSample += samplesPerTok;
          }

          const chunkInputs = await runtimeProcessor(
            audio().slice(startIdx, batchEndSample),
            { is_streaming: true, is_first_audio_chunk: false },
          );

          // Give the browser a task boundary to paint partial text and receive audio.
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          yield chunkInputs.input_features;

          melFrameIdx += chunkInputs.input_features.dims[2];
          startIdx = melFrameIdx * hop_length - winHalf;
        }
      }

      const tokenizer = runtimeProcessor.tokenizer;
      const specialIds = new Set(tokenizer.all_special_ids.map(BigInt));
      let tokenCache: bigint[] = [];
      let printLen = 0;
      let isPrompt = true;

      const flushDecodedText = () => {
        if (tokenCache.length === 0) {
          return;
        }

        const text = tokenizer.decode(tokenCache, {
          skip_special_tokens: true,
        });
        const printableText = text.slice(printLen);
        printLen = text.length;

        if (printableText.length > 0) {
          if (!transcriptRef.current && speechStartedAt.current !== null) setRecognitionMs(Math.round(performance.now() - speechStartedAt.current));
          transcriptRef.current += printableText;
          setTranscript(transcriptRef.current);
        }
      };

      const streamer = new (class extends BaseStreamer {
        put(value: bigint[][]) {
          if (cancelled()) {
            return;
          }

          if (isPrompt) {
            isPrompt = false;
            return;
          }

          const tokens = value[0];

          if (tokens.length === 1 && specialIds.has(tokens[0])) {
            return;
          }

          tokenCache = tokenCache.concat(tokens);
          flushDecodedText();
        }

        end() {
          if (cancelled()) {
            tokenCache = [];
            printLen = 0;
            isPrompt = true;
            return;
          }

          flushDecodedText();
          tokenCache = [];
          printLen = 0;
          isPrompt = true;
        }
      })();

      try {
        await (model as any).generate({
          input_ids: firstChunkInputs.input_ids,
          input_features: inputFeaturesGenerator(),
          max_new_tokens: 4096,
          streamer: streamer as any,
        });
      } catch (error) {
        if (!cancelled()) {
          console.error("Transcription error:", error);
          setError(getErrorMessage(error, "Transcription failed"));
          setStatus("error");
        }
      } finally {
        cleanupAudio();
        setStatus(current => current === "error" ? current : "ready");
      }
    },
    [cleanupAudio],
  );

  const startRecording = useCallback(async (preRoll: Float32Array<ArrayBufferLike> = new Float32Array(0)) => {
    const model = modelRef.current;
    const processor = processorRef.current;

    if (!model || !processor || isRecordingRef.current || transcriptionJob.current) {
      return;
    }

    const version = ++captureVersion.current;
    transcriptRef.current = "";
    setTranscript("");
    setError(null);
    speechStartedAt.current = preRoll.length ? performance.now() - preRoll.length / 16 : null;
    setRecognitionMs(null);
    audioBufferRef.current = new Float32Array(preRoll);
    isRecordingRef.current = true;
    stopRequestedRef.current = false;
    setStatus("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (version !== captureVersion.current) { stream.getTracks().forEach(t => t.stop()); return; }
      mediaStreamRef.current = stream;
      setMicrophoneName(stream.getAudioTracks()[0]?.label || "Micrófono predeterminado");

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;
      await Promise.race([
        audioContext.resume(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("El navegador no activó el audio. Detén la voz e inténtalo de nuevo; si persiste, abre la web en Chrome o Edge.")), 5000)),
      ]);
      if (version !== captureVersion.current) return;

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const silentGainNode = audioContext.createGain();
      silentGainNode.gain.value = 0;

      const workletBlob = new Blob([CAPTURE_WORKLET_SOURCE], {
        type: "application/javascript",
      });
      const workletUrl = URL.createObjectURL(workletBlob);
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      if (version !== captureVersion.current) return;
      const workletNode = new AudioWorkletNode(
        audioContext,
        CAPTURE_PROCESSOR_NAME,
      );
      let lastSamplesAt = Date.now();
      let lastMeterAt = 0;
      let receivedSamples = false;
      let heardSpeech = preRoll.length > 0;
      let lastVoiceAt = Date.now();
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (isRecordingRef.current) {
          const samples = new Float32Array(event.data);
          if (!receivedSamples) { receivedSamples = true; setStatus("recording"); }
          lastSamplesAt = Date.now();
          appendAudio(samples);
          let energy = 0;
          for (const sample of samples) energy += sample * sample;
          const rms = Math.sqrt(energy / samples.length);
          if (Date.now() - lastMeterAt > 100) { setAudioLevel(rms); lastMeterAt = Date.now(); }
          if (rms > sensitivity) { heardSpeech = true; lastVoiceAt = Date.now(); if (speechStartedAt.current === null) speechStartedAt.current = performance.now(); }
        }
      };

      sourceNode.connect(workletNode);
      workletNode.connect(silentGainNode);
      silentGainNode.connect(audioContext.destination);
      workletNodeRef.current = workletNode;

      silenceTimerRef.current = window.setInterval(() => {
        if (Date.now() - lastSamplesAt > 5000) {
          setError("No llegan muestras del micrófono. Comprueba el dispositivo y los permisos del navegador.");
          stopRequestedRef.current = true; cleanupAudio(); setStatus("error"); return;
        }
        const current = transcriptRef.current.trim();
        const elapsed = speechStartedAt.current === null ? 0 : performance.now() - speechStartedAt.current;
        const wait = turnPause(current, pauseMs, elapsed - (Date.now() - lastVoiceAt));
        if (autoSendRef.current && heardSpeech && transcriptRef.current.trim() && Date.now() - lastVoiceAt > wait) {
          // Flush delayed streaming tokens after the last spoken samples.
          appendAudio(new Float32Array(SAMPLE_RATE * 1.5));
          stopRequestedRef.current = true; cleanupAudio(); setStatus("transcribing");
        }
      }, 150);
      const job = runTranscription(model, processor, version);
      transcriptionJob.current = job;
      await job;
      if (transcriptionJob.current === job) transcriptionJob.current = null;
    } catch (error) {
      if (version !== captureVersion.current) return;
      console.error("Recording error:", error);
      setError(getErrorMessage(error, "Recording failed"));
      cleanupAudio();
      setStatus("error");
    }
  }, [appendAudio, cleanupAudio, runTranscription, pauseMs, sensitivity]);

  const stopRecording = useCallback(() => {
    if (stopRequestedRef.current || !isRecordingRef.current) return;
    if (speechStartedAt.current !== null) appendAudio(new Float32Array(SAMPLE_RATE * 1.5));
    setStatus("transcribing");
    stopRequestedRef.current = true;
    isRecordingRef.current = false;
    cleanupAudio();
  }, [appendAudio, cleanupAudio]);

  const resetSession = useCallback(() => {
    stopRequestedRef.current = false;
    audioBufferRef.current = new Float32Array(0);
    transcriptRef.current = "";
    setTranscript("");
    setError(null);
    setStatus("ready");
  }, []);

  const cancelCapture = useCallback(async () => {
    captureVersion.current += 1;
    stopRequestedRef.current = true;
    cleanupAudio();
    await transcriptionJob.current;
    resetSession();
  }, [cleanupAudio, resetSession]);

  return (
    <VoxtralContext.Provider
      value={{
        status,
        loadingProgress,
        loadingMessage,
        transcript,
        audioLevel, microphoneName, recognitionMs,
        error,
        loadModel,
        resetSession,
        cancelCapture,
        startRecording,
        stopRecording,
        autoSend, setAutoSend, pauseMs, setPauseMs, sensitivity, setSensitivity,
      }}
    >
      {children}
    </VoxtralContext.Provider>
  );
};

function waitUntil(condition: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (condition()) return resolve();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });
}
