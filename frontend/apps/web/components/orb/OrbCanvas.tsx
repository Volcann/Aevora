"use client";

import { useCallback } from "react";
import { api } from "../../lib/api";
import type { OrbThemeItem } from "../../lib/orbTheme";
import { OrbVisual } from "./OrbVisual";
import { OrbVoiceExperience } from "./OrbVoiceExperience";
import { useOrbTheme } from "./hooks/useOrbTheme";
import { toOrbState } from "./core/orb-model";
import type { SendVoicePrompt } from "./core/voice-session";

export type OrbTheme = OrbThemeItem;
export interface OrbCanvasProps {
  size?: number;
  activeState?: number;
  onStateChange?: (state: number) => void;
  onVoicePrompt?: SendVoicePrompt;
  onStopStreaming?: () => void;
  sessionId?: string | null;
  className?: string;
  showControls?: boolean;
  orbTheme?: number;
  onOrbThemeChange?: (themeIndex: number) => void;
  onClick?: () => void;
}

/** Keeps the original public component API; backend endpoints and payloads are unchanged. */
export function OrbCanvas({
  size = 280, activeState, onStateChange, onVoicePrompt, onStopStreaming,
  sessionId = null, className = "", showControls = true, orbTheme, onOrbThemeChange, onClick,
}: OrbCanvasProps) {
  const { theme } = useOrbTheme(orbTheme, onOrbThemeChange);
  const sendDirect = useCallback<SendVoicePrompt>(async (prompt, options) => {
    let failure: Error | null = null;
    await api.streamChat(sessionId, prompt, {
      onChunk: (chunk) => options?.onChunk?.(chunk),
      onDone: options?.onDone,
      onError: (error) => { failure = error; },
    }, options?.signal, { voiceMode: true });
    if (failure) throw failure;
  }, [sessionId]);

  // Welcome/launcher orbs are purely visual: no hidden speech engine, microphone,
  // transcript or voice callback can interfere with the open modal.
  if (onClick) {
    return <OrbVisual size={size} state={toOrbState(activeState)} theme={theme} onActivate={onClick} label="Open voice mode" className={className} />;
  }
  return (
    <div className={className}>
      <OrbVoiceExperience size={size} onPrompt={onVoicePrompt ?? sendDirect} onStopStreaming={onStopStreaming} onStateChange={onStateChange} activeState={activeState} orbTheme={orbTheme} onOrbThemeChange={onOrbThemeChange} showControls={showControls} />
    </div>
  );
}
