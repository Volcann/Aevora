/** Presentation-only preferences and physics. No chat, network, or native APIs. */
export const PLAY_MODES = [
  { id: "classic", name: "Classic", hint: "Original idle appearance. Drag and toss to play." },
  { id: "float", name: "Float", hint: "A gentle, weightless bob." },
  { id: "bounce", name: "Bounce", hint: "Soft little hops with squash and stretch." },
  { id: "orbit", name: "Orbit", hint: "A small orbit around its resting spot." },
  { id: "follow", name: "Follow", hint: "Follows your pointer around the main workspace, keeping a little distance." },
  { id: "roam", name: "Roam", hint: "Wanders around the screen. Opening the companion pauses travel." },
  { id: "sleepy", name: "Sleepy", hint: "Slow breathing and sleepy eyes. Responses wake it up." },
] as const;
export const MORPH_STYLES = [
  { id: "fluid", name: "Fluid", hint: "Organic, softly changing silhouette" },
  { id: "pulse", name: "Pulse", hint: "A smooth, rounded pulse" },
  { id: "elastic", name: "Elastic", hint: "Playful squash and stretch" },
  { id: "ribbon", name: "Ribbon", hint: "Stretches into a soft, rounded ribbon" },
  { id: "off", name: "Original", hint: "Keep the original response animation" },
] as const;
/** Optional treatments sit OUTSIDE the existing renderer. Original means no filter. */
export const COLOR_TREATMENTS = [
  { id: "original", name: "Original", filter: "none", swatch: "linear-gradient(135deg,#ff0055,#00ff66,#0066ff)" },
  { id: "moonstone", name: "Moonstone", filter: "grayscale(1) brightness(1.1)", swatch: "linear-gradient(135deg,#f3f4ff,#8794b5,#30394f)" },
  { id: "sunset", name: "Sunset", filter: "hue-rotate(325deg) saturate(1.2)", swatch: "linear-gradient(135deg,#ffcd80,#ff6389,#805ce5)" },
  { id: "aurora", name: "Aurora", filter: "hue-rotate(100deg) saturate(1.15)", swatch: "linear-gradient(135deg,#8df5bb,#4ddfe9,#6479ef)" },
  { id: "candy", name: "Candy", filter: "hue-rotate(265deg) saturate(.8) brightness(1.12)", swatch: "linear-gradient(135deg,#ffd0ee,#aa9cff,#8ddde5)" },
] as const;
export type PlayMode = typeof PLAY_MODES[number]["id"];
export type MorphStyle = typeof MORPH_STYLES[number]["id"];
export type ColorTreatment = typeof COLOR_TREATMENTS[number]["id"];
export type OrbTrick = "wiggle" | "hop" | "spin" | "celebrate";
export interface PlayPreferences {
  mode: PlayMode;
  morph: MorphStyle;
  treatment: ColorTreatment;
  energy: "gentle" | "balanced" | "lively";
  reactions: boolean;
}
export const DEFAULT_PLAY: Readonly<PlayPreferences> = Object.freeze({
  mode: "classic", morph: "fluid", treatment: "original", energy: "balanced", reactions: true,
});
export function normalizePlay(value: unknown): PlayPreferences {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    mode: PLAY_MODES.some(item => item.id === input.mode) ? input.mode as PlayMode : DEFAULT_PLAY.mode,
    morph: MORPH_STYLES.some(item => item.id === input.morph) ? input.morph as MorphStyle : DEFAULT_PLAY.morph,
    treatment: COLOR_TREATMENTS.some(item => item.id === input.treatment) ? input.treatment as ColorTreatment : DEFAULT_PLAY.treatment,
    energy: input.energy === "gentle" || input.energy === "lively" ? input.energy : "balanced",
    reactions: typeof input.reactions === "boolean" ? input.reactions : DEFAULT_PLAY.reactions,
  };
}
export const energyScale = (energy: PlayPreferences["energy"]): number => energy === "gentle" ? .65 : energy === "lively" ? 1.35 : 1;
export interface Point { x: number; y: number }
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export function screenBounds(width: number, height: number, size = 80): Bounds {
  const maxX = Math.max(0, width - size - 8), maxY = Math.max(0, height - size - 8);
  return { minX: Math.min(8, maxX), minY: Math.min(8, maxY), maxX, maxY };
}
export function boundPoint(point: Point, bounds: Bounds): Point {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, Number.isFinite(point.x) ? point.x : bounds.maxX)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, Number.isFinite(point.y) ? point.y : bounds.maxY)),
  };
}
/** Time-based friction avoids a different fling feel on 60 / 120 / 144 Hz screens. */
export function flingStep(point: Point, velocity: Point, deltaSeconds: number, bounds: Bounds) {
  const dt = Math.max(0, Math.min(.04, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  const decay = Math.exp(-3.7 * dt);
  const distance = (1 - decay) / 3.7;
  const raw = { x: point.x + velocity.x * distance, y: point.y + velocity.y * distance };
  const next = boundPoint(raw, bounds);
  const hitX = raw.x !== next.x, hitY = raw.y !== next.y;
  return {
    point: next,
    velocity: { x: velocity.x * decay * (hitX ? -.72 : 1), y: velocity.y * decay * (hitY ? -.72 : 1) },
    hit: hitX || hitY,
  };
}
