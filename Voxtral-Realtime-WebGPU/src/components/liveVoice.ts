type AudioRef = { current: HTMLAudioElement | null };

export async function preparePhrase(text: string, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  const response = await fetch("/api/speak-kokoro", { method: "POST", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!response.ok) throw new Error("No se pudo generar la voz natural.");
  const blob = await response.blob(); signal.throwIfAborted(); return blob;
}

export async function speakPhrase(text: string, mode: "fast" | "natural", signal: AbortSignal, active: AudioRef, onStart: () => void, prepared?: Blob) {
  signal.throwIfAborted();
  if (mode === "fast") {
    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith("es") && v.localService)
        || speechSynthesis.getVoices().find(v => v.lang.startsWith("es"));
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "es-ES"; utterance.rate = 1.04;
      const finish = (error?: unknown) => {
        signal.removeEventListener("abort", abort);
        utterance.onend = null; utterance.onerror = null;
        if (error) reject(error); else resolve();
      };
      const abort = () => { finish(new DOMException("Interrumpido", "AbortError")); speechSynthesis.cancel(); };
      utterance.onstart = onStart;
      utterance.onend = () => finish();
      utterance.onerror = e => finish(new Error(`No se pudo reproducir la voz: ${e.error}`));
      signal.addEventListener("abort", abort, { once: true });
      speechSynthesis.resume(); speechSynthesis.speak(utterance);
    });
    return;
  }
  const blob = prepared ?? await preparePhrase(text, signal); signal.throwIfAborted();
  const url = URL.createObjectURL(blob); const audio = new Audio(url); active.current = audio;
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => {
        signal.removeEventListener("abort", abort); audio.onended = null; audio.onerror = null;
        if (error) reject(error); else resolve();
      };
      const abort = () => { audio.pause(); finish(new DOMException("Interrumpido", "AbortError")); };
      audio.onended = () => finish(); audio.onerror = () => finish(new Error("No se pudo reproducir el audio."));
      audio.onplaying = onStart; signal.addEventListener("abort", abort, { once: true });
      void audio.play().catch(finish);
    });
  } finally { audio.pause(); URL.revokeObjectURL(url); if (active.current === audio) active.current = null; }
}

// Captura contigua: el pre-roll no repite ventanas del analizador.
export async function monitorInterruption(active: AudioRef, onSpeech: (audio: Float32Array) => void, sensitivity = 0.012): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const context = new AudioContext({ sampleRate: 16000 });
  let node: AudioWorkletNode | undefined;
  let stopped = false; let candidate = 0; let verifying = 0; let confirmed = 0; let cooldown = 0;
  let pausedAudio: HTMLAudioElement | null = null; let pausedSpeech = false;
  const voiceThreshold = Math.max(0.004, Math.min(sensitivity, 0.018));
  let noise = 0.001; let samples = 0; const ring: Float32Array[] = [];
  const resume = () => {
    if (pausedSpeech) speechSynthesis.resume();
    if (pausedAudio) void pausedAudio.play().catch(() => {});
    pausedSpeech = false; pausedAudio = null;
  };
  const stop = () => { if (stopped) return; stopped = true; resume(); node?.disconnect(); stream.getTracks().forEach(t => t.stop()); void context.close(); };
  try {
    await context.resume();
    const url = URL.createObjectURL(new Blob([`class Capture extends AudioWorkletProcessor { process(inputs) { if(inputs[0]?.[0]) this.port.postMessage(inputs[0][0]); return true; } } registerProcessor("interrupt-capture",Capture);`], { type: "application/javascript" }));
    try { await context.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    node = new AudioWorkletNode(context, "interrupt-capture");
    const source = context.createMediaStreamSource(stream); const mute = context.createGain(); mute.gain.value = 0;
    source.connect(node); node.connect(mute); mute.connect(context.destination);
    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (stopped) return;
      const chunk = new Float32Array(event.data); const now = performance.now();
      ring.push(chunk); samples += chunk.length;
      while (samples > 12800 && ring.length > 1) samples -= ring.shift()!.length;
      const rms = Math.sqrt(chunk.reduce((sum, x) => sum + x*x, 0) / chunk.length);
      if (verifying) {
        // Dejar decaer el sonido del altavoz antes de medir voz persistente.
        if (now - verifying > 80) confirmed = rms > Math.max(voiceThreshold * 0.65, Math.min(noise * 1.8, voiceThreshold)) ? confirmed + chunk.length / 16 : Math.max(0, confirmed - 8);
        if (confirmed >= 64) {
          const audio = new Float32Array(samples); let offset = 0;
          for (const c of ring) { audio.set(c, offset); offset += c.length; }
          pausedSpeech = false; pausedAudio = null; stop(); onSpeech(audio); return;
        }
        if (now - verifying > 350) { verifying = 0; candidate = 0; cooldown = now + 180; resume(); }
        return;
      }
      if (now < cooldown) return;
      const threshold = Math.max(voiceThreshold, Math.min(noise * 2.5, voiceThreshold * 1.5));
      if (rms > threshold) {
        candidate += chunk.length / 16;
        if (candidate >= 80) {
          pausedSpeech = speechSynthesis.speaking && !speechSynthesis.paused;
          if (pausedSpeech) speechSynthesis.pause();
          if (active.current && !active.current.paused) { pausedAudio = active.current; pausedAudio.pause(); }
          verifying = now; confirmed = 0;
        }
      } else { candidate = Math.max(0, candidate - 16); noise = noise * 0.99 + Math.min(rms, voiceThreshold / 2) * 0.01; }
    };
    return stop;
  } catch (error) { stop(); throw error; }
}
