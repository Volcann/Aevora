/** Text-only conversation lifecycle. No recording, recognition or audio playback. */
import type { OrbSignal } from "../components/orb/core/orb-model";

export interface PromptOptions {
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
  onToolStart?: (tool: string) => void;
  onToolLog?: (log: string, tool?: string) => void;
  onToolDone?: (tool: string, output?: string) => void;
  onToolError?: (tool: string) => void;
  onDone?: () => void;
}
export type SendPrompt = (prompt: string, options?: PromptOptions) => Promise<void>;
export interface TextTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  logs?: { id: string; text: string }[];
}
export interface TextSnapshot {
  state: 0 | 2;
  streaming: boolean;
  response: string;
  error: string | null;
  turns: readonly TextTurn[];
  activeTool?: { name: string; status: "start" | "done" | "error" } | null;
  streamingLogs?: readonly string[];
}
export interface TextSessionOptions { onPrompt: SendPrompt; onStopStreaming?: () => void }
const empty = (): TextSnapshot => ({
  state: 0,
  streaming: false,
  response: "",
  error: null,
  turns: [],
  activeTool: null,
  streamingLogs: [],
});

export class TextSession {
  readonly signal: { readonly current: OrbSignal } = { current: { audio: 0, word: 0 } };
  private snapshot = empty();
  private listeners = new Set<() => void>();
  private active: AbortController | null = null;
  private sequence = 0;
  private animId: number | null = null;
  constructor(private options: TextSessionOptions) {}
  updateOptions(options: TextSessionOptions): void { this.options = options; }
  getSnapshot = (): TextSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(patch: Partial<TextSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  stop = (): void => {
    const active = this.active;
    this.active = null; // Reject callbacks before dispatching cancellation.
    if (this.animId !== null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.animId);
      }
      this.animId = null;
    }
    active?.abort();
    if (active) this.options.onStopStreaming?.();
    if (this.snapshot.streaming) this.publish({ streaming: false, state: 0, activeTool: null, streamingLogs: [] });
  };
  reset = (): void => { this.stop(); this.snapshot = empty(); this.listeners.forEach((listener) => listener()); };
  send = async (value: string): Promise<void> => {
    const prompt = value.trim();
    if (!prompt) return;
    this.stop();
    const controller = new AbortController();
    this.active = controller;
    const key = `${Date.now()}-${++this.sequence}`;
    const replyId = `reply-${key}`;
    let response = "";
    let displayedLen = 0;
    let streamFinished = false;
    let done = false;
    const current = () => this.active === controller && !controller.signal.aborted && !done;
    const hasRaf = typeof requestAnimationFrame === "function";

    const liveLogs: { id: string; text: string }[] = [];
    const currentStreamingLogs: string[] = [];
    let currentActiveTool: { name: string; status: "start" | "done" | "error" } | null = null;

    this.publish({
      state: 2, streaming: true, response: "", error: null,
      activeTool: null, streamingLogs: [],
      turns: [...this.snapshot.turns, { id: `prompt-${key}`, role: "user", text: prompt }],
    });

    const finalize = () => {
      if (!current()) return;
      done = true;
      if (this.animId !== null) {
        if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(this.animId);
        }
        this.animId = null;
      }
      this.active = null;
      const currentText = response;
      const turns = [...this.snapshot.turns];
      const last = turns[turns.length - 1];
      const reply: TextTurn = {
        id: replyId,
        role: "assistant",
        text: currentText,
        logs: liveLogs.length > 0 ? liveLogs : undefined,
      };
      if (last?.id === replyId) turns[turns.length - 1] = reply;
      else if (currentText || liveLogs.length > 0) turns.push(reply);
      this.publish({
        response: currentText,
        turns,
        streaming: false,
        state: 0,
        activeTool: null,
        streamingLogs: [],
      });
    };

    const updateDisplay = () => {
      if (!current()) return;
      const targetLen = response.length;
      if (displayedLen < targetLen) {
        const diff = targetLen - displayedLen;
        const step = diff > 40 ? Math.ceil(diff / 8) : diff > 15 ? 2 : 1;
        displayedLen = Math.min(targetLen, displayedLen + step);
        const currentText = response.slice(0, displayedLen);
        const turns = [...this.snapshot.turns];
        const last = turns[turns.length - 1];
        const reply: TextTurn = {
          id: replyId,
          role: "assistant",
          text: currentText,
          logs: liveLogs.length > 0 ? liveLogs : undefined,
        };
        if (last?.id === replyId) turns[turns.length - 1] = reply;
        else turns.push(reply);
        this.publish({ response: currentText, turns });
      }

      if (displayedLen < response.length || !streamFinished) {
        this.animId = requestAnimationFrame(updateDisplay);
      } else if (streamFinished) {
        finalize();
      }
    };

    try {
      await this.options.onPrompt(prompt, {
        signal: controller.signal,
        onChunk: (chunk) => {
          if (!current() || !chunk) return;
          response += chunk;
          if (hasRaf) {
            if (this.animId === null) {
              this.animId = requestAnimationFrame(updateDisplay);
            }
          } else {
            displayedLen = response.length;
            const turns = [...this.snapshot.turns];
            const last = turns[turns.length - 1];
            const reply: TextTurn = {
              id: replyId,
              role: "assistant",
              text: response,
              logs: liveLogs.length > 0 ? liveLogs : undefined,
            };
            if (last?.id === replyId) turns[turns.length - 1] = reply;
            else turns.push(reply);
            this.publish({ response, turns });
          }
        },
        onToolStart: (tool) => {
          if (!current()) return;
          currentActiveTool = { name: tool, status: "start" };
          this.publish({ activeTool: currentActiveTool });
        },
        onToolLog: (log) => {
          if (!current() || !log) return;
          liveLogs.push({ id: `log-${liveLogs.length}`, text: log });
          currentStreamingLogs.push(log);
          this.publish({ streamingLogs: [...currentStreamingLogs] });
        },
        onToolDone: (tool) => {
          if (!current()) return;
          currentActiveTool = { name: tool, status: "done" };
          this.publish({ activeTool: currentActiveTool });
        },
        onToolError: (tool) => {
          if (!current()) return;
          currentActiveTool = { name: tool, status: "error" };
          this.publish({ activeTool: currentActiveTool });
        },
        onDone: () => {
          streamFinished = true;
          if (!hasRaf || displayedLen >= response.length) {
            finalize();
          }
        },
      });
      if (!hasRaf || displayedLen >= response.length) finalize();
    } catch (error) {
      if (!current()) return;
      this.active = null;
      if (this.animId !== null) {
        if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(this.animId);
        }
        this.animId = null;
      }
      done = true;
      this.publish({
        state: 0,
        streaming: false,
        activeTool: null,
        streamingLogs: [],
        error: error instanceof Error ? error.message : "The reply could not be completed.",
      });
    }
  };
}
