"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, GripHorizontal, Mic, MicOff, Minimize2, Phone, PhoneOff, Pin, PinOff, Volume2, VolumeX, X, MessageCircle } from "lucide-react";
import { api, getSavedTokens } from "../../lib/api";
import { broadcastPetMessage, closeDesktopPet, focusMainWindow, isTauriApp, resizeDesktopPet, setDesktopPetPinned, startDraggingDesktopPet, subscribeDesktopPetVisibility, nudgeDesktopPet } from "../../lib/desktopPet";
import { OrbVisual } from "../../components/orb/OrbVisual";
import { useOrbTheme } from "../../components/orb/hooks/useOrbTheme";
import { useOrbVoice } from "../../components/orb/hooks/useOrbVoice";
import type { SendVoicePrompt } from "../../components/orb/core/voice-session";
import styles from "../../components/orb/DesktopPet.module.css";
export default function StandaloneDesktopPetPage() {
  const [expanded, setExpanded] = useState(false);
  const [native, setNative] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [draft, setDraft] = useState("");
  const [windowError, setWindowError] = useState<string | null>(null);
  const sessionId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const { theme } = useOrbTheme();
  const send = useCallback<SendVoicePrompt>(async (prompt, options) => {
    if (!getSavedTokens()?.access)
      throw new Error("Sign in to Aevora in the main app first, then return here.");
    let failure: Error | null = null;
    let response = "";
    broadcastPetMessage({ type: "PET_PROMPT_SENT", payload: { prompt } });
    await api.streamChat(sessionId.current, prompt, {
      onSessionCreated: (id) => {
        if (!options?.signal?.aborted)
          sessionId.current = id;
      },
      onChunk: (chunk) => {
        if (options?.signal?.aborted)
          return;
        response += chunk;
        options?.onChunk?.(chunk);
        broadcastPetMessage({ type: "PET_STREAM_CHUNK", payload: chunk });
      },
      onDone: () => {
        if (!options?.signal?.aborted) {
          broadcastPetMessage({ type: "PET_STREAM_DONE", payload: { response, sessionId: sessionId.current } });
          options?.onDone?.();
        }
      },
      onError: (error) => { failure = error; },
    }, options?.signal, { voiceMode: true });
    if (failure)
      throw failure;
  }, []);
  const { session, snapshot } = useOrbVoice({ onPrompt: send });
  useEffect(() => {
    const desktop = isTauriApp();
    setNative(desktop);
    if (!desktop)
      setExpanded(true);
    document.documentElement.classList.add("pet-desktop-window");
    document.body.classList.add("pet-desktop-window");
    const stopOnHide = subscribeDesktopPetVisibility((visible) => {
      if (!visible)
        session.stop();
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        setExpanded(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      stopOnHide();
      window.removeEventListener("keydown", escape);
      document.documentElement.classList.remove("pet-desktop-window");
      document.body.classList.remove("pet-desktop-window");
    };
  }, [session]);
  useEffect(() => {
    let mounted = true;
    void resizeDesktopPet(expanded ? 360 : 168, expanded ? 552 : 190).catch((error: unknown) => {
      if (mounted)
        setWindowError(error instanceof Error ? error.message : "The companion window could not be resized.");
    });
    return () => { mounted = false; };
  }, [expanded]);
  useEffect(() => {
    if (nearBottom.current && scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [snapshot.turns, snapshot.transcript]);
  const close = async () => {
    session.stop();
    try {
      await closeDesktopPet();
    }
    catch (error) {
      setWindowError(error instanceof Error ? error.message : "Could not hide the companion.");
    }
  };
  const togglePinned = async () => {
    try {
      await setDesktopPetPinned(!pinned);
      setPinned(!pinned);
    }
    catch (error) {
      setWindowError(error instanceof Error ? error.message : "Could not change pinning.");
    }
  };
  const runWindowAction = (action: () => Promise<void>) => { void action().catch((error: unknown) => setWindowError(error instanceof Error ? error.message : "Window action failed.")); };
  const status = snapshot.error ? "Needs your attention" : snapshot.requesting ? "Connecting…" : snapshot.micMuted ? "Mic muted" : snapshot.state === 1 ? "Listening to you" : snapshot.state === 2 ? "Thinking it through" : snapshot.state === 3 ? "Speaking with you" : "Here for you";
  return (<main
    className={styles.desktop}
    data-expanded={expanded}
    data-native={native}
    aria-label="Aevora desktop companion">

    {expanded && (<section className={styles.panel} aria-label="Companion conversation">

      <header className={styles.header}>

        <div className={styles.brand}>
          <span className={styles.brandDot} />
          <div>
            <strong>Aevora</strong>
            <span>Your desktop companion</span>
          </div>
        </div>

        <div className={styles.headerActions}>

          {native && <button
            type="button"
            className={styles.icon}
            aria-label={pinned ? "Unpin companion" : "Keep companion on top"}
            aria-pressed={pinned}
            onClick={() => { void togglePinned(); }}>
            {pinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>}

          <button
            type="button"
            className={styles.icon}
            aria-label="Open main chat"
            onClick={() => runWindowAction(focusMainWindow)}>
            <ArrowUpRight size={16} />
          </button>

          <button
            type="button"
            className={styles.icon}
            aria-label="Minimize companion"
            onClick={() => setExpanded(false)}>
            <Minimize2 size={15} />
          </button>

        </div>

      </header>

      <div className={styles.widgetStatus} role="status">
        <span data-state={snapshot.state} />
        {status}
        {snapshot.callActive && <small>CALL ACTIVE</small>}
      </div>

      <div
        ref={scrollRef}
        className={styles.messages}
        onScroll={(event) => { const node = event.currentTarget; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 50; }}>

        {snapshot.turns.length === 0 && !snapshot.transcript && <div className={styles.empty}>
          <MessageCircle size={23} />
          <h1>A little company.<br />A lot of possibility.</h1>
          <p>Ask a question, think out loud, or bring an idea to life.</p>
          <div className={styles.suggestions}>
            <button
              type="button"
              onClick={() => { void session.send("Help me break down my next task into three small, practical steps."); }}>Plan my next step <ArrowUpRight size={13} /></button>
            <button
              type="button"
              onClick={() => { void session.send("Share one useful software engineering idea, in a short and conversational way."); }}>Spark an idea <ArrowUpRight size={13} /></button>
          </div>
        </div>}

        {snapshot.turns.map((turn) => <div key={turn.id} className={styles.turn} data-role={turn.role}>
          <span>
            {turn.role === "user" ? "You" : "Aevora"}
          </span>
          <p>
            {turn.text}
          </p>
        </div>)}

        {snapshot.state === 1 && snapshot.transcript && <div className={styles.turn} data-role="user">
          <span>You · speaking</span>
          <p>
            {snapshot.transcript}
          </p>
        </div>}

        {(snapshot.error || windowError) && <p role="alert" className={styles.error}>
          {snapshot.error || windowError}
        </p>}

      </div>

      {!snapshot.recognitionSupported && <p className={styles.voiceNotice}>This webview does not support speech recognition. Text chat remains available.</p>}

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault(); if (draft.trim() && !snapshot.streaming) {
            void session.send(draft);
            setDraft("");
          }
        }}>
        <input
          aria-label="Message to companion"
          placeholder="What’s on your mind?"
          value={draft}
          onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" aria-label="Send to companion" disabled={!draft.trim() || snapshot.streaming}>
          <ArrowUp size={18} />
        </button>
      </form>

      <footer className={styles.actions}>

        <button
          type="button"
          onClick={() => {
            if (snapshot.callActive)
              session.endCall();
            else
              void session.startCall();
          }}
          className={snapshot.callActive ? styles.hangup : styles.call}
          disabled={!snapshot.recognitionSupported}
          aria-label={snapshot.callActive ? "End companion call" : "Start companion call"}>
          {snapshot.callActive ? <PhoneOff size={15} /> : <Phone size={15} />}
          <span>
            {snapshot.callActive ? "End call" : "Let’s talk"}
          </span>
        </button>

        <button
          type="button"
          className={styles.icon}
          aria-label={snapshot.micMuted ? "Unmute microphone" : "Mute microphone"}
          disabled={!snapshot.callActive}
          onClick={() => session.setMicMuted(!snapshot.micMuted)}>
          {snapshot.micMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <button
          type="button"
          className={styles.icon}
          aria-label={snapshot.muted ? "Unmute replies" : "Mute replies"}
          aria-pressed={snapshot.muted}
          onClick={() => session.setMuted(!snapshot.muted)}>
          {snapshot.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

      </footer>

    </section>)}

    <div className={styles.petDock}>

      <div className={styles.dockToolbar}>

        <button
          type="button"
          className={styles.dragHandle}
          aria-label="Drag companion window"
          title="Drag to move · arrow keys move 16 pixels"
          onPointerDown={(event) => {
            if (event.button === 0)
              runWindowAction(startDraggingDesktopPet);
          }}
          onKeyDown={(event) => {
            const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
            if (delta && native) {
              event.preventDefault();
              runWindowAction(() => nudgeDesktopPet(delta[0] ?? 0, delta[1] ?? 0));
            }
          }}>
          <GripHorizontal size={18} />
        </button>

        <button
          type="button"
          className={styles.close}
          aria-label="Hide desktop companion"
          onClick={() => { void close(); }}>
          <X size={13} />
        </button>

      </div>

      <OrbVisual
        size={expanded ? 76 : 106}
        state={snapshot.state}
        theme={theme}
        signal={session.signal}
        label={snapshot.state === 2 || snapshot.state === 3 ? "Interrupt companion and listen" : expanded ? "Minimize companion chat" : "Open companion chat"}
        onActivate={() => {
          if (snapshot.state === 2 || snapshot.state === 3)
            session.interact();
          else
            setExpanded(!expanded);
        }} />

      {!expanded && <button type="button" className={styles.statusPill} onClick={() => setExpanded(true)}>
        <span data-state={snapshot.state} />
        {status}
      </button>}

    </div>

  </main>);
}
