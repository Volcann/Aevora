"use client";

import { memo, useId, type RefObject } from "react";
import type { OrbState } from "./core/orb-model";
import { useOrbEyes } from "./hooks/useOrbEyes";
import type { EyeMood } from "./core/eye-behavior";
import styles from "./OrbEyes.module.css";

export type { EyeMood } from "./core/eye-behavior";
export interface OrbEyesProps {
  hostRef?: RefObject<HTMLElement | null>;
  size?: number;
  state?: OrbState;
  isMoving?: boolean;
  mood?: EyeMood;
}

// Eye aperture only: lids reveal the original orb behind them, rather than
// painting a solid patch over its animated interior.
function aperture(mood: EyeMood, x: number, side: "left" | "right"): string {
  const c = x + 7, r = x + 14;
  const bottom = `L${r} 49 C${r} 52.87 ${c + 3.87} 56 ${c} 56 C${c - 3.87} 56 ${x} 52.87 ${x} 49 Z`;
  if (mood === "focused") {
    const a = side === "left" ? 39.5 : 40.5;
    const b = side === "left" ? 40.5 : 39.5;
    return `M${x} ${a} C${x + 3} ${a - 0.6} ${x + 4} ${a + 0.3} ${c} 40 C${r - 4} ${b - 0.3} ${r - 2} ${b - 0.6} ${r} ${b} ${bottom}`;
  }
  if (mood === "sleepy") {
    return `M${x} 46 C${x + 2} 46.8 ${x + 4} 47.7 ${c} 47.8 C${r - 4} 47.7 ${r - 2} 46.8 ${r} 46 ${bottom}`;
  }
  if (mood === "content") {
    return `M${x} 41.5 C${x + 2} 40 ${x + 4} 39.5 ${c} 39.5 C${r - 4} 39.5 ${r - 2} 40 ${r} 41.5 L${r} 47.5 C${r} 51.4 ${c + 3.9} 53 ${c} 53 C${c - 3.9} 53 ${x} 51.4 ${x} 47.5 Z`;
  }
  return `M${x} 43 C${x} 39.13 ${c - 3.87} 36 ${c} 36 C${c + 3.87} 36 ${r} 39.13 ${r} 43 ${bottom}`;
}

export const OrbEyes = memo(function OrbEyes({
  hostRef, size = 280, state = 0, isMoving = false, mood: externalMood,
}: OrbEyesProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { containerRef, faceRef, leftPupilRef, rightPupilRef, mood, isBlinking } =
    useOrbEyes({ hostRef, state, isMoving, mood: externalMood });
  const ids = {
    sclera: `eye-sclera-${id}`, iris: `eye-iris-${id}`, pupil: `eye-pupil-${id}`,
    lid: `eye-lid-${id}`, glass: `eye-glass-${id}`, heart: `eye-heart-${id}`,
    blush: `eye-blush-${id}`,
    left: `eye-left-${id}`, right: `eye-right-${id}`, wink: `eye-wink-${id}`,
  };
  const fill = (name: keyof typeof ids) => `url(#${ids[name]})`;

  // The socket dimensions/position are the original 14 x 20 at (30,36)/(56,36).
  // Iris, pupil, corneal sheen and catchlights move together under that socket.
  const iris = (cx: number, cy = 46, scale = 1) => (
    <g transform={`translate(${cx} ${cy})`}>
      <g className={styles.irisResponse}>
        <g transform={`scale(${scale})`}>
          <rect x="-4.75" y="-6.5" width="9.5" height="13" rx="4.75" fill={fill("iris")} stroke="#0c172d" strokeWidth="0.6" />
          <path className={styles.irisFibres} d="M-3.8 -3.4 l1 .9 M-4.1 -.8 l1.1 .2 M-4 2 l1 -.4 M-3.1 4.1 l.7 -.9 M-.8 5.5 l.2 -1.1 M1.5 5.2 l-.3 -1 M3.2 3.8 l-.8 -.8 M4 1.1 l-1.1 -.1 M3.8 -2 l-1 .4" />
          <rect x="-3.25" y="-4.85" width="6.5" height="9.7" rx="3.25" fill={fill("pupil")} />
          <path d="M-3.7 2.8 Q-1.4 6.2 2.2 4.3" fill="none" stroke="var(--orb-accent, #6bdcff)" strokeWidth="0.62" strokeOpacity="0.6" strokeLinecap="round" />
          <ellipse className={styles.catchlight} cx="-1.7" cy="-3.1" rx="1.65" ry="2.05" fill="#fff" transform="rotate(-17 -1.7 -3.1)" />
          <ellipse cx="1.8" cy="2.8" rx="0.8" ry="0.95" fill="#eefaff" opacity="0.9" />
          <circle cx="2.8" cy="-3.5" r="0.32" fill="#fff" opacity="0.74" />
        </g>
      </g>
    </g>
  );
  const openEye = (side: "left" | "right", wink = false) => {
    const x = side === "left" ? 30 : 56;
    const pupilRef = side === "left" ? leftPupilRef : rightPupilRef;
    return (
      <g className={side === "left" ? styles.leftSocket : styles.rightSocket}>
        <g className={styles.blinkLid}>
          <g clipPath={fill(wink ? "wink" : side)}>
            <rect x={x} y="36" width="14" height="20" rx="7" fill={fill("sclera")} />
            <g ref={wink ? undefined : pupilRef} className={side === "left" ? styles.leftPupil : styles.rightPupil}>
              {iris(x + 7)}
            </g>
            <rect x={x} y="36" width="14" height="20" rx="7" fill={fill("lid")} />
            <path d={`M${x + 1.4} 43 C${x + 1.4} 39.8 ${x + 3.8} 37.2 ${x + 7} 37.2`} className={styles.socketSheen} />
            <rect x={x + 0.2} y="36.2" width="13.6" height="19.6" rx="6.8" fill="none" stroke="#fff" strokeOpacity="0.36" strokeWidth="0.45" />
          </g>
        </g>
      </g>
    );
  };
  const smile = (x: number) => (
    <g>
      <path d={`M${x + 0.5} 48.5 Q${x + 7} 39.5 ${x + 13.5} 48.5`} className={styles.happyArc} />
      <path d={`M${x + 2.3} 47 Q${x + 7} 41.8 ${x + 11.7} 47`} className={styles.arcSheen} />
    </g>
  );

  return (
    <div ref={containerRef} className={styles.eyesContainer} aria-hidden="true"
      data-eye-mood={mood} data-eye-state={state} data-blinking={isBlinking ? "true" : "false"}
      data-eye-detail={size < 110 ? "compact" : "full"}>
      <svg className={styles.eyesSvg} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" focusable="false">
        <defs>
          <radialGradient id={ids.sclera} cx="35%" cy="25%" r="83%">
            <stop offset="0" stopColor="#fff" /><stop offset="0.55" stopColor="#f9fcff" />
            <stop offset="0.83" stopColor="#e5edf8" /><stop offset="1" stopColor="#a4b5cf" />
          </radialGradient>
          <radialGradient id={ids.iris} cx="38%" cy="30%" r="80%">
            <stop offset="0" stopColor="#2b3658" /><stop offset="0.48" stopColor="#111b31" />
            <stop offset="0.76" stopColor="#345e75" /><stop offset="0.9" stopColor="var(--orb-accent, #6bdcff)" stopOpacity="0.78" />
            <stop offset="1" stopColor="#17223b" />
          </radialGradient>
          <radialGradient id={ids.pupil} cx="35%" cy="25%" r="75%">
            <stop offset="0" stopColor="#172035" /><stop offset="0.65" stopColor="#080e1b" /><stop offset="1" stopColor="#020611" />
          </radialGradient>
          <linearGradient id={ids.lid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#283d63" stopOpacity="0.27" /><stop offset="0.25" stopColor="#283d63" stopOpacity="0" />
            <stop offset="0.82" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#d0eaff" stopOpacity="0.19" />
          </linearGradient>
          <linearGradient id={ids.glass} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#d9ecff" />
          </linearGradient>
          <linearGradient id={ids.heart} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#ff9fca" /><stop offset="0.4" stopColor="#ff468e" /><stop offset="1" stopColor="#dc1765" />
          </linearGradient>
          <clipPath id={ids.left}><path d={aperture(mood, 30, "left")} /></clipPath>
          <clipPath id={ids.right}><path d={aperture(mood, 56, "right")} /></clipPath>
          <clipPath id={ids.wink}><path d={aperture("normal", 56, "right")} /></clipPath>
          <filter id={ids.blush} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2" /></filter>
        </defs>

        {/* Separate gaze, expression and blink transforms: they never fight each other. */}
        <g ref={faceRef} className={styles.faceGroup}>
          <g className={styles.expressionGroup}>
            <g className={styles.openEyesGroup}>{openEye("left")}{openEye("right")}</g>
            <g className={styles.happyEyesGroup}>{smile(30)}{smile(56)}</g>
            <g className={styles.winkEyesGroup}>
              <g className={styles.winkLid}>{smile(30)}</g>{openEye("right", true)}
            </g>
            <g className={styles.heartEyesGroup}>
              {[37, 63].map(cx => (
                <g key={cx} transform={`translate(${cx} 43)`}>
                  <g className={styles.heartShape}>
                    <path d="M0 8 C-1.2 6.9 -7.5 1.6 -7.5 -3 C-7.5 -6.5 -4.5 -8.5 -1.5 -6.2 C-.5 -5.4 0 -4.5 0 -4.5 C0 -4.5 .5 -5.4 1.5 -6.2 C4.5 -8.5 7.5 -6.5 7.5 -3 C7.5 1.6 1.2 6.9 0 8Z" fill={fill("heart")} />
                    <path d="M-5 -3.5 Q-4.8 -5.7 -2.6 -4.8" fill="none" stroke="#fff" strokeWidth="1.15" strokeOpacity="0.78" strokeLinecap="round" />
                  </g>
                </g>
              ))}
            </g>
            <g className={styles.surprisedEyesGroup}>
              {[37, 63].map(cx => (
                <g key={cx}>
                  <circle cx={cx} cy="46" r="9" fill={fill("sclera")} stroke="#fff" strokeOpacity="0.45" strokeWidth="0.55" />
                  {iris(cx, 46, 0.68)}
                  <path d={`M${cx - 6.2} 42.5 Q${cx - 4.5} 38.8 ${cx - 1.2} 38.8`} className={styles.socketSheen} />
                </g>
              ))}
            </g>
            <g className={styles.dizzyEyesGroup}>
              {[37, 63].map(cx => (
                <g key={cx} transform={`translate(${cx} 46)`}>
                  <circle r="8.4" fill={fill("sclera")} opacity="0.94" />
                  <g className={styles.spiralRotor}>
                    <path className={styles.spiralPath} d="M0 0 C1.7 -1.5 3.2 .7 1.5 2.3 C-.4 4.2 -4.2 2.9 -4.3 -.3 C-4.6 -4 0 -6.5 3.6 -4 C6.7 -1.6 5.8 3.4 3.2 5.2" />
                  </g>
                  <ellipse cx="-3.7" cy="-4.3" rx="0.8" ry="1.1" fill="#fff" opacity="0.78" />
                </g>
              ))}
            </g>
          </g>
          {/* Original cheek positions, dimensions, color and blur are retained. */}
          <g className={styles.blushGroup}>
            <ellipse cx="33.5" cy="55.5" rx="5.5" ry="3" fill="rgba(255, 110, 160, 0.75)" filter={fill("blush")} />
            <ellipse cx="66.5" cy="55.5" rx="5.5" ry="3" fill="rgba(255, 110, 160, 0.75)" filter={fill("blush")} />
          </g>
        </g>
      </svg>
    </div>
  );
});
