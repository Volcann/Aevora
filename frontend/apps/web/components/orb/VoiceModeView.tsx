"use client";

import { X } from "lucide-react";
import { OrbCanvas } from "./OrbCanvas";
import type { SendVoicePrompt } from "./core/voice-session";

interface VoiceModeViewProps {
  onClose: () => void;
  onSendVoicePrompt: SendVoicePrompt;
  onStopStreaming?: () => void;
  isStreaming: boolean;
  streamingMessage: string;
  orbTheme?: number;
  onOrbThemeChange?: (themeIndex: number) => void;
}
export function VoiceModeView({ onClose, onSendVoicePrompt, onStopStreaming, isStreaming, orbTheme, onOrbThemeChange }: VoiceModeViewProps) {
  return (
    <section className="flex-1 overflow-y-auto p-6" aria-label="Voice conversation">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between mb-4">
        <h2 className="font-semibold">Aevora Voice</h2>
        <button type="button" onClick={onClose} aria-label="Return to chat" className="rounded-lg p-2 hover:bg-surface"><X size={20} aria-hidden="true" /></button>
      </div>
      <OrbCanvas size={270} activeState={isStreaming ? 2 : undefined} onVoicePrompt={onSendVoicePrompt} onStopStreaming={onStopStreaming} orbTheme={orbTheme} onOrbThemeChange={onOrbThemeChange} />
    </section>
  );
}
