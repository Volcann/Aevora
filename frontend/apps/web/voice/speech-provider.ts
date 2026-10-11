/**
 * SpeechProvider
 * Handles speech recognition and voice discovery.
 * Uses Electron local speech worker when available (Vosk + Silero VAD),
 * and transparently falls back to browser Web Speech Recognition in standard browsers.
 */

export interface SpeechRecognitionCallbacks {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: Error) => void;
}

export class SpeechProvider {
  private callbacks: SpeechRecognitionCallbacks;
  private isListening = false;
  private bridgeCleanup: (() => void) | null = null;
  private webRecognition: any = null;

  constructor(callbacks: SpeechRecognitionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: SpeechRecognitionCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(): Promise<void> {
    if (this.isListening) return;

    if (typeof window !== "undefined" && window.electronVoiceBridge) {
      try {
        await window.electronVoiceBridge.startListening();

        const removePartial = window.electronVoiceBridge.on("vosk:partial", (text: string) => {
          this.callbacks.onPartial?.(text);
        });

        const removeFinal = window.electronVoiceBridge.on("vosk:final", (text: string) => {
          this.callbacks.onFinal?.(text);
        });

        const removeSpeechStart = window.electronVoiceBridge.on("vad:speech-start", () => {
          this.callbacks.onSpeechStart?.();
        });

        const removeSpeechEnd = window.electronVoiceBridge.on("vad:speech-end", () => {
          this.callbacks.onSpeechEnd?.();
        });

        this.bridgeCleanup = () => {
          removePartial();
          removeFinal();
          removeSpeechStart();
          removeSpeechEnd();
        };

        this.isListening = true;
        return;
      } catch (err) {
        console.warn("Electron speech worker start failed, falling back to Web Speech:", err);
      }
    }

    // Web Speech fallback
    this.startWebSpeech();
  }

  public feedPcmChunk(pcmData: Int16Array) {
    if (this.isListening && typeof window !== "undefined" && window.electronVoiceBridge) {
      // Send PCM buffer to Electron speech worker
      window.electronVoiceBridge.sendAudioChunk(pcmData.buffer);
    }
  }

  private startWebSpeech() {
    if (typeof window === "undefined") return;

    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.callbacks.onError?.(
        new Error("Speech recognition is not supported in this browser. Please use text chat.")
      );
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript || "";
        if (item.isFinal) {
          finalTranscript += text;
        } else {
          interim += text;
        }
      }

      if (interim) {
        this.callbacks.onSpeechStart?.();
        this.callbacks.onPartial?.(interim);
      }
      if (finalTranscript) {
        this.callbacks.onFinal?.(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.callbacks.onError?.(new Error(`Recognition error: ${event.error}`));
    };

    this.webRecognition = recognition;
    this.isListening = true;

    try {
      recognition.start();
    } catch (e) {
      this.callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  public stop(): void {
    this.isListening = false;

    if (this.bridgeCleanup) {
      this.bridgeCleanup();
      this.bridgeCleanup = null;
    }

    if (typeof window !== "undefined" && window.electronVoiceBridge) {
      window.electronVoiceBridge.stopListening().catch(() => {});
    }

    if (this.webRecognition) {
      try {
        this.webRecognition.stop();
      } catch {}
      this.webRecognition = null;
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}
