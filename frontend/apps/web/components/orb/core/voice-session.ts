import {
  GoogleSpeechRecognizer,
  GoogleSpeechSynthesizer,
  findBestMaleVoice,
  type GoogleVoiceOption,
} from "../../../lib/speech";
import type { OrbSignal, OrbState } from "./orb-model";

export interface VoicePromptOptions {
  onChunk?: (chunk: string) => void;
  onDone?: () => void;
  voiceMode?: boolean;
  /** Cancels only the current frontend request; the server contract is unchanged. */
  signal?: AbortSignal;
}
export type SendVoicePrompt = (prompt: string, options?: VoicePromptOptions) => Promise<void> | void;
export interface VoiceSessionOptions {
  onPrompt: SendVoicePrompt;
  onStopStreaming?: () => void;
}
export interface VoiceTurn { readonly id: string; readonly role: "user" | "assistant"; readonly text: string }
export interface VoiceSnapshot {
  readonly state: OrbState;
  readonly requesting: boolean;
  readonly transcript: string;
  readonly response: string;
  readonly error: string | null;
  readonly streaming: boolean;
  readonly continuous: boolean;
  readonly muted: boolean;
  readonly micMuted: boolean;
  readonly callActive: boolean;
  readonly startedAt: number | null;
  readonly turns: readonly VoiceTurn[];
  readonly voices: readonly GoogleVoiceOption[];
  readonly selectedVoice: string;
  readonly speechSupported: boolean;
  readonly recognitionSupported: boolean;
}
const INITIAL: VoiceSnapshot = Object.freeze({
  state: 0, requesting: false, transcript: "", response: "", error: null,
  streaming: false, continuous: false, muted: false, micMuted: false,
  callActive: false, startedAt: null, turns: [], voices: [], selectedVoice: "",
  speechSupported: false, recognitionSupported: false,
});
const CLAIM_EVENT = "aevora:voice-owner";
const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.name === "NotAllowedError") {
    return "Microphone permission was denied. Allow microphone access, then try again.";
  }
  return error instanceof Error ? error.message : String(error);
};

/**
 * One interruptible voice lifecycle. React reads semantic snapshots; audio frames
 * use a mutable signal so neither the chat nor the canvas re-renders at 60fps.
 * Construction is side-effect-free and attach/detach are Strict Mode safe.
 */
export class VoiceSession {
  readonly signal: { current: OrbSignal } = { current: { audio: 0, word: 0, wordAt: 0 } };
  private snapshot = INITIAL;
  private readonly listeners = new Set<() => void>();
  private options: VoiceSessionOptions = { onPrompt: () => undefined };
  private attached = false;
  private generation = 0;
  private readonly ownerId = `voice-${Math.random().toString(36).slice(2)}`;
  private channel: BroadcastChannel | null = null;
  private recognizer: GoogleSpeechRecognizer | null = null;
  private synthesizer: GoogleSpeechSynthesizer | null = null;
  private abortController: AbortController | null = null;
  private continuousTimer: ReturnType<typeof setTimeout> | null = null;

  readonly getSnapshot = (): VoiceSnapshot => this.snapshot;
  readonly getServerSnapshot = (): VoiceSnapshot => INITIAL;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  configure(options: VoiceSessionOptions): void { this.options = options; }
  private patch(patch: Partial<VoiceSnapshot>): void {
    if (!Object.keys(patch).some((key) => this.snapshot[key as keyof VoiceSnapshot] !== patch[key as keyof VoiceSnapshot])) return;
    this.snapshot = { ...this.snapshot, ...patch };
    if (this.attached) this.listeners.forEach((listener) => listener());
  }
  private readonly onClaim = (event: Event): void => {
    if ((event as CustomEvent<string>).detail !== this.ownerId) this.stop();
  };
  private readonly onRemoteClaim = (event: MessageEvent<unknown>): void => {
    if (typeof event.data === "string" && event.data !== this.ownerId) this.stop();
  };
  private claim(): void {
    window.dispatchEvent(new CustomEvent(CLAIM_EVENT, { detail: this.ownerId }));
    this.channel?.postMessage(this.ownerId);
  }
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.patch({
      recognitionSupported: new GoogleSpeechRecognizer().isSupported(),
      speechSupported: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    });
    this.refreshVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", this.refreshVoices);
    window.addEventListener(CLAIM_EVENT, this.onClaim);
    window.addEventListener("pagehide", this.stop);
    window.addEventListener("aevora:pet-hidden", this.stop);
    try {
      if (typeof window.BroadcastChannel === "function") {
        this.channel = new window.BroadcastChannel("aevora-voice-ownership");
        this.channel.addEventListener("message", this.onRemoteClaim);
      }
    } catch { /* Sandboxed browsers may disable cross-window messaging. */ }
  }
  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.stop();
    window.speechSynthesis?.removeEventListener("voiceschanged", this.refreshVoices);
    window.removeEventListener(CLAIM_EVENT, this.onClaim);
    window.removeEventListener("pagehide", this.stop);
    window.removeEventListener("aevora:pet-hidden", this.stop);
    this.channel?.removeEventListener("message", this.onRemoteClaim);
    this.channel?.close();
    this.channel = null;
    this.synthesizer?.dispose();
    this.synthesizer = null;
  }
  private readonly refreshVoices = (): void => {
    const available = window.speechSynthesis?.getVoices() ?? [];
    const best = findBestMaleVoice(available);
    let saved = this.snapshot.selectedVoice;
    try { saved ||= localStorage.getItem("aevora-voice-name") ?? ""; } catch { /* Optional preference. */ }
    const selected = available.find((voice) => voice.name === saved) ?? best;
    const voices = available.map((voice) => ({
      voice, name: voice.name, lang: voice.lang,
      isGoogle: /google/i.test(voice.name), isMale: voice === best,
    }));
    this.patch({ voices, selectedVoice: selected?.name ?? "" });
    if (selected) this.synthesizer?.setVoice(selected);
  };
  readonly selectVoice = (name: string): void => {
    const selected = this.snapshot.voices.find((voice) => voice.name === name);
    if (!selected) return;
    this.patch({ selectedVoice: name });
    this.synthesizer?.setVoice(selected.voice);
    try { localStorage.setItem("aevora-voice-name", name); } catch { /* Optional preference. */ }
  };
  readonly setContinuous = (enabled: boolean): void => {
    this.patch({ continuous: enabled });
    if (!enabled) this.clearTimer();
  };
  readonly setMuted = (muted: boolean): void => {
    this.patch({ muted });
    if (!muted) return;
    this.synthesizer?.cancel();
    this.signal.current.word = 0;
    if (this.snapshot.state === 3) {
      this.patch({ state: this.snapshot.streaming ? 2 : 0 });
      this.resumeConversation(this.generation);
    }
  };
  readonly setMicMuted = (micMuted: boolean): void => {
    this.patch({ micMuted });
    if (micMuted) {
      this.clearTimer();
      if (this.snapshot.state === 1 || this.snapshot.requesting) this.cancelTurn();
    } else if (this.snapshot.callActive && this.snapshot.state === 0 && !this.snapshot.streaming) {
      void this.startListening();
    }
  };
  private clearTimer(): void {
    if (this.continuousTimer !== null) clearTimeout(this.continuousTimer);
    this.continuousTimer = null;
  }
  private isCurrent(id: number): boolean { return this.attached && this.generation === id; }
  private resumeConversation(id: number): void {
    if (!this.isCurrent(id) || this.snapshot.streaming) return;
    this.patch({ state: 0 });
    if (!this.snapshot.continuous || this.snapshot.micMuted || this.snapshot.error) return;
    this.clearTimer();
    this.continuousTimer = setTimeout(() => {
      this.continuousTimer = null;
      if (this.isCurrent(id) && this.snapshot.continuous && !this.snapshot.micMuted) void this.startListening();
    }, 360);
  }
  /** Invalidate before calling browser APIs; abort/end can fire synchronously. */
  private cancelTurn(): void {
    const hadStream = this.snapshot.streaming;
    this.generation++;
    this.clearTimer();
    this.recognizer?.abort();
    this.recognizer = null;
    this.synthesizer?.cancel();
    this.abortController?.abort();
    this.abortController = null;
    this.signal.current.audio = 0;
    this.signal.current.word = 0;
    this.patch({ state: 0, requesting: false, streaming: false });
    if (hadStream) this.options.onStopStreaming?.();
  }
  readonly stop = (): void => {
    this.cancelTurn();
    this.patch({ callActive: false, startedAt: null, continuous: false, micMuted: false });
  };
  readonly endCall = (): void => { this.stop(); };
  readonly startCall = async (): Promise<void> => {
    if (!this.attached || this.snapshot.callActive) return;
    this.patch({ callActive: true, continuous: true, micMuted: false, turns: [], transcript: "", response: "", error: null });
    await this.startListening();
  };
  readonly startListening = async (): Promise<void> => {
    if (!this.attached || this.snapshot.requesting || this.snapshot.state === 1 || this.snapshot.micMuted) return;
    this.claim();
    this.cancelTurn();
    const id = ++this.generation;
    this.patch({ requesting: true, transcript: "", error: null });
    const fail = (error: unknown) => {
      if (!this.isCurrent(id)) return;
      this.patch({ error: errorMessage(error), state: 0, requesting: false, callActive: false, startedAt: null, continuous: false });
      this.signal.current.audio = 0;
    };
    const recognizer = new GoogleSpeechRecognizer({
      onStateChange: (listening) => {
        if (!this.isCurrent(id)) return;
        this.patch({ requesting: false, state: listening ? 1 : 0,
          ...(listening && this.snapshot.callActive && this.snapshot.startedAt === null ? { startedAt: Date.now() } : {}),
        });
        if (!listening) this.signal.current.audio = 0;
      },
      onInterim: (transcript) => { if (this.isCurrent(id)) this.patch({ transcript }); },
      onAudioLevel: (level) => { if (this.isCurrent(id)) this.signal.current.audio = level; },
      onFinal: (text) => { if (this.isCurrent(id)) void this.send(text); },
      onError: fail,
    });
    this.recognizer = recognizer;
    try {
      await recognizer.start();
      if (!this.isCurrent(id)) recognizer.abort();
    } catch (error) { fail(error); }
  };
  readonly stopListening = (): void => {
    const captured = this.recognizer?.stop() ?? "";
    if (captured.trim()) void this.send(captured);
    else { this.cancelTurn(); this.resumeConversation(this.generation); }
  };
  readonly interact = (): void => {
    if (this.snapshot.requesting) this.stop();
    else if (this.snapshot.state === 1) this.stopListening();
    else if (this.snapshot.micMuted) this.setMicMuted(false);
    else if (!this.snapshot.callActive) void this.startCall();
    else void this.startListening();
  };
  readonly send = async (text: string): Promise<void> => {
    const prompt = text.trim();
    if (!this.attached || !prompt) return;
    this.claim();
    this.cancelTurn();
    const id = ++this.generation;
    const abortController = new AbortController();
    this.abortController = abortController;
    const replyId = `${id}-assistant`;
    const turns: VoiceTurn[] = [...this.snapshot.turns.slice(-48), { id: `${id}-user`, role: "user", text: prompt }];
    this.patch({ transcript: prompt, response: "", error: null, state: 2, streaming: true, turns });
    let done = false;
    let playbackFailed = false;
    if (this.snapshot.speechSupported) {
      this.synthesizer ??= new GoogleSpeechSynthesizer();
      const voice = this.snapshot.voices.find((item) => item.name === this.snapshot.selectedVoice);
      if (voice) this.synthesizer.setVoice(voice.voice);
      this.synthesizer.setCallbacks({
        onStart: () => {
          if (!this.isCurrent(id)) return;
          this.patch({ state: 3 });
          this.signal.current.word = 0.25;
          this.signal.current.wordAt = Date.now();
        },
        onWord: (word) => {
          if (!this.isCurrent(id)) return;
          this.signal.current.word = Math.min(1, 0.35 + word.length * 0.055);
          this.signal.current.wordAt = Date.now();
        },
        onPause: () => { if (this.isCurrent(id)) this.patch({ state: this.snapshot.streaming ? 2 : 0 }); },
        onEnd: () => { this.resumeConversation(id); },
        onError: (error) => {
          if (!this.isCurrent(id)) return;
          playbackFailed = true;
          this.patch({ error: errorMessage(error), state: this.snapshot.streaming ? 2 : 0 });
        },
      });
      this.synthesizer.beginStream();
    }
    const finish = () => {
      if (done || !this.isCurrent(id)) return;
      done = true;
      this.patch({ streaming: false });
      if (!this.snapshot.response.trim()) this.patch({ error: "No response was returned. Check your connection or try text chat.", state: 0 });
      if (this.synthesizer && !this.snapshot.muted && !playbackFailed) this.synthesizer.flushStream();
      else this.resumeConversation(id);
    };
    try {
      const result = this.options.onPrompt(prompt, {
        voiceMode: true,
        signal: abortController.signal,
        onChunk: (chunk) => {
          if (done || !this.isCurrent(id)) return;
          const response = this.snapshot.response + chunk;
          this.patch({ response, turns: [...turns, { id: replyId, role: "assistant", text: response }] });
          if (!this.snapshot.muted && !playbackFailed) this.synthesizer?.enqueueStreamChunk(chunk);
        },
        onDone: finish,
      });
      if (result && typeof result.then === "function") { await result; finish(); }
    } catch (error) {
      if (!this.isCurrent(id)) return;
      this.cancelTurn();
      this.patch({ error: errorMessage(error), state: 0, streaming: false });
    }
  };
}
