/**
 * ResponseSpeechBuffer
 * Buffers incoming streamed SSE response tokens and partitions them
 * into natural, speakable phrases at sentence or clause boundaries.
 * Includes a timeout fallback so unpunctuated phrases never stall.
 */

export interface SpeakablePhrase {
  readonly text: string;
  readonly phraseIndex: number;
  readonly turnId: string;
}

export type PhraseCallback = (phrase: SpeakablePhrase) => void;

export class ResponseSpeechBuffer {
  private buffer = "";
  private phraseIndex = 0;
  private currentTurnId: string = "";
  private onPhrase: PhraseCallback;
  private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly flushDelayMs = 350;

  constructor(onPhrase: PhraseCallback) {
    this.onPhrase = onPhrase;
  }

  public reset(newTurnId: string) {
    this.clearFlushTimeout();
    this.buffer = "";
    this.phraseIndex = 0;
    this.currentTurnId = newTurnId;
  }

  public appendChunk(chunk: string, turnId: string) {
    if (turnId !== this.currentTurnId) return;

    this.buffer += chunk;
    this.clearFlushTimeout();
    this.processBuffer(false);

    if (this.buffer.trim().length > 0) {
      this.flushTimeoutId = setTimeout(() => {
        this.flushTimeoutId = null;
        if (turnId === this.currentTurnId && this.buffer.trim().length > 0) {
          this.processBuffer(true);
        }
      }, this.flushDelayMs);
    }
  }

  public flush(turnId: string) {
    if (turnId !== this.currentTurnId) return;
    this.clearFlushTimeout();
    this.processBuffer(true);
  }

  private clearFlushTimeout() {
    if (this.flushTimeoutId !== null) {
      clearTimeout(this.flushTimeoutId);
      this.flushTimeoutId = null;
    }
  }

  private processBuffer(forceFlush: boolean) {
    // Sentence boundary regex (split on period, exclamation, question mark, newline, or major clause)
    // Avoid splitting decimal numbers (e.g., 3.14) or abbreviations
    while (this.buffer.length > 0) {
      const match = this.buffer.match(/([.!?\n]+|[,;:](?=\s))(\s+|$)/);

      if (match && match.index !== undefined) {
        const splitPoint = match.index + match[0].length;
        const candidate = this.buffer.slice(0, splitPoint);
        this.buffer = this.buffer.slice(splitPoint);

        const cleaned = this.cleanForSpeech(candidate);
        if (cleaned) {
          this.emitPhrase(cleaned);
        }
      } else if (forceFlush) {
        const candidate = this.buffer;
        this.buffer = "";
        const cleaned = this.cleanForSpeech(candidate);
        if (cleaned) {
          this.emitPhrase(cleaned);
        }
        break;
      } else {
        // No boundary yet and not forcing
        break;
      }
    }
  }

  private emitPhrase(text: string) {
    const phrase: SpeakablePhrase = {
      text,
      phraseIndex: this.phraseIndex++,
      turnId: this.currentTurnId,
    };
    this.onPhrase(phrase);
  }

  public cleanForSpeech(raw: string): string {
    if (!raw) return "";

    let cleaned = raw
      // Replace code blocks with concise spoken description
      .replace(/```[\s\S]*?```/g, " Code block omitted. ")
      // Replace inline code with text
      .replace(/`([^`]+)`/g, "$1")
      // Remove URLs
      .replace(/https?:\/\/\S+/gi, " link ")
      // Remove markdown headings, bold, italics, strikethrough
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
      // Remove blockquotes and list bullets
      .replace(/^[>*-]\s+/gm, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim();

    return cleaned;
  }
}
