"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { TextSession, type TextSessionOptions } from "../lib/text-session";

export function useTextChat(options: TextSessionOptions) {
  const [session] = useState(() => new TextSession(options));
  useEffect(() => { session.updateOptions(options); }, [session, options.onPrompt, options.onStopStreaming]);
  useEffect(() => () => session.stop(), [session]);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return { session, snapshot };
}
