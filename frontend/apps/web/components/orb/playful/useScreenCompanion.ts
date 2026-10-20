"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { boundPoint, energyScale, flingStep, screenBounds, type Point } from "./playful-model";
import { usePlayPreferences } from "./usePlayPreferences";
import { usePlayEnvironment } from "./usePlayEnvironment";

const POSITION_KEY = "aevora_pet_pos";
const safeSave = (point: Point) => { try { localStorage.setItem(POSITION_KEY, JSON.stringify(point)); } catch { /* Optional persistence. */ } };
interface Drag { id: number; start: Point; origin: Point; last: Point; at: number; velocity: Point; moved: boolean }
/** Main-workspace movement only. Native windows keep their existing drag behavior. */
export function useScreenCompanion(paused: boolean) {
  const { preferences, setPreferences } = usePlayPreferences();
  const { animate } = usePlayEnvironment();
  const petRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const current = useRef<Point>({ x: 8, y: 8 });
  const [position, setPosition] = useState<Point | null>(null);
  const [isDragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const capture = useRef<Element | null>(null);
  const suppressed = useRef(false);
  const fling = useRef<Point | null>(null);
  const latestPointer = useRef<Point | null>(null);
  const pauseUntil = useRef(0);
  const pointerHeld = useRef(false);
  const hovered = useRef(false);
  const animationFrame = useRef<number | null>(null);
  const wake = useRef<() => void>(() => {});

  const bounds = () => screenBounds(window.innerWidth, window.innerHeight);
  // Leave the composer and Send button accessible on compact workspaces.
  const homePoint = () => ({
    x: window.innerWidth - 100,
    y: window.innerHeight - (window.innerWidth <= 600 || window.innerHeight < 500 ? 210 : 110),
  });
  const write = (next: Point) => {
    current.current = boundPoint(next, bounds());
    if (petRef.current) {
      petRef.current.style.left = `${current.current.x}px`;
      petRef.current.style.top = `${current.current.y}px`;
    }
  };
  const commit = () => { setPosition({ ...current.current }); safeSave(current.current); };

  useEffect(() => {
    let initial = homePoint();
    try {
      const stored = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
      if (stored && typeof stored.x === "number" && typeof stored.y === "number") initial = stored;
    } catch { /* Corrupt or blocked storage uses the usual bottom-right position. */ }
    write(initial); commit();
    const resize = () => { write(current.current); commit(); };
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); safeSave(current.current); };
  // The position is initialized once; live state is held in refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mode = preferences.mode;
    const speed = energyScale(preferences.energy);
    let lastAt = 0;
    let lastEyeAt = 0;
    let target = current.current;
    let targetAt = 0;
    let running = true;
    const frame = (now: number) => {
      animationFrame.current = null;
      if (!running || !animate || paused || drag.current) return;
      const dt = lastAt ? Math.min(.04, (now - lastAt) / 1000) : 1 / 60;
      lastAt = now;
      const previous = current.current;
      let next = previous;
      if (fling.current) {
        const result = flingStep(previous, fling.current, dt, bounds());
        next = result.point;
        fling.current = Math.hypot(result.velocity.x, result.velocity.y) > 14 ? result.velocity : null;
        if (result.hit) handleRef.current?.querySelector("[data-renderer]")?.dispatchEvent(new CustomEvent("orb:mood", { detail: { mood: "happy", duration: 900 } }));
      } else if (!pointerHeld.current && !hovered.current && now >= pauseUntil.current) {
        if (mode === "roam") {
          if (now > targetAt || Math.hypot(target.x - previous.x, target.y - previous.y) < 8) {
            const box = bounds();
            target = { x: box.minX + Math.random() * (box.maxX - box.minX), y: box.minY + Math.random() * (box.maxY - box.minY) };
            targetAt = now + 6000;
          }
          const dx = target.x - previous.x, dy = target.y - previous.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const step = Math.min(length, 65 * speed * dt);
          next = { x: previous.x + dx / length * step, y: previous.y + dy / length * step };
        } else if (mode === "follow" && latestPointer.current) {
          const pointer = latestPointer.current;
          const dx = pointer.x - (previous.x + 40), dy = pointer.y - (previous.y + 40);
          const distance = Math.hypot(dx, dy);
          // The orb trails the pointer instead of covering the clicked control.
          if (distance > 135) {
            const step = Math.min((distance - 135) * (1 - Math.exp(-2.8 * dt)), 240 * speed * dt);
            next = { x: previous.x + dx / distance * step, y: previous.y + dy / distance * step };
          }
        }
      }
      if (next !== previous) {
        write(next);
        if (now - lastEyeAt > 90) {
          lastEyeAt = now;
          handleRef.current?.querySelector("[data-renderer]")?.dispatchEvent(new CustomEvent("orb:move", { detail: { dx: next.x - previous.x, dy: next.y - previous.y } }));
        }
      }
      const keepRunning = fling.current || mode === "roam" || (mode === "follow" && latestPointer.current);
      if (keepRunning) animationFrame.current = requestAnimationFrame(frame);
      else commit();
    };
    const start = () => {
      if (animationFrame.current === null && animate && !paused && !drag.current) {
        lastAt = 0; animationFrame.current = requestAnimationFrame(frame);
      }
    };
    wake.current = start;
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "mouse" || mode !== "follow") return;
      latestPointer.current = { x: event.clientX, y: event.clientY };
      start();
    };
    const down = (event: globalThis.PointerEvent) => {
      if (petRef.current?.contains(event.target as Node)) return;
      pointerHeld.current = true;
    };
    const up = () => { pointerHeld.current = false; pauseUntil.current = performance.now() + 700; };
    const typing = (event: globalThis.KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest("input,textarea,[contenteditable='true']")) pauseUntil.current = performance.now() + 2400;
    };
    const leave = () => { latestPointer.current = null; pointerHeld.current = false; };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", up, { passive: true });
    window.addEventListener("blur", leave);
    window.addEventListener("keydown", typing);
    if (!animate || paused) { fling.current = null; commit(); }
    else if (mode === "roam" || mode === "follow") start();
    return () => {
      running = false;
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      wake.current = () => {};
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", leave);
      window.removeEventListener("keydown", typing);
      commit();
    };
  // Imperative movement avoids rerendering the chat or canvas on every frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.mode, preferences.energy, animate, paused]);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
    fling.current = null;
    suppressed.current = false;
    drag.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: current.current, last: { x: event.clientX, y: event.clientY }, at: performance.now(), velocity: { x: 0, y: 0 }, moved: false };
    try {
      capture.current = (event.target as Element).closest("button") ?? event.currentTarget;
      capture.current.setPointerCapture(event.pointerId);
    } catch { /* Lost capture is handled below. */ }
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    const now = performance.now(), elapsed = Math.max(8, now - active.at);
    const dx = event.clientX - active.start.x, dy = event.clientY - active.start.y;
    active.moved ||= Math.hypot(dx, dy) > 5;
    if (active.moved) {
      setDragging(true);
      write({ x: active.origin.x + dx, y: active.origin.y + dy });
      if (paused) setPosition({ ...current.current }); // Keep the open panel anchored while manually dragged.
      active.velocity = {
        x: Math.max(-1600, Math.min(1600, (event.clientX - active.last.x) / elapsed * 1000)),
        y: Math.max(-1600, Math.min(1600, (event.clientY - active.last.y) / elapsed * 1000)),
      };
      const host = handleRef.current?.querySelector("[data-renderer]");
      if (animate) host?.dispatchEvent(new CustomEvent("orb:spin", { detail: { dx: event.clientX - active.last.x, dy: event.clientY - active.last.y } }));
      host?.dispatchEvent(new CustomEvent("orb:move", { detail: { dx, dy } }));
      active.at = now; active.last = { x: event.clientX, y: event.clientY };
    }
  };
  const finishDrag = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    drag.current = null; setDragging(false);
    suppressed.current = active.moved || cancelled;
    try { if (capture.current?.hasPointerCapture(event.pointerId)) capture.current.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
    capture.current = null;
    commit();
    if (!cancelled && active.moved && animate && !paused && performance.now() - active.at < 110 && Math.hypot(active.velocity.x, active.velocity.y) > 180) fling.current = active.velocity;
    pauseUntil.current = performance.now() + 1000;
    wake.current();
  };
  const home = () => {
    fling.current = null;
    latestPointer.current = null;
    setPreferences({ mode: "classic" });
    write(homePoint()); commit();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 16;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (delta) {
      event.preventDefault(); fling.current = null;
      pauseUntil.current = performance.now() + 1600;
      write({ x: current.current.x + delta[0], y: current.current.y + delta[1] }); commit();
    } else if (event.key === "Home") { event.preventDefault(); home(); }
    else if (event.key === "Escape") { fling.current = null; setPreferences({ mode: "classic" }); commit(); }
  };
  return {
    position, isDragging, petRef, handleRef, home,
    consumeDrag: () => { const value = suppressed.current; suppressed.current = false; return value; },
    handlers: { onPointerEnter: () => { hovered.current = true; }, onPointerLeave: () => { hovered.current = false; pauseUntil.current = performance.now() + 300; wake.current(); }, onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: (event: PointerEvent<HTMLDivElement>) => finishDrag(event), onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finishDrag(event, true), onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => finishDrag(event, true), onKeyDown },
  };
}
