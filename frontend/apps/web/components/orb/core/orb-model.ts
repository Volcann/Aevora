/** Visual state is deliberately independent from React and the speech engine. */
export type OrbState = 0 | 1 | 2 | 3;
export interface OrbSignal {
  /** Normalized microphone RMS/frequency energy. Never fabricate input levels. */
  audio: number;
  /** Word-boundary impulse; decayed by the renderer, not React state. */
  word: number;
  /** Millisecond timestamp of the latest real utterance boundary. */
  wordAt?: number;
}
export const ORB_LABELS = ["Ready to talk", "Listening", "Thinking", "Speaking"] as const;
export const clamp = (value: number, min = 0, max = 1): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
export function toOrbState(value: number | undefined): OrbState {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}
/** Frame-rate-independent damping: identical feel at 30, 60 and 120 Hz. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * clamp(dt, 0, 0.1)));
}
export function audioEnvelope(level: number): number {
  return clamp((clamp(level) - 0.015) * 3.2);
}
