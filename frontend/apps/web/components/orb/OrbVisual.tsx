"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import { ORB_THEMES, normalizeOrbTheme } from "../../lib/orbTheme";
import { createOrbRenderer, type OrbRenderer } from "./core/orb-renderer";
import { clamp, type OrbSignal, type OrbState } from "./core/orb-model";
import { OrbEyes } from "./OrbEyes";
import styles from "./Orb.module.css";
import { useOrbMotion, computeReduced } from "./hooks/useOrbMotion";

export interface OrbVisualProps {
  size?: number;
  state?: OrbState;
  theme?: number;
  signal?: { readonly current: OrbSignal };
  onActivate?: () => void;
  label?: string;
  showWaveform?: boolean;
  className?: string;
  hasEyes?: boolean;
  isMoving?: boolean;
  onDoubleClick?: () => void;
}

/** Presentation only: rendering never acquires a microphone or starts speech. */
export const OrbVisual = memo(function OrbVisual({
  size = 280, state = 0, theme = 1, signal, onActivate, onDoubleClick,
  label = "Start voice conversation", showWaveform = false, className = "",
  hasEyes = true, isMoving = false,
}: OrbVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<OrbRenderer | null>(null);
  const safeTheme = normalizeOrbTheme(theme);
  const { pref } = useOrbMotion();
  const forceMotion = pref === "on";

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const renderer = createOrbRenderer(canvas, host, { state: 0, theme: 1, forceMotion }, barsRef.current);
    rendererRef.current = renderer;
    return () => { renderer.dispose(); rendererRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWaveform]);

  useEffect(() => {
    rendererRef.current?.update({ state, theme: safeTheme, signal, forceMotion });
  }, [state, safeTheme, signal, showWaveform, forceMotion]);

  // Reflect motion pref on the host element for CSS rules.
  const motionData = computeReduced(pref) ? "off" : "on";

  const palette = ORB_THEMES[safeTheme];
  const visual = (
    <span className={styles.orbBody} aria-hidden="true">
      <span className={styles.glowViewport}>
        <span className={styles.ambient} />
        <canvas ref={canvasRef} className={styles.canvas} />
      </span>
      <span className={styles.fallbackSphere} />
      <span className={styles.reflection} />
      {hasEyes && <OrbEyes hostRef={hostRef} size={size} state={state} isMoving={isMoving} />}
    </span>
  );
  return (
    <div
      ref={hostRef}
      className={`${styles.visual} ${className}`}
      data-renderer="fallback"
      data-orb-state={state}
      data-orb-theme={safeTheme}
      data-motion={motionData}
      style={{
        "--orb-size": `${clamp(size, 48, 600)}px`,
        "--orb-accent": palette.primaryColor,
        "--orb-ambient": palette.ambient,
        "--orb-wave": palette.barGrad,
        "--orb-shadow": palette.boxShadow,
      } as CSSProperties}
    >
      {onActivate ? (
        <button type="button" className={styles.orbButton} onClick={onActivate} onDoubleClick={onDoubleClick} aria-label={label} title={label}>
          {visual}
        </button>
      ) : <div className={styles.orbSurface} role="img" aria-label={label} onDoubleClick={onDoubleClick}>{visual}</div>}
      {showWaveform && (
        <div ref={barsRef} className={styles.waveform} aria-hidden="true">
          {Array.from({ length: 32 }, (_, index) => <span key={index} />)}
        </div>
      )}
    </div>
  );
});
