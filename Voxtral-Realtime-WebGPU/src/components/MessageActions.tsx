import { useEffect, useRef, useState } from "react";
import { speakPhrase } from "./liveVoice";

export function MessageActions({ text, disabled, onBranch, onError }: {
  text: string; disabled: boolean; onBranch: () => void; onError: (error: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { controller.current?.abort(); clearTimeout(timer.current); }, []);
  useEffect(() => { if (disabled) { controller.current?.abort(); setReading(false); } }, [disabled]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2000); }
    catch { onError("No se pudo copiar el texto. Revisa el permiso del portapapeles."); }
  };
  const read = async () => {
    if (controller.current) { controller.current.abort(); controller.current = null; setReading(false); return; }
    window.dispatchEvent(new Event("stop-message-reading"));
    const current = new AbortController(); controller.current = current; setReading(true);
    try {
      const chunks = text.match(/[\s\S]{1,600}(?:\s|$)|[\s\S]{1,600}/g) || [];
      for (const chunk of chunks) await speakPhrase(chunk, "natural", current.signal, audio, () => {});
    } catch (error) { if (!current.signal.aborted) onError(error instanceof Error ? error.message : "No se pudo leer la respuesta."); }
    finally { if (controller.current === current) { controller.current = null; setReading(false); } }
  };
  useEffect(() => {
    const stop = () => { controller.current?.abort(); controller.current = null; setReading(false); };
    window.addEventListener("stop-message-reading", stop);
    return () => window.removeEventListener("stop-message-reading", stop);
  }, []);
  return <div className="message-actions">
    <button title={copied ? "Copiado" : "Copiar texto completo"} aria-label={copied ? "Copiado" : "Copiar texto completo"} onClick={() => void copy()}><svg viewBox="0 0 24 24"><rect x="8" y="3" width="12" height="14" rx="2"/><path d="M16 17v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3"/></svg>{copied && <span role="status">Copiado</span>}</button>
    <button title="Crear nueva rama desde aquí" aria-label="Crear nueva rama desde aquí" disabled={disabled} onClick={onBranch}><svg viewBox="0 0 24 24"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m0-4c8 0 12-1 12-6"/></svg></button>
    <button title={reading ? "Detener lectura" : "Leer en voz alta"} aria-label={reading ? "Detener lectura" : "Leer en voz alta"} aria-pressed={reading} disabled={disabled} onClick={() => void read()}><svg viewBox="0 0 24 24">{reading ? <rect x="5" y="5" width="14" height="14" rx="2"/> : <><path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>}</svg></button>
  </div>;
}
