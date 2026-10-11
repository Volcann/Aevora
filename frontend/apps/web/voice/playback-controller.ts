/**
 * PlaybackController
 * Manages the audio output queue for spoken answers.
 * Plays phrases in order, generates audio ahead of playback where supported,
 * and executes instantaneous, coordinated interruption when new user speech occurs.
 */

import type { SpeakablePhrase } from "./response-speech-buffer";

export interface PlaybackControllerCallbacks {
  onStart?: (phrase: SpeakablePhrase) => void;
  onWord?: (word: string, charIndex: number) => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export class PlaybackController {
  private queue: SpeakablePhrase[] = [];
  private isPlaying = false;
  private currentTurnId: string = "";
  private generation = 0;
  private callbacks: PlaybackControllerCallbacks;
  private selectedVoiceName: string = "";
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private audioContext: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;

  constructor(callbacks: PlaybackControllerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: PlaybackControllerCallbacks) {
    this.callbacks = callbacks;
  }

  public setVoiceName(name: string) {
    this.selectedVoiceName = name;
  }

  public setTurnId(turnId: string) {
    this.currentTurnId = turnId;
    this.queue = [];
  }

  public enqueuePhrase(phrase: SpeakablePhrase) {
    if (phrase.turnId !== this.currentTurnId) return;
    this.queue.push(phrase);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.callbacks.onEnd?.();
      return;
    }

    const phrase = this.queue.shift();
    if (!phrase || phrase.turnId !== this.currentTurnId) {
      this.playNext();
      return;
    }

    this.isPlaying = true;
    const currentGen = this.generation;

    // Check if Electron native TTS audio bridge is available
    if (typeof window !== "undefined" && window.electronVoiceBridge?.synthesizeSpeech) {
      try {
        const audioBufferData = await window.electronVoiceBridge.synthesizeSpeech(phrase.text, {
          voice: this.selectedVoiceName,
        });

        if (currentGen !== this.generation || phrase.turnId !== this.currentTurnId) {
          return;
        }

        if (audioBufferData) {
          await this.playAudioBuffer(audioBufferData, phrase, currentGen);
          return;
        }
      } catch (err) {
        // Fall back to web speech synthesis
        console.warn("Electron native TTS fallback to Web SpeechSynthesis:", err);
      }
    }

    // Web SpeechSynthesis fallback
    this.playWebSpeech(phrase, currentGen);
  }

  private async playAudioBuffer(bufferData: ArrayBuffer, phrase: SpeakablePhrase, gen: number) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error("No AudioContext available");

      this.audioContext ??= new AudioCtx();
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const decoded = await this.audioContext.decodeAudioData(bufferData.slice(0));
      if (gen !== this.generation || phrase.turnId !== this.currentTurnId) return;

      const source = this.audioContext.createBufferSource();
      source.buffer = decoded;
      source.connect(this.audioContext.destination);
      this.activeSource = source;

      this.callbacks.onStart?.(phrase);

      source.onended = () => {
        if (gen !== this.generation) return;
        this.activeSource = null;
        this.playNext();
      };

      source.start(0);
    } catch {
      this.playWebSpeech(phrase, gen);
    }
  }

  private playWebSpeech(phrase: SpeakablePhrase, gen: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.isPlaying = false;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(phrase.text);
    this.activeUtterance = utterance;

    if (this.selectedVoiceName) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === this.selectedVoiceName);
      if (match) utterance.voice = match;
    }

    utterance.onstart = () => {
      if (gen !== this.generation) return;
      this.callbacks.onStart?.(phrase);
    };

    utterance.onboundary = (e) => {
      if (gen !== this.generation) return;
      if (e.name === "word") {
        const spokenWord = phrase.text
          .slice(e.charIndex, e.charIndex + (e.charLength || 8))
          .split(/\s+/)[0];
        if (spokenWord) {
          this.callbacks.onWord?.(spokenWord, e.charIndex);
        }
      }
    };

    utterance.onend = () => {
      if (gen !== this.generation) return;
      this.activeUtterance = null;
      this.playNext();
    };

    utterance.onerror = () => {
      if (gen !== this.generation) return;
      this.activeUtterance = null;
      this.playNext();
    };

    try {
      window.speechSynthesis.speak(utterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (err) {
      this.activeUtterance = null;
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      this.playNext();
    }
  }

  /**
   * Coordinated instantaneous interruption.
   * Cancels active playback, drains queued phrases, and invalidates in-flight callbacks.
   */
  public interrupt(): void {
    this.generation++;
    this.queue = [];
    this.isPlaying = false;

    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {}
      this.activeSource = null;
    }

    if (this.activeUtterance) {
      this.activeUtterance.onstart = null;
      this.activeUtterance.onboundary = null;
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }

    if (typeof window !== "undefined") {
      if (window.electronVoiceBridge?.cancelSpeech) {
        window.electronVoiceBridge.cancelSpeech().catch(() => {});
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
