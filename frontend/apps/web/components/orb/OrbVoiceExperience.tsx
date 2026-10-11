"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Captions, SlidersHorizontal, ArrowUp, AudioLines } from "lucide-react";
import { ORB_THEMES } from "../../lib/orbTheme";
import { OrbVisual } from "./OrbVisual";
import { useOrbVoice } from "./hooks/useOrbVoice";
import { useOrbTheme } from "./hooks/useOrbTheme";
import { ORB_LABELS } from "./core/orb-model";
import type { SendVoicePrompt } from "./core/voice-session";
import styles from "./Orb.module.css";
interface OrbVoiceExperienceProps {
  size?: number;
  onPrompt: SendVoicePrompt;
  onStopStreaming?: () => void;
  onStateChange?: (state: number) => void;
  activeState?: number;
  orbTheme?: number;
  onOrbThemeChange?: (index: number) => void;
  showControls?: boolean;
  activeTool?: {
    name: string;
    status: "start" | "done" | "error";
  } | null;
  onEndCall?: () => void;
}
function CallClock({ startedAt }: {
  startedAt: number | null;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (startedAt === null)
      return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const seconds = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  return <span className={styles.callClock} aria-label="Call duration">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>;
}
export function OrbVoiceExperience({ size = 320, onPrompt, onStopStreaming, onStateChange, orbTheme, onOrbThemeChange, showControls = true, activeTool, onEndCall, }: OrbVoiceExperienceProps) {
  const { session, snapshot } = useOrbVoice({ onPrompt, onStopStreaming });
  const { theme, selectTheme } = useOrbTheme(orbTheme, onOrbThemeChange);
  const [captions, setCaptions] = useState(true);
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const id = useId();
  const state = snapshot.state;
  const status = snapshot.requesting ? "Connecting microphone…" : snapshot.micMuted ? "Microphone muted" : snapshot.error ? "Let’s try that again" : snapshot.callActive ? ORB_LABELS[state] : "Here when you’re ready";
  const action = snapshot.requesting ? "Cancel microphone request" : state === 1 ? "Send voice prompt" : state === 2 || state === 3 ? "Interrupt and listen" : "Start voice call";
  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);
  useEffect(() => {
    if (nearBottom.current && transcriptRef.current)
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [snapshot.turns, snapshot.transcript, captions]);
  const endCall = () => { session.endCall(); onEndCall?.(); };
  return (<section className={styles.experience} data-call-active={snapshot.callActive}>

    <div className={styles.callMeta}>

      <span className={styles.callPill}>
        <span className={styles.statusDot} data-state={snapshot.callActive ? state : 0} />
        {snapshot.callActive ? "VOICE CALL" : "AEVORA VOICE"}
      </span>

      <CallClock startedAt={snapshot.startedAt} />

      <button
        type="button"
        className={styles.iconButton}
        onClick={() => setSettings(!settings)}
        aria-expanded={settings}
        aria-controls={`${id}-settings`}
        aria-label="Voice and orb settings">
        <SlidersHorizontal size={17} aria-hidden="true" />
      </button>

    </div>

    {settings && (<div id={`${id}-settings`} className={styles.callSettings}>

      <label htmlFor={`${id}-voice`}>Voice <select
        id={`${id}-voice`}
        value={snapshot.selectedVoice}
        onChange={(event) => session.selectVoice(event.target.value)}
        disabled={!snapshot.voices.length}>

        {!snapshot.voices.length && <option value="">System voice — when available</option>}

        {snapshot.voices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}

      </select></label>

      <div className={styles.themes} role="group" aria-label="Original orb color themes">

        {ORB_THEMES.map((item, index) => <button
          key={item.id}
          type="button"
          className={styles.themePill}
          aria-pressed={theme === index}
          onClick={() => selectTheme(index)}>
          <span className={styles.themeDot} style={{ background: item.barGrad }} />
          {item.name}
        </button>)}

      </div>

      <p>Voice availability and sound depend on your browser and installed voices.</p>

    </div>)}

    <div className={styles.callLayout} data-captions={captions}>

      <div className={styles.callStage}>

        <div className={styles.stageHeading}>
          <span>Your space to talk</span>
          <h3>Aevora</h3>
        </div>

        <OrbVisual
          size={size}
          state={state}
          theme={theme}
          signal={session.signal}
          onActivate={session.interact}
          label={action}
          showWaveform />

        <div className={styles.status} role="status" aria-live="polite" aria-atomic="true">
          {status}
        </div>

        <p className={styles.description}>
          {snapshot.requesting ? "Your microphone is only used after you allow access." : snapshot.micMuted ? "You can still hear replies. Unmute whenever you’re ready." : state === 1 ? "I’m listening. Take your time." : state === 2 ? "A moment to think. Tap the orb to interrupt." : state === 3 ? "Tap the orb to jump in with a new thought." : snapshot.callActive ? "The conversation stays open between replies." : "A conversation, not a command. Start a call and speak naturally."}
        </p>

        {activeTool && <p className={styles.toolStatus}>
          {activeTool.status === "start" ? "Working with" : activeTool.status === "error" ? "Could not complete" : "Finished"}
          {activeTool.name}
        </p>}

        {snapshot.error && <p className={styles.error} role="alert">
          {snapshot.error}
        </p>}

        {!snapshot.recognitionSupported && <p className={styles.supportNote}>Voice recognition is not available in this browser or desktop webview. Use the text field, or open the web app in a supported browser. No microphone is running.</p>}

      </div>

      {captions && (<aside className={styles.captionPanel} aria-label="Call transcript">

        <header>
          <span><Captions size={16} aria-hidden="true" /> Live transcript</span>
          <span className={styles.captionTag}>THIS CALL</span>
        </header>

        <div
          ref={transcriptRef}
          className={styles.captionScroll}
          onScroll={(event) => { const node = event.currentTarget; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64; }}>

          {snapshot.turns.length === 0 && !snapshot.transcript && <div className={styles.captionEmpty}>
            <AudioLines size={25} aria-hidden="true" />
            <strong>A little more present.</strong>
            <p>Your words and Aevora’s replies appear here as you talk.</p>
            <span>AI voice assistant · You’re in control</span>
          </div>}

          {snapshot.turns.map((turn) => <div key={turn.id} className={styles.captionTurn} data-role={turn.role}>
            <span>
              {turn.role === "user" ? "You" : "Aevora"}
            </span>
            <p>
              {turn.text}
            </p>
          </div>)}

          {state === 1 && snapshot.transcript && <div className={styles.captionTurn} data-role="user" data-interim="true">
            <span>You · speaking</span>
            <p>
              {snapshot.transcript}
            </p>
          </div>}

          {state === 2 && !snapshot.response && <div className={styles.captionThinking}>Aevora is thinking<span>···</span></div>}

        </div>

        <form
          className={styles.captionForm}
          onSubmit={(event) => {
            event.preventDefault(); if (draft.trim()) {
              void session.send(draft);
              setDraft("");
            }
          }}>

          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Type a message during the call"
            placeholder="Or type a thought…" />

          <button
            type="submit"
            className={styles.iconButton}
            aria-label="Send typed message"
            disabled={!draft.trim() || snapshot.streaming}>
            <ArrowUp size={17} aria-hidden="true" />
          </button>

        </form>

      </aside>)}

    </div>

    {showControls && (<div className={styles.callControls}>

      <div className={styles.controlWithLabel}>
        <button
          type="button"
          className={styles.control}
          onClick={() => session.setMicMuted(!snapshot.micMuted)}
          aria-pressed={snapshot.micMuted}
          disabled={!snapshot.callActive}
          aria-label={snapshot.micMuted ? "Unmute microphone" : "Mute microphone"}>
          {snapshot.micMuted ? <MicOff size={21} aria-hidden="true" /> : <Mic size={21} aria-hidden="true" />}
        </button>
        <span>Microphone</span>
      </div>

      <div className={styles.controlWithLabel}>
        <button
          type="button"
          className={styles.control}
          onClick={() => session.setMuted(!snapshot.muted)}
          aria-pressed={snapshot.muted}
          aria-label={snapshot.muted ? "Unmute spoken replies" : "Mute spoken replies"}>
          {snapshot.muted ? <VolumeX size={21} aria-hidden="true" /> : <Volume2 size={21} aria-hidden="true" />}
        </button>
        <span>Speaker</span>
      </div>

      <div className={styles.controlWithLabel}>
        {snapshot.callActive || snapshot.requesting ? <button type="button" className={styles.endCall} onClick={endCall} aria-label="End voice call">
          <PhoneOff size={23} aria-hidden="true" />
        </button> : <button
          type="button"
          className={styles.startCall}
          onClick={() => { void session.startCall(); }}
          disabled={!snapshot.recognitionSupported}
          aria-label="Start voice call">
          <Phone size={22} aria-hidden="true" />
        </button>}
        <span>
          {snapshot.callActive || snapshot.requesting ? "End call" : "Start call"}
        </span>
      </div>

      <div className={styles.controlWithLabel}>
        <button
          type="button"
          className={styles.control}
          onClick={() => setCaptions(!captions)}
          aria-pressed={captions}
          aria-label="Toggle live transcript">
          <Captions size={21} aria-hidden="true" />
        </button>
        <span>Captions</span>
      </div>

    </div>)}

    <p className={styles.callPrivacy}>Microphone {state === 1 ? "on" : "off"} · {snapshot.callActive ? "Hands-free between replies" : "Nothing is recorded until you start"}</p>

  </section>);
}
