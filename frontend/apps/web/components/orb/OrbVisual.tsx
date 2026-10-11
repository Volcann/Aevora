"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import { ORB_THEMES, normalizeOrbTheme } from "../../lib/orbTheme";
import { createOrbRenderer, type OrbRenderer } from "./core/orb-renderer";
import { clamp, type OrbSignal, type OrbState } from "./core/orb-model";
import styles from "./Orb.module.css";

export interface OrbVisualProps {
  size?: number;
  state?: OrbState;
  theme?: number;
  signal?: { readonly current: OrbSignal };
  onActivate?: () => void;
  label?: string;
  showWaveform?: boolean;
  className?: string;
}

/** Presentation only: rendering never acquires a microphone or starts speech. */
export const OrbVisual = memo(function OrbVisual({
  size = 280, state = 0, theme = 1, signal, onActivate,
  label = "Start voice conversation", showWaveform = false, className = "",
}: OrbVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<OrbRenderer | null>(null);
  const safeTheme = normalizeOrbTheme(theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const renderer = createOrbRenderer(canvas, host, { state: 0, theme: 1 }, barsRef.current);
    rendererRef.current = renderer;
    return () => { renderer.dispose(); rendererRef.current = null; };
  }, [showWaveform]);
  useEffect(() => {
    rendererRef.current?.update({ state, theme: safeTheme, signal });
  }, [state, safeTheme, signal, showWaveform]);

  const palette = ORB_THEMES[safeTheme];
  const visual = (
    <>
      <span className={styles.ambient} aria-hidden="true" />
      <span className={styles.fallbackSphere} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <span className={styles.reflection} aria-hidden="true" />
    </>
  );
  return (
    <div
      ref={hostRef}
      className={`${styles.visual} ${className}`}
      data-renderer="fallback"
      data-orb-state={state}
      data-orb-theme={safeTheme}
      style={{
        "--orb-size": `${clamp(size, 48, 600)}px`,
        "--orb-accent": palette.primaryColor,
        "--orb-ambient": palette.ambient,
        "--orb-wave": palette.barGrad,
        "--orb-shadow": palette.boxShadow,
      } as CSSProperties}
    >
      {onActivate ? (
        <button type="button" className={styles.orbButton} onClick={onActivate} aria-label={label} title={label}>
          {visual}
        </button>
      ) : <div className={styles.orbSurface} role="img" aria-label={label}>{visual}</div>}
      {showWaveform && (
        <div ref={barsRef} className={styles.waveform} aria-hidden="true">
          {Array.from({ length: 32 }, (_, index) => <span key={index} />)}
        </div>
      )}
    </div>
  );
});
