"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { VoiceSession, type VoiceSessionOptions } from "../core/voice-session";

export function useOrbVoice(options: VoiceSessionOptions) {
  // Construction has no side effects; Strict Mode can safely call it twice.
  const [session] = useState(() => new VoiceSession());
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  useEffect(() => { session.configure(options); }, [session, options]);
  useEffect(() => {
    session.attach();
    return () => session.detach();
  }, [session]);
  return { session, snapshot };
}
