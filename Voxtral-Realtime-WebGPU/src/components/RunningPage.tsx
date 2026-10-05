import { useEffect, useRef, useState } from "react";
import { useVoxtral } from "./VoxtralContext";
import "./chat.css";
import { MessageActions } from "./MessageActions";

import { speakPhrase, preparePhrase, monitorInterruption } from "./liveVoice";

import { CHAT_KEY, newChat, readChats, updateChat, type Message } from "./chatStore";

export const RunningPage = () => {
  const { autoSend, setAutoSend, audioLevel, microphoneName, status, loadModel, loadingProgress, transcript, startRecording, stopRecording, resetSession, cancelCapture, error, pauseMs, setPauseMs, sensitivity, setSensitivity, recognitionMs } = useVoxtral();
  const [store, setStore] = useState(readChats);
  const activeChat = store.chats.find(c => c.id === store.activeId)!;
  const messages = activeChat.messages;
  const chatId = activeChat.id;
  const setMessages = (update: Message[] | ((previous: Message[]) => Message[])) => {
    setStore(previous => ({ ...previous, chats: updateChat(previous.chats, chatId, update) }));
  };
  const switchingRef = useRef(false);
  const [switching, setSwitching] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<"fast" | "natural">("natural");
  const [showInfo, setShowInfo] = useState(false);
  const model = activeChat.model;
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const modelsRequest = useRef(false);
  const refreshModels = async () => {
    if (modelsRequest.current) return;
    modelsRequest.current = true; setModelsLoading(true);
    try {
      const response = await fetch("/api/models", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo consultar Ollama. Comprueba que el servicio esté iniciado y actualizado.");
      const data = await response.json();
      if (!Array.isArray(data.models) || !data.models.every((name: unknown) => typeof name === "string")) throw new Error("La lista de modelos recibida no es válida.");
      setModels(data.models); setModelsError(data.models.length ? null : "No hay modelos instalados en Ollama.");
    } catch (error) { setModelsError(error instanceof Error ? error.message : "No se pudieron consultar los modelos."); }
    finally { modelsRequest.current = false; setModelsLoading(false); }
  };
  useEffect(() => {
    void refreshModels();
    const refresh = () => { void refreshModels(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const setModel = (value: string) => {
    setStore(previous => ({ ...previous, chats: previous.chats.map(chat => chat.id === chatId ? { ...chat, model: value, updatedAt: Date.now() } : chat) }));
  };
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [draft, setDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [firstTextMs, setFirstTextMs] = useState<number | null>(null);
  const [voiceMs, setVoiceMs] = useState<number | null>(null);
  const turnRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState("PENSANDO");
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const stopBargeIn = useRef<(() => void) | null>(null);
  const isRecording = status === "recording";
  const text = transcript.trim();
  const isTranscribing = text === "Transcribiendo…" || text === "Transcribiendo...";

  const askPhi = async (typed?: string) => {
    const question = (typed ?? text).trim();
    if (switchingRef.current || !question || isTranscribing || isReplying) return;
    const command = question.toLowerCase();
    if (command.includes("nueva conversación")) { clearConversation(); return; }
    if (command.includes("voz natural")) { setVoiceMode("natural"); resetSession(); return; }
    if (command.includes("voz rápida")) { setVoiceMode("fast"); resetSession(); return; }
    if (turnRef.current) return;
    const controller = new AbortController();
    turnRef.current = controller;
    const signal = controller.signal;
    const useVoice = voiceEnabled;
    setDraft("");
    const userMessage: Message = { role: "user", content: question };
    const answerIndex = messages.length + 1;
    setMessages((current) => [...current, userMessage, { role: "assistant", content: "", heardContent: "" }]);
    setIsReplying(true); setPhase("PENSANDO"); resetSession();
    const startedAt = performance.now();
    setChatError(null); setFirstTextMs(null); setVoiceMs(null); setLatency(null);
    let answer = "";
    let phrase = "";
    let playback = Promise.resolve();
    let speechFailure: unknown = null;
    let firstAudio = true;
    let heard = "";
    let previousStarted = Promise.resolve();
    signal.addEventListener("abort", () => {
      setMessages(current => current.map((m, i) => i === answerIndex ? { ...m, heardContent: heard, interrupted: true } : m));
    }, { once: true });
    const enqueue = (value: string) => {
      const clean = value.trim();
      if (!clean || !useVoice) return;
      const waitForPrevious = previousStarted;
      let releaseNext!: () => void;
      previousStarted = new Promise<void>(resolve => { releaseNext = resolve; });
      // Una frase de adelanto: preparar N+1 solo cuando N ya empieza a sonar.
      const prepared = waitForPrevious.then(async () => {
        signal.throwIfAborted();
        if (voiceMode !== "natural") return { blob: undefined, ms: 0 };
        const started = performance.now();
        const blob = await preparePhrase(clean, signal);
        return { blob, ms: performance.now() - started };
      }).then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
      playback = playback.then(async () => {
        signal.throwIfAborted();
        const result = await prepared;
        if (result.error) throw result.error;
        signal.throwIfAborted();
        await speakPhrase(clean, voiceMode, signal, activeAudio, () => {
          setPhase("HABLANDO"); releaseNext();
          if (firstAudio) {
            setLatency(Math.round(performance.now() - startedAt));
            setVoiceMs(Math.round(result.value?.ms ?? 0)); firstAudio = false;
          }
        }, result.value?.blob);
        heard = [heard, clean].filter(Boolean).join(" ");
        setMessages(current => current.map((m, i) => i === answerIndex ? { ...m, heardContent: heard } : m));
      }).catch((error) => { speechFailure = error; }).finally(releaseNext);
    };
    try {
      const response = await fetch("/api/chat/stream", { method: "POST", signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.role === "assistant" ? (m.heardContent ?? m.content) + (m.interrupted ? " [Respuesta interrumpida; la siguiente frase pudo oírse parcialmente.]" : "") : m.content })).filter(m => m.content.trim()), message: question, model }) });
      if (!response.ok || !response.body) throw new Error("No se pudo obtener respuesta de Ollama.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        signal.throwIfAborted();
        buffer += decoder.decode(value, { stream: !done });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          if (!line.trim()) continue;
          const item = JSON.parse(line) as { text?: string; error?: string };
          if (item.error) throw new Error(item.error);
          if (!answer && item.text) setFirstTextMs(Math.round(performance.now() - startedAt));
          answer += item.text || ""; phrase += item.text || "";
          const visibleAnswer = answer;
          setMessages((current) => current.map((m, i) => i === answerIndex ? { ...m, content: visibleAnswer, ...(!useVoice ? { heardContent: visibleAnswer } : {}) } : m));
          const boundary = phrase.match(/^([\s\S]*?[.!?;](?:\s|$))/);
          if (boundary && boundary[1].trim().length >= 12) { enqueue(boundary[1]); phrase = phrase.slice(boundary[1].length); }
        }
        if (done) break;
      }
      enqueue(phrase); await playback;
      if (speechFailure) throw speechFailure;
    } catch (requestError) {
      if (!signal.aborted) { controller.abort(); setChatError(requestError instanceof Error ? requestError.message : "No se pudo completar la conversación."); }
    } finally {
      if (turnRef.current === controller) { turnRef.current = null; setIsReplying(false); }
    }
  };

  useEffect(() => () => {
    turnRef.current?.abort(); turnRef.current = null;
    stopBargeIn.current?.(); speechSynthesis.cancel(); activeAudio.current?.pause();
  }, []);

  const selectChat = async (id?: string, branchIndex?: number) => {
    if (switchingRef.current || id === store.activeId) return;
    switchingRef.current = true; setSwitching(true);
    setVoiceEnabled(false); setDraft(""); setSidebarOpen(false);
    stopBargeIn.current?.(); stopBargeIn.current = null;
    turnRef.current?.abort(); turnRef.current = null;
    speechSynthesis.cancel(); activeAudio.current?.pause(); activeAudio.current = null;
    setIsReplying(false);
    try {
      await cancelCapture();
      setStore(previous => {
        if (id) return { ...previous, activeId: id };
        const chat = newChat(model);
        if (branchIndex !== undefined) {
          chat.messages = messages.slice(0, branchIndex + 1).map(m => ({ ...m }));
          chat.title = `Rama · ${activeChat.title}`;
        }
        return { chats: [chat, ...previous.chats], activeId: chat.id };
      });
      setChatError(null); setLatency(null); setFirstTextMs(null); setVoiceMs(null);
    } finally { switchingRef.current = false; setSwitching(false); }
  };
  const clearConversation = () => { void selectChat(); };
  const stopVoice = async () => {
    if (switchingRef.current) return;
    switchingRef.current = true; setSwitching(true);
    setVoiceEnabled(false);
    stopBargeIn.current?.(); stopBargeIn.current = null;
    turnRef.current?.abort(); turnRef.current = null;
    speechSynthesis.cancel(); activeAudio.current?.pause(); setIsReplying(false);
    try { await cancelCapture(); }
    finally { switchingRef.current = false; setSwitching(false); }
  };
  const beginVoice = () => { setVoiceEnabled(true); setChatError(null); loadModel(); };
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, text]);

  const exportConversation = () => {
    const body = messages.map((item) => `${item.role === "user" ? "Tú" : "Asistente"}: ${item.content}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const link = document.createElement("a"); link.href = url; link.download = "conversacion.txt"; link.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!voiceEnabled || error || switching || status !== "ready" || isReplying || text) return;
    const timer = window.setTimeout(startRecording, 450);
    return () => window.clearTimeout(timer);
  }, [voiceEnabled, error, switching, isReplying, startRecording, status, text]);

  useEffect(() => {
    if (voiceEnabled && !error && status === "ready" && text && !isReplying) void askPhi();
  }, [voiceEnabled, isReplying, isTranscribing, status, text]);

  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(store)); }
    catch { setChatError("No se pudieron guardar los chats en este navegador. Exporta la conversación para conservarla."); }
  }, [store]);

  useEffect(() => {
    if (!voiceEnabled || !isReplying) return;
    let stopped = false;
    void monitorInterruption(activeAudio, (preRoll) => {
      if (stopped || switchingRef.current) return;
      turnRef.current?.abort();
      turnRef.current = null;
      window.speechSynthesis.cancel();
      activeAudio.current?.pause();
      activeAudio.current = null;
      stopBargeIn.current?.();
      setIsReplying(false);
      resetSession();
      void startRecording(preRoll);
    }, sensitivity).then((stop) => { if (stopped) stop(); else stopBargeIn.current = stop; }).catch(() => {
      if (!stopped) setChatError("No se pudo activar la interrupción por voz. Puedes continuar al terminar la respuesta.");
    });
    return () => { stopped = true; stopBargeIn.current?.(); stopBargeIn.current = null; };
  }, [voiceEnabled, isReplying, resetSession, startRecording, sensitivity]);

  return (
    <div className="chat-app">
      <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">Voz local <span>EN TU EQUIPO</span></div>
        <button className="new-chat" disabled={switching} onClick={() => void selectChat()}>＋ Nuevo chat</button>
        <p className="sidebar-label">Conversaciones</p>
        <nav aria-label="Conversaciones">
          {store.chats.map(chat => <button key={chat.id} disabled={switching} aria-current={chat.id === chatId ? "page" : undefined} onClick={() => void selectChat(chat.id)} className={chat.id === chatId ? "selected" : ""}>{chat.title}</button>)}
        </nav>
        <div className="sidebar-bottom"><span className="local-dot" /> Historial local y privado<p>Cada chat tiene su propio contexto.</p></div>
      </aside>
      <main className="chat-main">
        <header className="chat-header">
          <button className="mobile-menu" aria-label="Mostrar conversaciones" onClick={() => setSidebarOpen(v => !v)}>☰</button>
          <select value={model} onChange={e => setModel(e.target.value)} disabled={isReplying || switching} aria-label="Modelo de conversación">{!models.includes(model) && <option value={model}>{model} (guardado)</option>}{models.map(name => <option key={name} value={name}>{name}</option>)}</select>
          <button title="Actualizar modelos de Ollama" aria-label="Actualizar modelos de Ollama" disabled={modelsLoading} onClick={() => void refreshModels()}>{modelsLoading ? "…" : "↻"}</button>
          <span className="chat-title">{activeChat.title}</span>
          <button onClick={() => setShowInfo(v => !v)} aria-expanded={showInfo}>Ajustes</button>
        </header>
        {showInfo && <section className="chat-settings">
          <p><strong>Voxtral WebGPU</strong> · reconocimiento en vivo. <strong>{model}</strong> · conversación. <strong>Kokoro</strong> · voz natural.</p>
          <div><label>Voz <select disabled={isReplying} value={voiceMode} onChange={e => setVoiceMode(e.target.value as "fast" | "natural")}><option value="natural">Kokoro natural</option><option value="fast">Voz rápida</option></select></label>
          <label><input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} />Enviar automáticamente al hacer una pausa</label>
          <label>Pausa <input type="range" min="500" max="1800" step="100" value={pauseMs} onChange={e => setPauseMs(Number(e.target.value))} />{pauseMs} ms</label>
          <label>Sensibilidad <input type="range" min="0.004" max="0.03" step="0.002" value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} /></label>
          <button onClick={exportConversation} disabled={!messages.length}>Exportar chat</button></div>
          <p>Primer texto de voz: {recognitionMs ?? "—"} ms · Primer texto del modelo: {firstTextMs ?? "—"} ms · Preparar voz: {voiceMs ?? "—"} ms · Total hasta voz: {latency ?? "—"} ms</p>
        </section>}
        <section className="chat-history" aria-label="Mensajes">
          {!messages.length && !text ? <div className="welcome"><span className="welcome-mark">◌</span><h1>¿En qué estás pensando?</h1><p>Escribe una pregunta o inicia una conversación por voz.</p><div className="suggestions">{["Explícame un concepto", "Ayúdame a organizar una idea", "Comparemos dos opciones"].map(q => <button key={q} onClick={() => setDraft(q)}>{q}</button>)}</div></div> : <div className="messages">
            {messages.map((m, i) => <article className={`message ${m.role}`} key={`${chatId}-${i}`}><div className="message-label">{m.role === "user" ? "Tú" : model.split(":")[0]}</div><div className="message-content">{m.content || "Pensando…"}</div>{m.interrupted && <small>Respuesta interrumpida</small>}{m.role === "assistant" && m.content && !(isReplying && i === messages.length - 1) && <MessageActions text={m.content} disabled={switching || isReplying || voiceEnabled} onBranch={() => void selectChat(undefined, i)} onError={setChatError} />}</article>)}
            {voiceEnabled && text && <article className="message user partial"><div className="message-label">Tú · en vivo</div><div className="message-content">{text}</div></article>}
            <div ref={bottomRef} />
          </div>}
        </section>
        <div className="composer-area">
          {modelsError && <p role="alert" className="chat-error">{modelsError}</p>}
          {(chatError || (voiceEnabled && error)) && <p role="alert" className="chat-error">{chatError || error}</p>}
          {voiceEnabled && <div className="voice-status"><span className="local-dot" />{status === "loading" ? `Preparando Voxtral · ${Math.round(loadingProgress)} %` : isReplying ? phase === "HABLANDO" ? "Hablando · puedes interrumpirme" : "Pensando…" : status === "transcribing" ? "Terminando de transcribir…" : isRecording ? "Escuchando…" : error ? "No se pudo iniciar la voz" : "Preparando micrófono…"}{isRecording && <><meter aria-label="Nivel del micrófono" min="0" max="0.08" value={audioLevel} style={{width: 80, marginLeft: 8}} /><span style={{marginLeft: 8}}>{audioLevel > sensitivity ? "Voz detectada" : "Sin voz detectada"}</span></>}{isRecording && <button onClick={stopRecording}>Enviar turno</button>}</div>}
          {voiceEnabled && microphoneName && <p className="composer-note">Micrófono: {microphoneName}<br />{autoSend ? "Envío automático al hacer una pausa" : "Transcripción continua · pulsa Enviar turno para recibir una respuesta"}</p>}
          <form className="composer" onSubmit={e => { e.preventDefault(); if (!voiceEnabled && !isReplying && !switching) void askPhi(draft); }}>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} disabled={switching || voiceEnabled} aria-label="Tu pregunta" placeholder={voiceEnabled ? "Conversación por voz activa" : "Pregunta lo que quieras"} rows={2} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
            <div className="composer-actions"><span>{voiceEnabled ? "Voxtral + Kokoro" : "Enter para enviar · Shift + Enter para nueva línea"}</span><button type="button" className={voiceEnabled ? "voice-button active" : "voice-button"} disabled={switching || (!voiceEnabled && isReplying)} onClick={() => voiceEnabled ? void stopVoice() : beginVoice()}>{voiceEnabled ? "■ Detener voz" : "◉ Iniciar voz"}</button><button type="submit" className="send-button" aria-label="Enviar pregunta" disabled={!draft.trim() || isReplying || voiceEnabled || switching}>↑</button></div>
          </form>
          <p className="composer-note">Conversación local · El micrófono se activa solo al iniciar voz.</p>
        </div>
      </main>
    </div>
  );
};
