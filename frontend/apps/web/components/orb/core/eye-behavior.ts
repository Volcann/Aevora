/** Frontend-only expression policy. No renderer, transport, speech, or native APIs. */
export type EyeMood =
  | "normal" | "happy" | "wink" | "heart" | "surprised" | "dizzy"
  | "curious" | "focused" | "sleepy" | "content";

const MOODS: ReadonlySet<string> = new Set([
  "normal", "happy", "wink", "heart", "surprised", "dizzy",
  "curious", "focused", "sleepy", "content",
]);
export function isEyeMood(value: unknown): value is EyeMood {
  return typeof value === "string" && MOODS.has(value);
}

export function restingMood(state: number): EyeMood {
  return state === 1 ? "curious" : state === 2 ? "focused" : "normal";
}

export function canBlink(mood: EyeMood): boolean {
  return mood === "normal" || mood === "curious" || mood === "focused"
    || mood === "sleepy" || mood === "content";
}

export const EYE_PRIORITY = {
  idle: 5, attention: 10, movement: 20, settle: 25,
  surprise: 40, shake: 50, affection: 60, explicit: 100,
} as const;

type Timer = ReturnType<typeof setTimeout>;
export interface EyeClock {
  setTimer: (callback: () => void, milliseconds: number) => Timer;
  clearTimer: (timer: Timer) => void;
}
const defaultClock: EyeClock = {
  setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimer: (timer) => clearTimeout(timer),
};

/**
 * One owner for the reaction timer, independent of React effect dependencies.
 * Repeated movement cannot extend a reaction forever or interrupt affection.
 */
export class EyeReactions {
  private timer: Timer | null = null;
  private priority = 0;
  private disposed = false;
  mood: EyeMood = "normal";

  constructor(
    private readonly onChange: (mood: EyeMood) => void,
    private readonly clock: EyeClock = defaultClock,
  ) {}

  react(mood: EyeMood, duration = 1600, priority: number = EYE_PRIORITY.explicit): boolean {
    if (this.disposed || !isEyeMood(mood)) return false;
    if (mood === "normal") { this.reset(); return true; }
    if (priority < this.priority) return false;
    if (mood === this.mood) {
      // Upgrade importance without renewing the deadline on every pointer event.
      this.priority = Math.max(this.priority, priority);
      return false;
    }
    this.clear();
    this.priority = priority;
    this.mood = mood;
    const milliseconds = Number.isFinite(duration) ? Math.max(250, Math.min(8000, duration)) : 1600;
    this.timer = this.clock.setTimer(() => this.reset(), milliseconds);
    this.onChange(mood);
    return true;
  }

  reset(): void {
    this.clear();
    this.priority = 0;
    if (this.mood !== "normal") {
      this.mood = "normal";
      if (!this.disposed) this.onChange("normal");
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clear();
  }

  private clear(): void {
    if (this.timer !== null) this.clock.clearTimer(this.timer);
    this.timer = null;
  }
}

/** Deliberate direction changes, not raw event counts. Storage is bounded. */
export class StrokeGesture {
  private extreme: number | null = null;
  private direction = 0;
  private lastAt = -Infinity;
  private turns: number[] = [];

  constructor(private readonly windowMs: number, private readonly requiredTurns: number) {}

  sample(x: number, now: number, minimumTravel: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(now) || !Number.isFinite(minimumTravel)) return false;
    if (now - this.lastAt > this.windowMs || now < this.lastAt) this.reset();
    this.lastAt = now;
    if (this.extreme === null) { this.extreme = x; return false; }
    const dx = x - this.extreme;
    if (this.direction === 0) {
      if (Math.abs(dx) >= Math.max(1, minimumTravel)) {
        this.direction = Math.sign(dx);
        this.extreme = x;
      }
      return false;
    }
    if (dx * this.direction >= 0) { this.extreme = x; return false; }
    if (Math.abs(dx) < Math.max(1, minimumTravel)) return false;
    this.direction = Math.sign(dx);
    this.extreme = x;
    this.turns = this.turns.filter((time) => now - time <= this.windowMs);
    this.turns.push(now);
    if (this.turns.length < this.requiredTurns) return false;
    this.reset();
    return true;
  }

  reset(): void {
    this.extreme = null;
    this.direction = 0;
    this.turns = [];
    this.lastAt = -Infinity;
  }
}

export interface EyeGaze { left: number; right: number; y: number; faceX: number; faceY: number }
export const CENTER_GAZE: Readonly<EyeGaze> = Object.freeze({ left: 0, right: 0, y: 0, faceX: 0, faceY: 0 });
export function restingGaze(state: number, alternate = false): EyeGaze {
  return state === 2
    ? { left: alternate ? -1.2 : 1.2, right: alternate ? -1.2 : 1.2, y: -1.8, faceX: alternate ? -0.4 : 0.4, faceY: -0.6 }
    : { ...CENTER_GAZE };
}

/** Preserve the supplied pupil/parallax limits; only the eye layer is updated. */
export function pointerGaze(dx: number, dy: number): EyeGaze {
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance >= 700) return { ...CENTER_GAZE };
  // The old 0.08 minimum caused a rightward twitch with the pointer dead-center.
  const factor = Math.min(1, distance / 200);
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * 3.4 * factor;
  const y = Math.sin(angle) * 4 * factor;
  const convergence = distance < 160 ? (1 - distance / 160) * 0.75 : 0;
  return { left: x + convergence, right: x - convergence, y, faceX: x * 0.32, faceY: y * 0.32 };
}
