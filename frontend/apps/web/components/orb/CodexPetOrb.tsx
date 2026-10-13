"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Mic, MicOff, Volume2, VolumeX, Radio, Send, Minimize2, ExternalLink, Maximize2, Square, HelpCircle } from "lucide-react";
import { openDesktopPet } from "../../lib/desktopPet";
import { OrbVisual } from "./OrbVisual";
import { useOrbTheme } from "./hooks/useOrbTheme";
import { useOrbVoice } from "./hooks/useOrbVoice";
import { ORB_LABELS } from "./core/orb-model";
import type { SendVoicePrompt } from "./core/voice-session";
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
  const drag = useRef<{ x: number; y: number; origin: Position; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const { session, snapshot } = useOrbVoice({ onPrompt: onSendPrompt, onStopStreaming });
  const { theme } = useOrbTheme();
  const state = snapshot.state || (isStreaming ? 2 : 0);
  useEffect(() => {
    let initial = { x: window.innerWidth - 100, y: window.innerHeight - 110 };
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("aevora_pet_pos") ?? "null");
      if (stored && typeof stored === "object" && "x" in stored && "y" in stored && typeof stored.x === "number" && typeof stored.y === "number") initial = { x: stored.x, y: stored.y };
    } catch { /* Invalid or unavailable storage does not hide the pet. */ }
    // Position belongs to the viewport, an external system.
    const resize = () => setPosition((previous) => constrain(previous ?? initial));
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", resize);
    };
  }, []);
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !position) return;
    drag.current = { x: event.clientX, y: event.clientY, origin: position, moved: false };
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
    if (current.moved) setPosition(constrain({ x: current.origin.x + dx, y: current.origin.y + dy }));
  };
  const endDrag = (event?: PointerEvent<HTMLDivElement>) => {
    if (event && event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    }
    suppressClick.current = drag.current?.moved ?? false;
    drag.current = null;
    if (position) {
      try { localStorage.setItem("aevora_pet_pos", JSON.stringify(position)); } catch { /* Optional persistence. */ }
    }
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
          <p className={styles.petMessage}>{snapshot.error || snapshot.response || snapshot.transcript || streamingMessage || "Ask a question, or tap the microphone to talk."}</p>
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
      <div className={styles.petHandle} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <OrbVisual size={80} state={state} theme={theme} signal={session.signal} label={expanded ? "Minimize voice companion" : "Open voice companion"} onActivate={() => {
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
