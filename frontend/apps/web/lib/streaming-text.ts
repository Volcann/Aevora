/** Main-chat text presentation. Orb rendering and timing are deliberately separate. */
export interface StreamingTextOptions {
  boosted: boolean;
  onText: (text: string) => void;
  onComplete: (text: string) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

/**
 * Keep the existing typewriter step sizes, but only request a frame when text
 * remains to be displayed. Transport completion must not discard that backlog.
 */
export class StreamingText {
  readonly finished: Promise<void>;
  private resolveFinished!: () => void;
  private text = "";
  private displayed = 0;
  private frame: number | null = null;
  private transportDone = false;
  private settled = false;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (id: number) => void;

  constructor(private readonly options: StreamingTextOptions) {
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
    this.finished = new Promise((resolve) => { this.resolveFinished = resolve; });
  }

  append(chunk: string): void {
    if (this.settled || !chunk) return;
    this.text += chunk;
    this.schedule();
  }

  complete(): void {
    if (this.settled) return;
    this.transportDone = true;
    if (this.displayed === this.text.length) this.finish();
    else this.schedule();
  }

  cancel(): void {
    if (this.settled) return;
    this.settled = true;
    this.clearFrame();
    this.resolveFinished();
  }

  private clearFrame(): void {
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
  }

  private schedule(): void {
    if (!this.settled && this.frame === null) {
      this.frame = this.requestFrame(this.pump);
    }
  }

  private pump = (): void => {
    this.frame = null;
    if (this.settled) return;
    const diff = this.text.length - this.displayed;
    if (diff > 0) {
      // These are the supplied app's exact boost/normal animation step sizes.
      const step = this.options.boosted
        ? (diff > 35 ? Math.ceil(diff / 6) : diff > 10 ? 2 : 1)
        : (diff > 50 ? Math.ceil(diff / 10) : diff > 15 ? 2 : 1);
      this.displayed = Math.min(this.text.length, this.displayed + step);
      this.options.onText(this.text.slice(0, this.displayed));
    }
    if (this.settled) return;
    if (this.displayed < this.text.length) this.schedule();
    else if (this.transportDone) this.finish();
    // No empty RAF polling between chunks. append() resumes the same animation.
  };

  private finish(): void {
    if (this.settled) return;
    this.settled = true;
    this.clearFrame();
    try { this.options.onComplete(this.text); }
    finally { this.resolveFinished(); }
  }
}
