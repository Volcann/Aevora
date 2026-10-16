"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Mic, MicOff, Volume2, VolumeX, Radio, Send, Minimize2, ExternalLink, Maximize2, Square, HelpCircle } from "lucide-react";
import { openDesktopPet } from "../../lib/desktopPet";
import { OrbVisual } from "./OrbVisual";
import { useOrbTheme } from "./hooks/useOrbTheme";
import { useOrbVoice } from "./hooks/useOrbVoice";
import { ORB_LABELS } from "./core/orb-model";
import type { SendVoicePrompt } from "./core/voice-session";
import { CompanionMarkdown } from "../chat/CompanionMarkdown";
import styles from "./Orb.module.css";

export interface CodexPetOrbProps {
  isVisible: boolean;
  onToggleVisible: () => void;
  onOpenFullVoiceModal?: () => void;
  onDetachToDesktop?: () => Promise<void> | void;
  onSendPrompt: SendVoicePrompt;
  onStopStreaming?: () => void;
  isStreaming?: boolean;
  streamingMessage?: string;
  activeTool?: { name: string; status: "start" | "done" | "error" } | null;
}
interface Position { x: number; y: number }
function constrain(position: Position): Position {
  return {
    x: Math.max(8, Math.min(window.innerWidth - 88, Number.isFinite(position.x) ? position.x : window.innerWidth - 100)),
    y: Math.max(8, Math.min(window.innerHeight - 88, Number.isFinite(position.y) ? position.y : window.innerHeight - 110)),
  };
}
function VisiblePet({ onOpenFullVoiceModal, onSendPrompt, onStopStreaming, onDetachToDesktop, isStreaming, streamingMessage, activeTool }: CodexPetOrbProps) {
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [detachError, setDetachError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; origin: Position; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const petHandleRef = useRef<HTMLDivElement>(null);
  const flingRef = useRef<number | null>(null);
  const dragVelocity = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const recentMoves = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const { session, snapshot } = useOrbVoice({ onPrompt: onSendPrompt, onStopStreaming });
  const { theme } = useOrbTheme();
  const state = snapshot.state || (isStreaming ? 2 : 0);
  useEffect(() => {
    let initial = { x: window.innerWidth - 100, y: window.innerHeight - 110 };
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("aevora_pet_pos") ?? "null");
      if (stored && typeof stored === "object" && "x" in stored && "y" in stored && typeof stored.x === "number" && typeof stored.y === "number") initial = { x: stored.x, y: stored.y };
    } catch { /* Invalid or unavailable storage does not hide the pet. */ }
    const resize = () => setPosition((previous) => constrain(previous ?? initial));
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", resize);
      if (flingRef.current) cancelAnimationFrame(flingRef.current);
    };
  }, []);
  const lastDragPos = useRef<{ x: number; y: number } | null>(null);

  const startFling = (startPos: Position, initialVx: number, initialVy: number) => {
    let currX = startPos.x;
    let currY = startPos.y;
    let vx = initialVx * 1.05;
    let vy = initialVy * 1.05;

    const orbHost = petHandleRef.current?.querySelector("[data-renderer]");
    orbHost?.dispatchEvent(new CustomEvent("orb:mood", { detail: { mood: "surprised", duration: 1800 } }));

    const loop = () => {
      currX += vx;
      currY += vy;
      vx *= 0.94;
      vy *= 0.94;

      const minX = 8;
      const maxX = window.innerWidth - 88;
      const minY = 8;
      const maxY = window.innerHeight - 88;

      let hitWall = false;
      if (currX <= minX) {
        currX = minX;
        vx = -vx * 0.72;
        hitWall = true;
      } else if (currX >= maxX) {
        currX = maxX;
        vx = -vx * 0.72;
        hitWall = true;
      }

      if (currY <= minY) {
        currY = minY;
        vy = -vy * 0.72;
        hitWall = true;
      } else if (currY >= maxY) {
        currY = maxY;
        vy = -vy * 0.72;
        hitWall = true;
      }

      if (hitWall) {
        orbHost?.dispatchEvent(new CustomEvent("orb:mood", { detail: { mood: "happy", duration: 1200 } }));
        if (petHandleRef.current) {
          petHandleRef.current.style.setProperty("--ball-squish-x", "1.22");
          petHandleRef.current.style.setProperty("--ball-squish-y", "0.82");
          setTimeout(() => {
            if (petHandleRef.current) {
              petHandleRef.current.style.setProperty("--ball-squish-x", "1");
              petHandleRef.current.style.setProperty("--ball-squish-y", "1");
            }
          }, 140);
        }
      }

      const nextPos = { x: currX, y: currY };
      setPosition(nextPos);

      if (Math.hypot(vx, vy) > 0.35) {
        flingRef.current = requestAnimationFrame(loop);
      } else {
        try { localStorage.setItem("aevora_pet_pos", JSON.stringify(nextPos)); } catch {}
        orbHost?.dispatchEvent(new CustomEvent("orb:mood", { detail: { mood: "happy", duration: 1500 } }));
        flingRef.current = null;
      }
    };

    if (flingRef.current) cancelAnimationFrame(flingRef.current);
    flingRef.current = requestAnimationFrame(loop);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !position) return;
    if (flingRef.current) {
      cancelAnimationFrame(flingRef.current);
      flingRef.current = null;
    }
    drag.current = { x: event.clientX, y: event.clientY, origin: position, moved: false };
    lastDragPos.current = { x: event.clientX, y: event.clientY };
    recentMoves.current = [{ x: event.clientX, y: event.clientY, time: performance.now() }];
    dragVelocity.current = { vx: 0, vy: 0 };
    suppressClick.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      event.currentTarget.querySelector("button")?.setPointerCapture(event.pointerId);
    }
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    current.moved ||= Math.hypot(dx, dy) > 5;
    if (current.moved) {
      if (!isDragging) setIsDragging(true);
      setPosition(constrain({ x: current.origin.x + dx, y: current.origin.y + dy }));
      const now = performance.now();
      recentMoves.current.push({ x: event.clientX, y: event.clientY, time: now });
      recentMoves.current = recentMoves.current.filter((m) => now - m.time < 110);
      if (recentMoves.current.length >= 2) {
        const oldest = recentMoves.current[0];
        const dt = Math.max(10, now - oldest.time);
        dragVelocity.current = {
          vx: (event.clientX - oldest.x) / dt * 16,
          vy: (event.clientY - oldest.y) / dt * 16,
        };
      }
      const prev = lastDragPos.current;
      if (prev) {
        const stepX = event.clientX - prev.x;
        const stepY = event.clientY - prev.y;
        const orbHost = event.currentTarget.querySelector("[data-renderer]");
        if (orbHost) {
          orbHost.dispatchEvent(new CustomEvent("orb:spin", { detail: { dx: stepX, dy: stepY } }));
          orbHost.dispatchEvent(new CustomEvent("orb:move", { detail: { dx: stepX, dy: stepY } }));
        }
      }
      lastDragPos.current = { x: event.clientX, y: event.clientY };
    }
  };
  const endDrag = (event?: PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    lastDragPos.current = null;
    if (event && event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    }
    const speed = Math.hypot(dragVelocity.current.vx, dragVelocity.current.vy);
    if (drag.current?.moved && speed > 3.5 && position) {
      suppressClick.current = true;
      startFling(position, dragVelocity.current.vx, dragVelocity.current.vy);
    } else {
      suppressClick.current = drag.current?.moved ?? false;
      if (position) {
        try { localStorage.setItem("aevora_pet_pos", JSON.stringify(position)); } catch { /* Optional persistence. */ }
      }
    }
    drag.current = null;
  };
  const send = () => {
    if (!prompt.trim() || snapshot.streaming) return;
    void session.send(prompt);
    setPrompt("");
  };
  const detach = async () => {
    session.stop();
    setExpanded(false);
    setDetachError(null);
    try {
      if (onDetachToDesktop) await onDetachToDesktop();
      else if (!(await openDesktopPet(position ?? undefined))) throw new Error("The desktop companion could not be opened.");
    } catch (error) {
      setDetachError(error instanceof Error ? error.message : "The desktop companion could not be opened.");
      setExpanded(true);
    }
  };
  if (!position) return null;
  return (
    <aside className={styles.pet} aria-label="Aevora voice companion" style={{ left: position.x, top: position.y }}>
      {expanded && (
        <section className={styles.petPanel} style={{ left: Math.max(8 - position.x, Math.min(0, window.innerWidth - position.x - Math.min(320, window.innerWidth - 16) - 8)), ...(position.y < 330 ? { top: 88, bottom: "auto" } : {}) }}>
          <header className={styles.petHeader}>
            <strong>Aevora companion</strong>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Minimize companion" className={styles.control}><Minimize2 size={15} aria-hidden="true" /></button>
          </header>
          <p className={styles.petStatus} role="status">{snapshot.requesting ? "Waiting for microphone permission" : ORB_LABELS[state]}</p>
          {activeTool && <p className={styles.toolStatus}>{activeTool.status === "start" ? "Using" : "Tool:"} {activeTool.name}</p>}
          <div className={styles.petMessage} style={{ whiteSpace: "normal" }}>
            <CompanionMarkdown content={snapshot.error || snapshot.response || snapshot.transcript || streamingMessage || "Ask a question, or tap the microphone to talk."} isStreaming={!snapshot.error && (snapshot.streaming || !!isStreaming)} />
          </div>
          {snapshot.error && <span className="sr-only" role="alert">{snapshot.error}</span>}
          {detachError && <p className={styles.error} role="alert">{detachError}</p>}
          <form className={styles.petForm} onSubmit={(event) => { event.preventDefault(); send(); }}>
            <input aria-label="Message to companion" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask anything…" />
            <button type="submit" className={styles.control} disabled={!prompt.trim() || snapshot.streaming} aria-label="Send to companion"><Send size={16} aria-hidden="true" /></button>
          </form>
          <div className={styles.petControls}>
            <button type="button" className={styles.control} onClick={session.interact} aria-label={snapshot.state === 1 ? "Send voice prompt" : "Talk to companion"}>{snapshot.state === 1 ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}</button>
            <button type="button" className={styles.control} onClick={session.stop} aria-label="Stop companion voice"><Square size={15} aria-hidden="true" /></button>
            <button type="button" className={styles.control} onClick={() => session.setMuted(!snapshot.muted)} aria-label={snapshot.muted ? "Unmute companion" : "Mute companion"} aria-pressed={snapshot.muted}>{snapshot.muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}</button>
            <button type="button" className={styles.control} onClick={() => session.setContinuous(!snapshot.continuous)} aria-label="Continuous companion conversation" aria-pressed={snapshot.continuous}><Radio size={16} aria-hidden="true" /></button>
            <button type="button" className={styles.control} disabled={snapshot.streaming} onClick={() => { void session.send("Give me a quick, clever coding tip or best practice for modern software engineering in 1-2 concise sentences."); }} aria-label="Quick coding tip"><HelpCircle size={16} aria-hidden="true" /></button>
            {onOpenFullVoiceModal && <button type="button" className={styles.control} onClick={() => { session.stop(); setExpanded(false); onOpenFullVoiceModal(); }} aria-label="Open full voice mode"><Maximize2 size={16} aria-hidden="true" /></button>}
            <button type="button" className={styles.control} onClick={() => { void detach(); }} aria-label="Detach companion to desktop"><ExternalLink size={16} aria-hidden="true" /></button>
          </div>

        </section>
      )}
      <div
        ref={petHandleRef}
        className={styles.petHandle}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Drag to move · Click to open companion"
      >
        <OrbVisual size={80} state={state} theme={theme} signal={session.signal} isMoving={isDragging} label={expanded ? "Minimize voice companion" : "Open voice companion"} onActivate={() => {
          if (!suppressClick.current) setExpanded((value) => !value);
          suppressClick.current = false;
        }} />
      </div>
    </aside>
  );
}
export function CodexPetOrb(props: CodexPetOrbProps) {
  return props.isVisible ? <VisiblePet {...props} /> : null;
}
