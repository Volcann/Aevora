/**
 * ConversationController
 * Central orchestrator owning microphone state, turn detection,
 * recognition results, backend submissions, response buffering,
 * playback, and barge-in interruptions.
 */

import { AudioCapture } from "./audio-capture";
import { SpeechProvider } from "./speech-provider";
import { ResponseSpeechBuffer, type SpeakablePhrase } from "./response-speech-buffer";
import { PlaybackController } from "./playback-controller";
import type { VoiceState, VoiceTurn } from "./types";

export interface ConversationControllerOptions {
  onStateChange?: (state: VoiceState) => void;
  onTranscriptChange?: (partial: string) => void;
  onResponseChange?: (response: string) => void;
  onTurnCompleted?: (turn: VoiceTurn) => void;
  onAudioLevel?: (level: number) => void;
  onWordBoundary?: (word: string, charIndex: number) => void;
  onError?: (error: Error) => void;
  /** Function to send prompt to backend via unchanged streamChat endpoint */
  sendPrompt: (
    prompt: string,
    options: {
      signal: AbortSignal;
      onChunk: (chunk: string) => void;
      onDone: () => void;
    }
  ) => Promise<void> | void;
}

export class ConversationController {
  private state: VoiceState = "idle";
  private audioCapture: AudioCapture;
  private speechProvider: SpeechProvider;
  private responseBuffer: ResponseSpeechBuffer;
  private playbackController: PlaybackController;
  private options: ConversationControllerOptions;

  private turnCounter = 0;
  private currentTurnId = "";
  private currentTranscript = "";
  private currentResponse = "";
  private abortController: AbortController | null = null;
  private silenceTimerId: ReturnType<typeof setTimeout> | null = null;
  private readonly silenceThresholdMs = 650;
  private isContinuous = true;
  private isActiveSession = false;

  constructor(options: ConversationControllerOptions) {
    this.options = options;

    this.audioCapture = new AudioCapture({
      onAudioLevel: (level) => {
        this.options.onAudioLevel?.(level);
      },
      onPcmData: (pcm) => {
        this.speechProvider.feedPcmChunk(pcm);
      },
      onError: (err) => {
        this.handleError(err);
      },
    });

    this.playbackController = new PlaybackController({
      onStart: () => {
        this.setState("speaking");
      },
      onWord: (word, charIndex) => {
        this.options.onWordBoundary?.(word, charIndex);
      },
      onEnd: () => {
        if (this.isActiveSession && this.isContinuous) {
          this.setState("listening");
        } else {
          this.setState("idle");
        }
      },
      onError: (err) => {
        this.handleError(err);
      },
    });

    this.responseBuffer = new ResponseSpeechBuffer((phrase: SpeakablePhrase) => {
      this.playbackController.enqueuePhrase(phrase);
    });

    this.speechProvider = new SpeechProvider({
      onPartial: (text) => {
        this.handleUserSpeechDetected();
        this.currentTranscript = text;
        this.options.onTranscriptChange?.(text);
        this.resetSilenceTimer();
      },
      onFinal: (text) => {
        this.currentTranscript = text;
        this.options.onTranscriptChange?.(text);
        this.submitUserTurn(text);
      },
      onSpeechStart: () => {
        this.handleUserSpeechDetected();
      },
      onError: (err) => {
        this.handleError(err);
      },
    });
  }

  public async startSession(): Promise<void> {
    if (this.isActiveSession) return;
    this.isActiveSession = true;
    this.isContinuous = true;
    this.currentTurnId = this.nextTurnId();

    try {
      await this.audioCapture.start();
      await this.speechProvider.start();
      this.setState("listening");
    } catch (err) {
      this.stopSession();
      throw err;
    }
  }

  public stopSession(): void {
    this.isActiveSession = false;
    this.clearSilenceTimer();
    this.abortCurrentRequest();
    this.playbackController.interrupt();
    this.speechProvider.stop();
    this.audioCapture.stop();
    this.setState("idle");
    this.options.onAudioLevel?.(0);
  }

  /**
   * Barge-in interruption handler.
   * If new user speech is detected while the assistant is speaking or preparing,
   * immediately stops audible playback, invalidates pending stream, and captures new turn.
   */
  private handleUserSpeechDetected(): void {
    if (this.state === "speaking" || this.state === "preparing") {
      this.playbackController.interrupt();
      this.abortCurrentRequest();
      this.currentTurnId = this.nextTurnId();
      this.responseBuffer.reset(this.currentTurnId);
      this.setState("listening");
    }
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimerId = setTimeout(() => {
      this.silenceTimerId = null;
      if (this.currentTranscript.trim().length > 0 && this.state === "listening") {
        this.submitUserTurn(this.currentTranscript);
      }
    }, this.silenceThresholdMs);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimerId !== null) {
      clearTimeout(this.silenceTimerId);
      this.silenceTimerId = null;
    }
  }

  private submitUserTurn(transcript: string): void {
    const text = transcript.trim();
    if (!text || !this.isActiveSession) return;

    this.clearSilenceTimer();
    const turnId = this.currentTurnId;
    this.currentTranscript = "";
    this.currentResponse = "";
    this.options.onTranscriptChange?.("");
    this.setState("preparing");

    // Record user turn
    this.options.onTurnCompleted?.({
      id: `${turnId}-user`,
      role: "user",
      text,
      timestamp: Date.now(),
    });

    this.responseBuffer.reset(turnId);
    this.playbackController.setTurnId(turnId);

    const controller = new AbortController();
    this.abortController = controller;

    let responseAccumulator = "";

    try {
      this.options.sendPrompt(text, {
        signal: controller.signal,
        onChunk: (chunk: string) => {
          if (controller.signal.aborted) return;
          responseAccumulator += chunk;
          this.currentResponse = responseAccumulator;
          this.options.onResponseChange?.(responseAccumulator);

          // Stream chunks to speech buffer for early playback
          this.responseBuffer.appendChunk(chunk, turnId);
        },
        onDone: () => {
          if (controller.signal.aborted) return;
          this.responseBuffer.flush(turnId);

          if (responseAccumulator.trim()) {
            this.options.onTurnCompleted?.({
              id: `${turnId}-assistant`,
              role: "assistant",
              text: responseAccumulator,
              timestamp: Date.now(),
            });
          }

          if (!this.playbackController.getIsPlaying()) {
            if (this.isActiveSession && this.isContinuous) {
              this.setState("listening");
            } else {
              this.setState("idle");
            }
          }
        },
      });
    } catch (err) {
      this.handleError(err instanceof Error ? err : new Error(String(err)));
      this.setState(this.isActiveSession ? "listening" : "idle");
    }
  }

  private abortCurrentRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private nextTurnId(): string {
    return `turn-${Date.now()}-${++this.turnCounter}`;
  }

  private setState(newState: VoiceState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.options.onStateChange?.(newState);
    }
  }

  private handleError(error: Error): void {
    this.options.onError?.(error);
  }

  public getState(): VoiceState {
    return this.state;
  }

  public setVoiceName(name: string): void {
    this.playbackController.setVoiceName(name);
  }
}
