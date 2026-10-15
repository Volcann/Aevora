"use client";

/** Browser speech and microphone adapters. No server endpoints or credentials.
 * Availability and voices depend on the browser/native webview and installed OS.
 * Input energy is measured with Web Audio; output animation uses speech events.
 */

export interface GoogleVoiceOption {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
  isGoogle: boolean;
  isMale?: boolean;
}

/**
 * Legacy voice preference heuristic; installed voice names are not standardized.
 */
export function findBestMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const englishVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith("en")
  );
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  // 1. Explicit Google Male voice (e.g. "Google UK English Male")
  const googleMale = pool.find(
    (v) => v.name.toLowerCase().includes("google") && /\bmale\b/i.test(v.name)
  );
  if (googleMale) return googleMale;

  // 2. Any English voice with "male" in its name
  const explicitMale = pool.find((v) => /\bmale\b/i.test(v.name));
  if (explicitMale) return explicitMale;

  // 3. Recognized male voices in common browser/OS voice packages
  const maleNamesRegex = /\b(david|guy|mark|daniel|alex|george|james|fred|oliver|tom|aaron|ryan|brian|christopher|matthew|thomas|paul|andrew|charles|edward|michael|william|richard|arthur|josh|steffan|lee|gordon|alva|stefan)\b/i;
  const namedMale = pool.find((v) => maleNamesRegex.test(v.name));
  if (namedMale) return namedMale;

  // 4. Any voice that does NOT contain recognized female names
  const femaleNamesRegex = /\b(female|zira|eva|jenny|samantha|victoria|karen|susan|fiona|helen|linda|stephanie|catherine|aria|michelle|hazel|hazell|alice|serena|clara|ayumi|kyoko|yuna)\b/i;
  const nonFemale = pool.find((v) => !femaleNamesRegex.test(v.name));
  if (nonFemale) return nonFemale;

  return pool[0];
}

interface IWindowSpeech {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
  webkitAudioContext?: typeof AudioContext;
}

let sharedAudioCtx: AudioContext | null = null;

/**
 * Returns a shared, resilient AudioContext singleton to prevent
 * "The number of hardware contexts provided (6) is already at maximum" browser limit.
 */
export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as IWindowSpeech;
  const AudioCtx = window.AudioContext || win.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

interface ISpeechRecognitionItem {
  transcript: string;
}

interface ISpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: ISpeechRecognitionItem;
}

interface ISpeechRecognitionResultList {
  length: number;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent {
  error: string;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser-provided Text-to-Speech (TTS)
// ─────────────────────────────────────────────────────────────────────────────

export class GoogleSpeechSynthesizer {
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private queue: string[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private isStreamActive = false;
  private buffer = "";
  private onWordCallback: ((word: string, charIndex: number) => void) | null = null;
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onPauseCallback: (() => void) | null = null;
  private generation = 0;
  private readonly handleVoicesChanged = () => this.initVoices();
  private rate = 1.0;
  private pitch = 1.0;

  // Speak complete replies; never cut a sentence at an arbitrary word count.
  private maxSentences = Number.POSITIVE_INFINITY;
  private spokenSentencesCount = 0;
  private totalSpokenWords = 0;
  private maxSpokenWords = Number.POSITIVE_INFINITY;

  // Protect against Chrome V8 Garbage Collection bug during active speech
  private activeUtterances: Set<SpeechSynthesisUtterance> = new Set();

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.initVoices();
      window.speechSynthesis.addEventListener("voiceschanged", this.handleVoicesChanged);
    }
  }

  private initVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    this.voices = window.speechSynthesis.getVoices();
    const selected = this.voices.find((voice) => voice.name === this.selectedVoice?.name);
    if (selected) this.selectedVoice = selected;
    else this.selectDefaultMaleVoice();
  }

  public getAvailableVoices(): GoogleVoiceOption[] {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    if (this.voices.length === 0) {
      this.voices = window.speechSynthesis.getVoices();
    }

    const englishVoices = this.voices.filter((v) =>
      v.lang.toLowerCase().startsWith("en")
    );

    const bestMale = findBestMaleVoice(this.voices);

    const list = (englishVoices.length > 0 ? englishVoices : this.voices).map((v) => ({
      voice: v,
      name: v.name,
      lang: v.lang,
      isGoogle: v.name.toLowerCase().includes("google"),
      isMale: bestMale?.name === v.name || /\bmale\b/i.test(v.name),
    }));

    return list.sort((a, b) => {
      if (a.voice === bestMale && b.voice !== bestMale) return -1;
      if (a.voice !== bestMale && b.voice === bestMale) return 1;
      if (a.isMale && !b.isMale) return -1;
      if (!a.isMale && b.isMale) return 1;
      if (a.isGoogle && !b.isGoogle) return -1;
      if (!a.isGoogle && b.isGoogle) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public setVoice(voice: SpeechSynthesisVoice) {
    this.selectedVoice = voice;
  }

  public setVoiceByName(name: string) {
    const v = this.voices.find((item) => item.name === name);
    if (v) this.selectedVoice = v;
  }

  public setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  public setPitch(pitch: number) {
    this.pitch = Math.max(0.5, Math.min(1.5, pitch));
  }

  public selectDefaultMaleVoice(): GoogleVoiceOption | null {
    if (this.voices.length === 0 && typeof window !== "undefined" && "speechSynthesis" in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
    const maleVoice = findBestMaleVoice(this.voices);
    if (maleVoice) {
      this.selectedVoice = maleVoice;
      this.pitch = 1.0;
      return {
        voice: maleVoice,
        name: maleVoice.name,
        lang: maleVoice.lang,
        isGoogle: maleVoice.name.toLowerCase().includes("google"),
        isMale: true,
      };
    }
    return null;
  }

  public getDefaultMaleVoice(): GoogleVoiceOption | null {
    if (!this.selectedVoice) {
      return this.selectDefaultMaleVoice();
    }
    return {
      voice: this.selectedVoice,
      name: this.selectedVoice.name,
      lang: this.selectedVoice.lang,
      isGoogle: this.selectedVoice.name.toLowerCase().includes("google"),
      isMale: true,
    };
  }

  public selectDefaultGoogleVoice(): GoogleVoiceOption | null {
    return this.selectDefaultMaleVoice();
  }

  public setCallbacks(callbacks: {
    onWord?: (word: string, charIndex: number) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onPause?: () => void;
    onError?: (error: Error) => void;
  }) {
    if (callbacks.onWord !== undefined) this.onWordCallback = callbacks.onWord;
    if (callbacks.onStart !== undefined) this.onStartCallback = callbacks.onStart;
    if (callbacks.onEnd !== undefined) this.onEndCallback = callbacks.onEnd;
    if (callbacks.onPause !== undefined) this.onPauseCallback = callbacks.onPause;
    if (callbacks.onError !== undefined) this.onErrorCallback = callbacks.onError;
  }

  /**
   * Cleans raw AI markdown for spoken voice.
   * Strips code fences, links, asterisks, headers, bullets, and syntax symbols.
   */
  private cleanMarkdownForSpeech(text: string): string {
    return text
      .replace(/```[\s\S]*?(?:```|$)/g, "") // strip entire code fences
      .replace(/`([^`]+)`/g, "$1") // inline code
      .replace(/`+/g, "") // stray backticks
      .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
      .replace(/\*([^*]+)\*/g, "$1") // italics
      .replace(/[*_~]+/g, "") // stray markdown symbols
      .replace(/#+\s+/g, "") // headers
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links: keep text only
      .replace(/https?:\/\/\S+/g, "") // URLs
      .replace(/^[-*+•]\s+/gm, "") // list bullets
      .replace(/^\d+\.\s+/gm, "") // numbered lists
      .replace(/>\s+/g, "") // blockquotes
      .replace(/[\r\n]+/g, " ") // newlines to spaces
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /**
   * Begin a new stream response. Resets buffer and marks stream as actively generating.
   */
  public beginStream() {
    this.cancel();
    this.isStreamActive = true;
    this.spokenSentencesCount = 0;
    this.totalSpokenWords = 0;
  }

  /**
   * Feed a stream chunk. Buffers text and queues spoken sentences.
   * Queues natural sentence boundaries without truncating the reply.
   */
  public enqueueStreamChunk(chunk: string) {
    this.isStreamActive = true;
    if (
      this.spokenSentencesCount >= this.maxSentences ||
      this.totalSpokenWords >= this.maxSpokenWords
    ) {
      // An explicitly configured limit was reached.
      return;
    }

    this.buffer += chunk;

    const isAbbreviationOrDecimal = (str: string) => {
      return (
        /(?:Dr|Mr|Mrs|Ms|vs|approx|e\.g|i\.e|etc|inc|ltd)\.$/i.test(str.trim()) ||
        /\d\.\d+$/.test(str.trim())
      );
    };

    const sentenceEndRegex = /([.!?]+(?:\s+|$)|[\r\n]{2,})/;
    let match = sentenceEndRegex.exec(this.buffer);

    while (match) {
      const splitIndex = match.index + match[0].length;
      const candidate = this.buffer.slice(0, splitIndex);

      if (isAbbreviationOrDecimal(candidate)) {
        // Skip decimal/abbreviation and search further
        const rest = this.buffer.slice(splitIndex);
        const nextMatch = sentenceEndRegex.exec(rest);
        if (nextMatch) {
          const nextSplitIndex = splitIndex + nextMatch.index + nextMatch[0].length;
          const fullCandidate = this.buffer.slice(0, nextSplitIndex);
          if (!isAbbreviationOrDecimal(fullCandidate)) {
            const sentence = fullCandidate.trim();
            this.buffer = this.buffer.slice(nextSplitIndex);
            if (sentence.length > 0) {
              const cleaned = this.cleanMarkdownForSpeech(sentence);
              if (cleaned.length > 0) {
                this.enqueueSentence(cleaned);
              }
            }
          } else {
            break;
          }
        } else {
          break;
        }
      } else {
        const sentence = candidate.trim();
        this.buffer = this.buffer.slice(splitIndex);

        if (sentence.length > 0) {
          const cleaned = this.cleanMarkdownForSpeech(sentence);
          if (cleaned.length > 0) {
            this.enqueueSentence(cleaned);
          }
        }
      }

      if (
        this.spokenSentencesCount >= this.maxSentences ||
        this.totalSpokenWords >= this.maxSpokenWords
      ) {
        this.buffer = "";
        break;
      }

      match = sentenceEndRegex.exec(this.buffer);
    }
  }

  /**
   * Called when stream completes. Flushes the remaining spoken text in the buffer.
   */
  public flushStream() {
    this.isStreamActive = false;
    if (
      this.buffer.trim().length > 0 &&
      this.spokenSentencesCount < this.maxSentences &&
      this.totalSpokenWords < this.maxSpokenWords
    ) {
      const cleaned = this.cleanMarkdownForSpeech(this.buffer.trim());
      if (cleaned.length > 0) {
        this.enqueueSentence(cleaned);
      }
      this.buffer = "";
    } else {
      this.buffer = "";
    }

    if (this.queue.length === 0 && !this.isSpeaking) {
      this.onEndCallback?.();
    }
  }

  private enqueueSentence(sentence: string) {
    if (
      this.spokenSentencesCount >= this.maxSentences ||
      this.totalSpokenWords >= this.maxSpokenWords
    ) {
      return;
    }

    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (this.totalSpokenWords + words.length > this.maxSpokenWords) {
      const remainingAllowed = this.maxSpokenWords - this.totalSpokenWords;
      if (remainingAllowed > 3) {
        sentence = words.slice(0, remainingAllowed).join(" ") + ".";
      } else if (this.spokenSentencesCount > 0) {
        return;
      }
    }

    this.spokenSentencesCount++;
    this.totalSpokenWords += sentence.trim().split(/\s+/).filter(Boolean).length;

    this.queue.push(sentence);
    if (!this.isSpeaking) {
      this.playNext();
    }
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.onPauseCallback?.();
      if (!this.isStreamActive && this.buffer.trim().length === 0) {
        this.onEndCallback?.();
      }
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.queue = [];
      this.isSpeaking = false;
      if (!this.isStreamActive) this.onEndCallback?.();
      return;
    }

    if (!this.selectedVoice) {
      this.selectDefaultMaleVoice();
    }

    // Recover from Chromium paused state
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}

    const sentence = this.queue.shift();
    if (!sentence) return;

    const utterance = new SpeechSynthesisUtterance(sentence);
    const generation = this.generation;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    // Retain in Set to protect against Chrome V8 Garbage Collection bug
    this.activeUtterances.add(utterance);

    utterance.onstart = () => {
      if (generation !== this.generation) return;
      this.isSpeaking = true;
      this.onStartCallback?.();
    };

    utterance.onboundary = (e) => {
      if (generation !== this.generation) return;
      if (e.name === "word") {
        const spokenWord = sentence
          .slice(e.charIndex, e.charIndex + (e.charLength || 8))
          .split(/\s+/)[0];
        if (spokenWord) {
          this.onWordCallback?.(spokenWord, e.charIndex);
        }
      }
    };

    utterance.onend = () => {
      if (generation !== this.generation) return;
      this.activeUtterances.delete(utterance);
      this.playNext();
    };

    utterance.onerror = (event) => {
      if (generation !== this.generation) return;
      this.activeUtterances.delete(utterance);
      this.currentUtterance = null;
      this.isSpeaking = false;

      // Automatic fallback for network-dependent voices that fail with synthesis-failed
      if (event.error === "synthesis-failed" && this.selectedVoice) {
        const localVoice = this.voices.find(
          (v) => v !== this.selectedVoice && (v.localService || !v.name.toLowerCase().includes("google"))
        );
        if (localVoice) {
          this.selectedVoice = localVoice;
          this.queue.unshift(sentence);
          this.playNext();
          return;
        }
      }

      if (event.error !== "canceled" && event.error !== "interrupted") {
        this.queue = [];
        this.onErrorCallback?.(new Error(`Speech playback failed (${event.error}). The text response is still available.`));
      }
      this.playNext();
    };

    this.currentUtterance = utterance;
    this.isSpeaking = true;

    try {
      window.speechSynthesis.speak(utterance);
      // Double check in case Chromium paused immediately
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (err) {
      this.activeUtterances.delete(utterance);
      this.currentUtterance = null;
      this.isSpeaking = false;
      this.queue = [];
      this.onErrorCallback?.(err instanceof Error ? err : new Error(String(err)));
      this.playNext();
    }
  }

  /**
   * Speak a complete text immediately (replaces entire queue).
   */
  public speakImmediate(text: string) {
    this.cancel();
    const cleaned = this.cleanMarkdownForSpeech(text);
    if (!cleaned) return;
    this.enqueueSentence(cleaned);
  }

  /**
   * Cancel all speech synthesis and reset queue and buffer.
   */
  public cancel() {
    // Cancellation is not natural completion. Never restart a microphone here.
    this.generation++;
    const ownsPlayback = this.currentUtterance !== null || this.activeUtterances.size > 0;
    for (const utterance of this.activeUtterances) {
      utterance.onstart = null;
      utterance.onboundary = null;
      utterance.onend = null;
      utterance.onerror = null;
    }
    this.queue = [];
    this.buffer = "";
    this.isSpeaking = false;
    this.isStreamActive = false;
    this.spokenSentencesCount = 0;
    this.totalSpokenWords = 0;
    this.currentUtterance = null;
    this.activeUtterances.clear();
    if (ownsPlayback && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  /** Release the browser subscription as well as queued speech. */
  public dispose() {
    this.onStartCallback = null;
    this.onWordCallback = null;
    this.onEndCallback = null;
    this.onPauseCallback = null;
    this.onErrorCallback = null;
    this.cancel();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.removeEventListener("voiceschanged", this.handleVoicesChanged);
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser-provided Speech-to-Text (STT) via Web Speech Recognition
// ─────────────────────────────────────────────────────────────────────────────

export interface GoogleSTTCallbacks {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onAudioLevel?: (level: number) => void;
  onStateChange?: (isListening: boolean) => void;
  onError?: (err: Error) => void;
  onBargeIn?: () => void;
}

export class GoogleSpeechRecognizer {
  private recognition: ISpeechRecognition | null = null;
  private isListening = false;
  private isMonitoringBargeIn = false;
  private bargeInCounter = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private generation = 0;
  private isStarting = false;
  private animFrameId: number | null = null;
  private callbacks: GoogleSTTCallbacks = {};
  
  // Accumulated transcripts across recognition sessions without word drops
  private baseTranscript = "";
  private currentSessionFinal = "";
  private currentInterim = "";
  private lang = "en-US";

  constructor(callbacks: GoogleSTTCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const win = window as unknown as IWindowSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public setLanguage(lang: string) {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public async start(): Promise<void> {
    this.isMonitoringBargeIn = false;
    this.bargeInCounter = 0;

    if (this.isListening || this.isStarting) return;

    if (!this.isSupported()) {
      const err = new Error(
        "Speech recognition is not supported by this browser or native webview. Use a speech-enabled browser, or type in the transcript panel."
      );
      this.callbacks.onError?.(err);
      throw err;
    }

    this.baseTranscript = "";
    this.currentSessionFinal = "";
    this.currentInterim = "";
    this.isStarting = true;
    const generation = ++this.generation;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires HTTPS or localhost and a supported browser.");
      }
      // 1. Initialize microphone stream if not already active
      if (!this.mediaStream) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (generation !== this.generation) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        this.mediaStream = stream;

        const ctx = getSharedAudioContext();
        if (ctx) {
          this.audioContext = ctx;
          const source = ctx.createMediaStreamSource(stream);
          this.source = source;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.65;
          source.connect(analyser);
          this.analyser = analyser;
        }
      }

      this.isStarting = false;
      this.startAudioMeter();
      this.isListening = true;
      this.callbacks.onStateChange?.(true);
      this.initRecognitionInstance();
    } catch (err: unknown) {
      if (generation !== this.generation) return;
      this.isStarting = false;
      this.isListening = false;
      this.cleanup();
      const error = err instanceof Error ? err : new Error(String(err));
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  /**
   * Initializes or re-initializes a fresh SpeechRecognition instance.
   */
  private initRecognitionInstance() {
    if (!this.isListening) return;

    const win = window as unknown as IWindowSpeech;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    try {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = this.lang;
      recognition.maxAlternatives = 1;

      this.currentSessionFinal = "";
      this.currentInterim = "";

      recognition.onstart = () => {
        // Active
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        if (!this.isListening || this.recognition !== recognition) return;
        let sessionFinal = "";
        let sessionInterim = "";

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            sessionFinal += (sessionFinal ? " " : "") + text;
          } else {
            sessionInterim += (sessionInterim ? " " : "") + text;
          }
        }

        this.currentSessionFinal = sessionFinal.trim();
        this.currentInterim = sessionInterim.trim();

        const totalFinal = (this.baseTranscript + " " + this.currentSessionFinal).trim();
        const fullCombined = (totalFinal + " " + this.currentInterim).trim();

        if (fullCombined) {
          this.callbacks.onInterim?.(fullCombined);
          this.resetSilenceTimer(fullCombined);
        }
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        if (!this.isListening || this.recognition !== recognition) return;
        if (event.error === "no-speech" || event.error === "aborted") {
          return;
        }
        const message = event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone permission was denied. Allow microphone access in your browser and try again."
          : event.error === "audio-capture"
            ? "No microphone is available. Connect a microphone and try again."
            : `Voice recognition failed (${event.error}). Please try again or use text chat.`;
        this.abort();
        this.callbacks.onError?.(new Error(message));
      };

      recognition.onend = () => {
        if (this.recognition !== recognition) return;
        if (this.isListening) {
          if (this.currentSessionFinal) {
            this.baseTranscript = (this.baseTranscript + " " + this.currentSessionFinal).trim();
            this.currentSessionFinal = "";
            this.currentInterim = "";
          }

          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.isListening) {
              this.initRecognitionInstance();
            }
          }, 80);
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch (error) {
      this.abort();
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private resetSilenceTimer(text: string) {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // Natural human pause tolerance:
    // If browser finalized a sentence, wait 1100ms of measured silence.
    // If interim sentence, wait 1650ms so unfinished phrases have room to breathe.
    if (text.trim().length > 0) {
      const hasFinal = Boolean(this.currentSessionFinal || this.baseTranscript);
      const delay = hasFinal ? 1100 : 1650;

      this.silenceTimer = setTimeout(() => {
        const totalFinal = (this.baseTranscript + " " + this.currentSessionFinal).trim();
        const finalPrompt = (`${totalFinal} ${this.currentInterim}`.trim() || text).trim();
        if (finalPrompt.length > 0 && this.isListening) {
          this.pauseForSpeaking();
          this.callbacks.onFinal?.(finalPrompt);
        }
      }, delay);
    }
  }

  private startAudioMeter() {
    if (!this.analyser) return;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const data = new Uint8Array(this.analyser.fftSize);

    const checkVolume = () => {
      if (!this.analyser) return;

      this.analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const sample = (data[i] - 128) / 128;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const avg = Math.min(1, Math.max(0, (rms - 0.006) * 5));
      this.callbacks.onAudioLevel?.(avg);

      // If user is actively talking (voice audio level > 0.06), keep resetting silence timer so it does not stop listening
      if (this.isListening && avg > 0.06 && this.silenceTimer) {
        const totalFinal = (this.baseTranscript + " " + this.currentSessionFinal + " " + this.currentInterim).trim();
        if (totalFinal) {
          this.resetSilenceTimer(totalFinal);
        }
      }

      // Barge-in vocal interruption detection while AI is speaking
      if (this.isMonitoringBargeIn) {
        if (avg > 0.13) {
          this.bargeInCounter = (this.bargeInCounter || 0) + 1;
          if (this.bargeInCounter >= 2) {
            this.isMonitoringBargeIn = false;
            this.bargeInCounter = 0;
            this.callbacks.onBargeIn?.();
          }
        } else {
          this.bargeInCounter = 0;
        }
      }

      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    this.animFrameId = requestAnimationFrame(checkVolume);
  }

  /**
   * Pauses SpeechRecognition while AI is speaking, but keeps microphone stream
   * alive to monitor for user speech interruption (barge-in).
   */
  public pauseForSpeaking(): string {
    this.generation++;
    this.isStarting = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    const totalFinal = (
      this.baseTranscript +
      " " +
      this.currentSessionFinal +
      " " +
      this.currentInterim
    ).trim();

    this.isListening = false;
    // CRITICAL FIX: Do not monitor microphone for barge-in while AI is speaking!
    // Device speaker audio feeds into the mic, which caused the orb to falsely interrupt
    // and cancel its own speech after 1 syllable. Tap orb anytime to interrupt.
    this.isMonitoringBargeIn = false;
    this.bargeInCounter = 0;
    this.callbacks.onStateChange?.(false);

    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      try {
        this.recognition.abort();
      } catch (_e) {}
      this.recognition = null;
    }

    this.cleanup();
    this.callbacks.onAudioLevel?.(0);
    return totalFinal;
  }

  public stop(): string {
    return this.pauseForSpeaking();
  }

  public abort() {
    this.generation++;
    this.isStarting = false;
    this.isMonitoringBargeIn = false;
    this.bargeInCounter = 0;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    this.isListening = false;
    this.callbacks.onStateChange?.(false);

    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      try {
        this.recognition.abort();
      } catch (_e) {}
      this.recognition = null;
    }

    this.cleanup();
  }

  private cleanup() {
    this.isMonitoringBargeIn = false;
    this.bargeInCounter = 0;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (_e) {}
      this.analyser = null;
    }
    this.audioContext = null;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}
