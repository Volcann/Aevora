"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { OrbVoiceExperience } from "./OrbVoiceExperience";
import type { SendVoicePrompt } from "./core/voice-session";
import styles from "./Orb.module.css";

export interface SiriVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendVoicePrompt: SendVoicePrompt;
  onStopStreaming?: () => void;
  isStreaming?: boolean;
  streamingMessage?: string;
  activeTool?: { name: string; status: "start" | "done" | "error" } | null;
  orbTheme?: number;
  onOrbThemeChange?: (themeIndex: number) => void;
}

function OpenVoiceModal({
  onClose, onSendVoicePrompt, onStopStreaming, isStreaming,
  activeTool, orbTheme, onOrbThemeChange,
}: Omit<SiriVoiceModalProps, "isOpen">) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        const focused = document.activeElement;
        if (event.shiftKey && (focused === first || !controls.includes(focused as HTMLElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (focused === last || !controls.includes(focused as HTMLElement))) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.modalContent}>
        <header className={styles.modalHeader}>
          <div><p className={styles.eyebrow}>AEVORA</p><h2 id={titleId}>Let’s talk.</h2></div>
          <button type="button" className={styles.closeButton} aria-label="Close voice mode" onClick={onClose} autoFocus><X size={20} aria-hidden="true" /></button>
        </header>
        <OrbVoiceExperience size={310} onPrompt={onSendVoicePrompt} onStopStreaming={onStopStreaming} activeState={isStreaming ? 2 : undefined} activeTool={activeTool} orbTheme={orbTheme} onOrbThemeChange={onOrbThemeChange} onEndCall={onClose} />
        
      </div>
    </dialog>
  );
}

export function SiriVoiceModal({ isOpen, ...props }: SiriVoiceModalProps) {
  // Closing (including a parent-driven close) unmounts the entire voice lifecycle.
  return isOpen ? <OpenVoiceModal {...props} /> : null;
}
