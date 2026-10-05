import { createContext, useContext } from "react";

export type AppStatus = "starting" | "idle" | "loading" | "ready" | "recording" | "transcribing" | "error";

export interface VoxtralContextType {
  status: AppStatus;
  loadingProgress: number;
  loadingMessage: string;
  transcript: string;
  audioLevel: number;
  microphoneName: string;
  recognitionMs: number | null;
  error: string | null;
  loadModel: () => void;
  resetSession: () => void;
  cancelCapture: () => Promise<void>;
  startRecording: (preRoll?: Float32Array<ArrayBufferLike>) => Promise<void>;
  stopRecording: () => void;
  autoSend: boolean;
  setAutoSend: (value: boolean) => void;
  pauseMs: number;
  setPauseMs: (value: number) => void;
  sensitivity: number;
  setSensitivity: (value: number) => void;
}

export const VoxtralContext = createContext<VoxtralContextType | undefined>(
  undefined,
);

export const useVoxtral = () => {
  const context = useContext(VoxtralContext);
  if (context === undefined) {
    throw new Error("useVoxtral must be used within a VoxtralProvider");
  }
  return context;
};
