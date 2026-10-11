export type VoiceState = "idle" | "listening" | "preparing" | "speaking";

export interface VoiceTurn {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly timestamp: number;
}

export interface VoiceMetrics {
  audioLevel: number;
  latencyMs: number;
  phraseCount: number;
  currentTurnId: string | null;
}

export interface VoiceDiagnosticsData {
  microphonePermission: "granted" | "denied" | "prompt" | "unsupported";
  availableMicrophones: { deviceId: string; label: string }[];
  selectedMicrophoneId: string;
  isWorkerReady: boolean;
  workerType: "electron-worker" | "web-fallback";
  sttModelLoaded: boolean;
  vadActive: boolean;
  backendOnline: boolean;
}

export interface ElectronVoiceBridge {
  init(config?: { sampleRate?: number }): Promise<{ ok: boolean; workerReady: boolean }>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  sendAudioChunk(pcmBuffer: ArrayBuffer | ArrayBufferLike): void;
  synthesizeSpeech(text: string, options?: { voice?: string; rate?: number }): Promise<ArrayBuffer | null>;
  cancelSpeech(): Promise<void>;
  on(event: string, callback: (...args: any[]) => void): () => void;
  getDiagnostics(): Promise<Partial<VoiceDiagnosticsData>>;
}

declare global {
  interface Window {
    electronVoiceBridge?: ElectronVoiceBridge;
  }
}
