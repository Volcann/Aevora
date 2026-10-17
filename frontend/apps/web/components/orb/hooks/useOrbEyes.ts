"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { OrbState } from "../core/orb-model";
import {
  canBlink, CENTER_GAZE, EYE_PRIORITY, EyeReactions, isEyeMood, pointerGaze, restingGaze,
  restingMood, StrokeGesture, type EyeGaze, type EyeMood,
} from "../core/eye-behavior";

interface EyeOptions {
  hostRef?: RefObject<HTMLElement | null>;
  state: OrbState;
  isMoving: boolean;
  mood?: EyeMood;
}
interface EyeContext { state: OrbState; isMoving: boolean; mood?: EyeMood }
interface EyeRuntime { update: (context: EyeContext) => void }
type Timer = ReturnType<typeof setTimeout>;

/** Eye-only controller. Never writes to the orb host, body, canvas or movement variables.
 * Gaze events are coalesced into one eye update per animation frame. */
export function useOrbEyes({ hostRef, state, isMoving, mood: externalMood }: EyeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const leftPupilRef = useRef<SVGGElement>(null);
  const rightPupilRef = useRef<SVGGElement>(null);
  const runtimeRef = useRef<EyeRuntime | null>(null);
  const [reaction, setReaction] = useState<EyeMood>("normal");
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const host = hostRef?.current ?? container?.parentElement;
    if (!container || !host) return;
    let context: EyeContext = { state: 0, isMoving: false };
    let active = true;
    let inView = true;
    let paused = document.hidden;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches || host.dataset.motion === "off";
    let frame: number | null = null;
    let latestPointer: { x: number; y: number } | null = null;
    let previousPosition: { x: number; y: number } | null = null;
    let press: { id: number; x: number; y: number; at: number; moved: boolean } | null = null;
    let lastActivity = performance.now();
    let nextAttentionAt = 0;
    let nextPetAt = 0;
    let nextMoveAt = 0;
    let pointerWasNear = false;
    let alternateGlance = false;
    let lastGaze = "";
    let blinkTimer: Timer | null = null;
    let idleTimer: Timer | null = null;
    const timers = new Set<Timer>();
    const strokes = new StrokeGesture(900, 3);
    const later = (callback: () => void, delay: number): Timer => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (active) callback();
      }, delay);
      timers.add(timer);
      return timer;
    };
    const cancelTimer = (timer: Timer | null) => {
      if (timer !== null) { clearTimeout(timer); timers.delete(timer); }
    };
    const currentMood = (): EyeMood => context.mood ?? (reactions.mood === "normal" ? restingMood(context.state) : reactions.mood);
    const writeGaze = (gaze: EyeGaze) => {
      const values = [gaze.left, gaze.right, gaze.y, gaze.faceX, gaze.faceY].map((value) => value.toFixed(2));
      const key = values.join(",");
      if (key === lastGaze) return;
      lastGaze = key;
      if (leftPupilRef.current) leftPupilRef.current.style.transform = `translate(${values[0]}px, ${values[2]}px)`;
      if (rightPupilRef.current) rightPupilRef.current.style.transform = `translate(${values[1]}px, ${values[2]}px)`;
      if (faceRef.current) faceRef.current.style.transform = `translate(${values[3]}px, ${values[4]}px)`;
    };
    const resetGaze = () => writeGaze(reduced ? CENTER_GAZE : restingGaze(context.state, alternateGlance));
    const reactions = new EyeReactions((nextMood) => {
      if (!active) return;
      setReaction(nextMood);
      setIsBlinking(false);
      resetGaze();
    });
    const react = (mood: EyeMood, duration: number, priority: number) => {
      if (context.mood !== undefined || paused) return false;
      return reactions.react(mood, duration, priority);
    };

    // Each blink owns both closure and reopening. No untracked nested timeouts.
    const blink = (double = false) => {
      if (paused || reduced || !canBlink(currentMood())) return;
      cancelTimer(blinkTimer);
      setIsBlinking(true);
      blinkTimer = later(() => {
        setIsBlinking(false);
        blinkTimer = double ? later(() => blink(false), 180) : null;
      }, currentMood() === "sleepy" ? 180 : 130);
    };
    const scheduleIdle = () => {
      cancelTimer(idleTimer);
      if (paused || reduced) return;
      idleTimer = later(() => {
        const quietFor = performance.now() - lastActivity;
        if (!press && !context.isMoving) {
          if (quietFor > 18000 && context.state === 0) react("sleepy", 2100, EYE_PRIORITY.idle);
          else if (quietFor > 2600) {
            alternateGlance = !alternateGlance;
            resetGaze();
          }
          blink(Math.random() < 0.18);
        }
        scheduleIdle();
      }, 2600 + Math.random() * 3200);
    };

    const resetPointer = () => {
      latestPointer = null;
      previousPosition = null;
      pointerWasNear = false;
      strokes.reset();
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      resetGaze();
    };
    const cancelPress = () => { press = null; resetPointer(); };

    const processPointer = () => {
      frame = null;
      if (paused || !latestPointer) return;
      // One layout read per frame, irrespective of pointer event frequency.
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const now = performance.now();
      const { x, y } = latestPointer;
      const dx = x - rect.left - rect.width / 2;
      const dy = y - rect.top - rect.height / 2;
      const distance = Math.hypot(dx, dy);
      const moveDistance = previousPosition ? Math.hypot(rect.left - previousPosition.x, rect.top - previousPosition.y) : 0;
      previousPosition = { x: rect.left, y: rect.top };
      const dragging = context.isMoving || moveDistance > 1.2;
      if (dragging) {
        strokes.reset();
        if (moveDistance > 12 && now >= nextMoveAt) {
          react("surprised", 1200, EYE_PRIORITY.surprise);
          nextMoveAt = now + 1700;
        }
      } else {
        const overOrb = distance < Math.min(rect.width, rect.height) * 0.48;
        if (overOrb && now >= nextPetAt) {
          if (strokes.sample(x, now, Math.max(4, rect.width * 0.045))) {
            react("happy", 1800, EYE_PRIORITY.affection);
            nextPetAt = now + 2600;
          }
        } else strokes.reset();
      }
      const near = distance < Math.max(60, rect.width * 0.75);
      if (near && !pointerWasNear && !dragging && now >= nextAttentionAt && context.state === 0) {
        react("curious", 850, EYE_PRIORITY.attention);
        nextAttentionAt = now + 5000;
      }
      pointerWasNear = near;
      if (!reduced && canBlink(currentMood()) && distance < 700) writeGaze(pointerGaze(dx, dy));
      else resetGaze();
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.isPrimary === false || paused) return;
      if (press && event.pointerId !== press.id) return;
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.moved = true;
      latestPointer = { x: event.clientX, y: event.clientY };
      lastActivity = performance.now();
      if (frame === null) frame = requestAnimationFrame(processPointer);
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.isPrimary === false || paused || press) return;
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), moved: false };
      lastActivity = performance.now();
      strokes.reset();
    };
    const pointerUp = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return;
      const tap = !press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 6
        && performance.now() - press.at < 700 && !context.isMoving;
      press = null;
      if (tap) react("content", 1100, EYE_PRIORITY.affection);
    };
    const pointerCancel = (event: PointerEvent) => {
      if (!press || event.pointerId === press.id) cancelPress();
    };
    const pointerLeave = () => {
      // Pointer capture belongs to the existing drag code; never release it here.
      if (!press) resetPointer();
    };
    const pointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) pointerLeave();
    };
    const keyClick = (event: MouseEvent) => {
      if (event.detail === 0) {
        lastActivity = performance.now();
        react("content", 1100, EYE_PRIORITY.affection);
      }
    };

    const customEvent = (event: Event) => {
      // A host event may bubble to window. Handle it once, only on its own orb.
      if (event.currentTarget === window && event.target !== window) return;
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      const data = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
      lastActivity = performance.now();
      if (event.type === "orb:mood") {
        if (isEyeMood(data.mood)) react(data.mood, typeof data.duration === "number" ? data.duration : 1600, EYE_PRIORITY.explicit);
      } else if (performance.now() >= nextMoveAt) {
        react("happy", 1400, EYE_PRIORITY.movement);
        nextMoveAt = performance.now() + 1800;
      }
    };
    const updateVisibility = () => {
      paused = document.hidden || !inView || host.dataset.animation === "suspended";
      container.dataset.paused = String(paused);
      if (paused) {
        cancelPress();
        cancelTimer(idleTimer);
        cancelTimer(blinkTimer);
        setIsBlinking(false);
        reactions.reset();
      } else {
        lastActivity = performance.now();
        scheduleIdle();
      }
    };
    const motionPreference = () => {
      reduced = media.matches || host.dataset.motion === "off";
      container.dataset.reducedMotion = String(reduced);
      cancelTimer(blinkTimer);
      setIsBlinking(false);
      resetGaze();
      scheduleIdle();
    };
    const runtime: EyeRuntime = {
      update: (next) => {
        const before = context;
        context = { ...next, mood: isEyeMood(next.mood) ? next.mood : undefined };
        if (context.mood !== before.mood) reactions.reset();
        if (context.state !== before.state) {
          lastActivity = performance.now();
          if (reactions.mood === "sleepy" || reactions.mood === "curious") reactions.reset();
          // Activity transitions, not sentiment guesses from streamed text.
          if (context.state === 0 && (before.state === 2 || before.state === 3)) react("content", 1300, EYE_PRIORITY.settle);
          blink();
        }
        if (context.isMoving && !before.isMoving) {
          react("happy", 1400, EYE_PRIORITY.movement);
          nextMoveAt = performance.now() + 1800;
        }
        resetGaze();
      },
    };
    runtimeRef.current = runtime;
    setReaction("normal");
    setIsBlinking(false);
    container.dataset.reducedMotion = String(reduced);
    const passive = { passive: true };
    const eventNames = ["orb:mood", "orb:spin", "orb:move"] as const;
    for (const name of eventNames) {
      host.addEventListener(name, customEvent, passive);
      window.addEventListener(name, customEvent, passive);
    }
    host.addEventListener("pointerdown", pointerDown, passive);
    host.addEventListener("click", keyClick, passive);
    window.addEventListener("pointermove", pointerMove, passive);
    window.addEventListener("pointerup", pointerUp, passive);
    window.addEventListener("pointercancel", pointerCancel, passive);
    window.addEventListener("pointerleave", pointerLeave, passive);
    window.addEventListener("pointerout", pointerOut, passive);
    window.addEventListener("blur", cancelPress);
    document.addEventListener("visibilitychange", updateVisibility);
    media.addEventListener("change", motionPreference);
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(([entry]) => {
      if (!entry || entry.isIntersecting === inView) return;
      inView = entry.isIntersecting;
      updateVisibility();
    }) : null;
    observer?.observe(host);
    // Read the desktop renderer's EXISTING policy attributes. No new IPC/event contract.
    const policyObserver = new MutationObserver(() => {
      if ((media.matches || host.dataset.motion === "off") !== reduced) motionPreference();
      if ((document.hidden || !inView || host.dataset.animation === "suspended") !== paused) updateVisibility();
    });
    policyObserver.observe(host, { attributes: true, attributeFilter: ["data-motion", "data-animation"] });
    updateVisibility();
    resetGaze();
    return () => {
      active = false;
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      reactions.dispose();
      observer?.disconnect();
      policyObserver.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const name of eventNames) {
        host.removeEventListener(name, customEvent);
        window.removeEventListener(name, customEvent);
      }
      host.removeEventListener("pointerdown", pointerDown);
      host.removeEventListener("click", keyClick);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("pointerleave", pointerLeave);
      window.removeEventListener("pointerout", pointerOut);
      window.removeEventListener("blur", cancelPress);
      document.removeEventListener("visibilitychange", updateVisibility);
      media.removeEventListener("change", motionPreference);
    };
  }, [hostRef]);

  useEffect(() => {
    runtimeRef.current?.update({ state, isMoving, mood: externalMood });
  }, [state, isMoving, externalMood, hostRef]);

  const mood = isEyeMood(externalMood) ? externalMood : reaction === "normal" ? restingMood(state) : reaction;
  return { containerRef, faceRef, leftPupilRef, rightPupilRef, mood, isBlinking };
}
