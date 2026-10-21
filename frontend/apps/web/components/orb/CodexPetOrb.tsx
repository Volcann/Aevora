"use client";

import { useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Radio, Send, Minimize2, ExternalLink, Maximize2, Square, HelpCircle } from "lucide-react";
import { openDesktopPet } from "../../lib/desktopPet";
import { PlayfulOrb } from "./playful/OrbPlayLayer";
import { OrbPlayControls } from "./playful/OrbPlayControls";
import { useScreenCompanion } from "./playful/useScreenCompanion";
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
function VisiblePet({ onOpenFullVoiceModal, onSendPrompt, onStopStreaming, onDetachToDesktop, isStreaming, streamingMessage, activeTool }: CodexPetOrbProps) {
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [detachError, setDetachError] = useState<string | null>(null);
  const { position, isDragging, petRef, handleRef, handlers, consumeDrag, home } = useScreenCompanion(expanded);
  const { session, snapshot } = useOrbVoice({ onPrompt: onSendPrompt, onStopStreaming });
  const { theme } = useOrbTheme();
  const state = snapshot.state || (isStreaming ? 2 : 0);
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
  const panelWidth = Math.min(320, window.innerWidth - 16);
  const above = Math.max(80, position.y - 14);
  const below = Math.max(80, window.innerHeight - position.y - 94);
  const panelStyle = {
    left: Math.max(8 - position.x, Math.min(0, window.innerWidth - position.x - panelWidth - 8)),
    ...(below > above ? { top: 88, bottom: "auto", maxHeight: below } : { bottom: 88, maxHeight: above }),
  };
  return (
    <aside ref={petRef} className={styles.pet} aria-label="Aevora voice companion" style={{ left: position.x, top: position.y }} onKeyDown={event => { if (event.key === "Escape") setExpanded(false); }}>
      {expanded && (
        <section className={styles.petPanel} style={panelStyle}>
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
          <OrbPlayControls compact onHome={home} />
        </section>
      )}
      <div
        ref={handleRef}
        className={styles.petHandle}
        {...handlers}
        title="Drag to move · Toss to play · Click to open · Arrow keys to move · Home to reset"
      >
        <PlayfulOrb streaming={snapshot.streaming || !!isStreaming} response={snapshot.response || streamingMessage || ""} paused={isDragging} size={80} state={state} theme={theme} signal={session.signal} isMoving={isDragging} label={expanded ? "Minimize voice companion" : "Open voice companion"} onActivate={() => {
          if (!consumeDrag()) setExpanded((value) => !value);
        }} />
      </div>
    </aside>
  );
}
export function CodexPetOrb(props: CodexPetOrbProps) {
  return props.isVisible ? <VisiblePet {...props} /> : null;
}
