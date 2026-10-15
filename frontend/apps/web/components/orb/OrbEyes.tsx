"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import type { OrbState } from "./core/orb-model";
import styles from "./OrbEyes.module.css";

export type EyeMood = "normal" | "happy" | "wink" | "heart" | "surprised" | "dizzy";

export interface OrbEyesProps {
  hostRef?: React.RefObject<HTMLElement | null>;
  size?: number;
  state?: OrbState;
  isMoving?: boolean;
  mood?: EyeMood;
}

export const OrbEyes = memo(function OrbEyes({
  hostRef,
  size = 280,
  state = 0,
  isMoving = false,
  mood: externalMood,
}: OrbEyesProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const leftClipId = `orb-left-eye-${id}`;
  const rightClipId = `orb-right-eye-${id}`;
  const scleraGradId = `orb-sclera-grad-${id}`;
  const pupilGradId = `orb-pupil-grad-${id}`;
  const blushFilterId = `orb-blush-blur-${id}`;

  const [internalMood, setInternalMood] = useState<EyeMood>("normal");
  const [isBlinking, setIsBlinking] = useState(false);

  const mood = externalMood ?? internalMood;

  const containerRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const leftPupilRef = useRef<SVGGElement>(null);
  const rightPupilRef = useRef<SVGGElement>(null);

  const moodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOrbPos = useRef<{ x: number; y: number } | null>(null);
  const lastPointer = useRef<{ x: number; y: number; time: number } | null>(null);

  // Playful petting & shaking detector
  const strokeHistory = useRef<Array<{ dirX: number; time: number }>>([]);
  const shakeHistory = useRef<Array<{ dirX: number; time: number }>>([]);

  const triggerMood = useCallback((newMood: EyeMood, durationMs = 1400) => {
    setInternalMood(newMood);
    if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    moodTimerRef.current = setTimeout(() => {
      setInternalMood("normal");
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 130);
    }, durationMs);
  }, []);

  // React to explicit moving prop
  useEffect(() => {
    if (isMoving && internalMood === "normal") {
      triggerMood("happy", 1400);
    }
  }, [isMoving, internalMood, triggerMood]);

  // Periodic natural blinking
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let active = true;

    const scheduleBlink = () => {
      const delay = Math.random() * 3200 + 2600;
      timer = setTimeout(() => {
        if (!active) return;
        if (mood === "normal") {
          setIsBlinking(true);
          setTimeout(() => {
            if (!active) return;
            setIsBlinking(false);
            scheduleBlink();
          }, 130);
        } else {
          scheduleBlink();
        }
      }, delay);
    };

    scheduleBlink();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mood]);

  // Pointer tracking & playful tactile responses
  useEffect(() => {
    const getHostOrContainer = () => hostRef?.current ?? containerRef.current;

    const updateGaze = (leftX: number, rightX: number, pupilY: number, faceX: number, faceY: number) => {
      if (leftPupilRef.current) {
        leftPupilRef.current.style.transform = `translate(${leftX.toFixed(2)}px, ${pupilY.toFixed(2)}px)`;
      }
      if (rightPupilRef.current) {
        rightPupilRef.current.style.transform = `translate(${rightX.toFixed(2)}px, ${pupilY.toFixed(2)}px)`;
      }
      if (faceRef.current) {
        faceRef.current.style.transform = `translate(${faceX.toFixed(2)}px, ${faceY.toFixed(2)}px)`;
      }
    };

    const resetGaze = () => {
      if (state === 2) {
        updateGaze(1.2, 1.2, -1.8, 0.4, -0.6);
      } else {
        updateGaze(0, 0, 0, 0, 0);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const el = getHostOrContainer();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const now = Date.now();

      // Check if orb position changed (e.g. dragged or thrown)
      if (lastOrbPos.current) {
        const moveDist = Math.hypot(rect.left - lastOrbPos.current.x, rect.top - lastOrbPos.current.y);
        const moveDx = rect.left - lastOrbPos.current.x;

        if (moveDist > 1.2) {
          // Check for rapid back-and-forth shake
          const sign = Math.sign(moveDx);
          if (sign !== 0) {
            shakeHistory.current.push({ dirX: sign, time: now });
            shakeHistory.current = shakeHistory.current.filter((s) => now - s.time < 750);
            const reversals = shakeHistory.current.reduce((acc, curr, idx, arr) => {
              if (idx > 0 && curr.dirX !== arr[idx - 1]?.dirX) return acc + 1;
              return acc;
            }, 0);

            if (reversals >= 4) {
              triggerMood("dizzy", 2000);
            } else if (moveDist > 12) {
              triggerMood("surprised", 1200);
            } else if (internalMood === "normal") {
              triggerMood("happy", 1200);
            }
          }
        }
      }
      lastOrbPos.current = { x: rect.left, y: rect.top };

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      // Petting / rubbing detection over the ball
      if (lastPointer.current) {
        const pdx = e.clientX - lastPointer.current.x;
        const pdy = e.clientY - lastPointer.current.y;
        const pdist = Math.hypot(pdx, pdy);

        if (dist < rect.width * 0.65 && pdist > 2) {
          const sign = Math.sign(pdx);
          if (sign !== 0) {
            strokeHistory.current.push({ dirX: sign, time: now });
            strokeHistory.current = strokeHistory.current.filter((s) => now - s.time < 900);
            const strokeReversals = strokeHistory.current.reduce((acc, curr, idx, arr) => {
              if (idx > 0 && curr.dirX !== arr[idx - 1]?.dirX) return acc + 1;
              return acc;
            }, 0);

            // 3 strokes across the ball -> heart eyes!
            if (strokeReversals >= 3) {
              triggerMood("heart", 2200);
            }
          }
        }
      }
      lastPointer.current = { x: e.clientX, y: e.clientY, time: now };

      // Pointer gaze tracking
      if (dist < 700 && mood === "normal") {
        const angle = Math.atan2(dy, dx);
        const factor = Math.min(1, Math.max(0.08, dist / 200));
        const maxPupilX = 3.4;
        const maxPupilY = 4.0;
        const pupilDistX = Math.cos(angle) * maxPupilX * factor;
        const pupilDistY = Math.sin(angle) * maxPupilY * factor;

        // Convergence when cursor is close (< 160px)
        const converge = dist < 160 ? (1 - dist / 160) * 0.75 : 0;
        const leftX = pupilDistX + converge;
        const rightX = pupilDistX - converge;

        // 3D spherize parallax for the face
        const faceX = pupilDistX * 0.32;
        const faceY = pupilDistY * 0.32;

        updateGaze(leftX, rightX, pupilDistY, faceX, faceY);
      } else if (dist >= 700) {
        resetGaze();
      }
    };

    const handlePointerLeave = () => {
      lastPointer.current = null;
      strokeHistory.current = [];
      resetGaze();
    };

    // Custom playful events
    const handleCustomMood = (event: Event) => {
      const custom = event as CustomEvent<{ mood?: EyeMood; duration?: number }>;
      if (custom.detail?.mood) {
        triggerMood(custom.detail.mood, custom.detail.duration ?? 1600);
      }
    };

    const handleCustomTrick = (event: Event) => {
      const custom = event as CustomEvent<{ trick?: string }>;
      const trick = custom.detail?.trick;
      if (trick === "bounce") triggerMood("happy", 1500);
      else if (trick === "flip") triggerMood("happy", 1800);
      else if (trick === "wink") triggerMood("wink", 1200);
      else if (trick === "pet") triggerMood("heart", 2400);
      else if (trick === "dizzy") triggerMood("dizzy", 2200);
    };

    const handleCustomSpinOrMove = () => {
      if (internalMood === "normal") triggerMood("happy", 1400);
    };

    // Tactile poke & squish on pointerdown
    const handlePointerDown = () => {
      const el = getHostOrContainer();
      if (!el) return;
      el.style.setProperty("--ball-squish-x", "1.14");
      el.style.setProperty("--ball-squish-y", "0.86");
    };

    const handlePointerUp = () => {
      const el = getHostOrContainer();
      if (!el) return;
      // Rebound hop and squish recovery
      el.style.setProperty("--ball-hop-y", "-9px");
      el.style.setProperty("--ball-squish-x", "0.93");
      el.style.setProperty("--ball-squish-y", "1.10");

      setTimeout(() => {
        el.style.setProperty("--ball-hop-y", "0px");
        el.style.setProperty("--ball-squish-x", "1");
        el.style.setProperty("--ball-squish-y", "1");
      }, 190);

      // Playful tap wink if no special mood active
      if (internalMood === "normal") {
        triggerMood("wink", 1100);
      }
    };

    const hostEl = getHostOrContainer();
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("orb:mood", handleCustomMood, { passive: true });
    window.addEventListener("orb:trick", handleCustomTrick, { passive: true });
    window.addEventListener("orb:spin", handleCustomSpinOrMove, { passive: true });
    window.addEventListener("orb:move", handleCustomSpinOrMove, { passive: true });

    if (hostEl) {
      hostEl.addEventListener("orb:mood", handleCustomMood, { passive: true });
      hostEl.addEventListener("orb:trick", handleCustomTrick, { passive: true });
      hostEl.addEventListener("orb:spin", handleCustomSpinOrMove, { passive: true });
      hostEl.addEventListener("orb:move", handleCustomSpinOrMove, { passive: true });
      hostEl.addEventListener("pointerdown", handlePointerDown, { passive: true });
      hostEl.addEventListener("pointerup", handlePointerUp, { passive: true });
    }

    resetGaze();

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("orb:mood", handleCustomMood);
      window.removeEventListener("orb:trick", handleCustomTrick);
      window.removeEventListener("orb:spin", handleCustomSpinOrMove);
      window.removeEventListener("orb:move", handleCustomSpinOrMove);

      if (hostEl) {
        hostEl.removeEventListener("orb:mood", handleCustomMood);
        hostEl.removeEventListener("orb:trick", handleCustomTrick);
        hostEl.removeEventListener("orb:spin", handleCustomSpinOrMove);
        hostEl.removeEventListener("orb:move", handleCustomSpinOrMove);
        hostEl.removeEventListener("pointerdown", handlePointerDown);
        hostEl.removeEventListener("pointerup", handlePointerUp);
      }
      if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    };
  }, [hostRef, state, mood, internalMood, triggerMood]);

  const moodClass = {
    normal: "",
    happy: styles.moodHappy,
    wink: styles.moodWink,
    heart: styles.moodHeart,
    surprised: styles.moodSurprised,
    dizzy: styles.moodDizzy,
  }[mood];

  return (
    <div
      ref={containerRef}
      className={`${styles.eyesContainer} ${moodClass}`}
      aria-hidden="true"
    >
      <svg
        className={styles.eyesSvg}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Sclera gradient */}
          <radialGradient id={scleraGradId} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="85%" stopColor="#f3f8fd" />
            <stop offset="100%" stopColor="#dce8f5" />
          </radialGradient>

          {/* Pupil gradient */}
          <radialGradient id={pupilGradId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#252c42" />
            <stop offset="65%" stopColor="#121624" />
            <stop offset="100%" stopColor="#080a12" />
          </radialGradient>

          {/* Eye socket clips */}
          <clipPath id={leftClipId}>
            <rect x="30" y="36" width="14" height="20" rx="7" />
          </clipPath>
          <clipPath id={rightClipId}>
            <rect x="56" y="36" width="14" height="20" rx="7" />
          </clipPath>

          {/* Soft blush blur filter */}
          <filter id={blushFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        <g
          ref={faceRef}
          className={`${styles.faceGroup} ${mood === "happy" ? styles.happyBounce : ""} ${mood === "dizzy" ? styles.dizzyWobble : ""}`}
        >
          {/* 1. Normal open cartoon eyes (with gaze tracking and blinking) */}
          <g className={`${styles.openEyesGroup} ${isBlinking ? styles.blinking : ""}`}>
            {/* Left Eye */}
            <rect
              x="30"
              y="36"
              width="14"
              height="20"
              rx="7"
              fill={`url(#${scleraGradId})`}
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="0.6"
            />
            <g clipPath={`url(#${leftClipId})`}>
              <g ref={leftPupilRef} className={styles.leftPupil}>
                <rect
                  x="32.25"
                  y="39.5"
                  width="9.5"
                  height="13"
                  rx="4.75"
                  fill={`url(#${pupilGradId})`}
                  stroke="var(--orb-accent, #6bdcff)"
                  strokeWidth="0.75"
                  strokeOpacity="0.5"
                />
                <ellipse cx="35.2" cy="42.5" rx="1.9" ry="2.3" fill="#ffffff" />
                <circle cx="39.2" cy="49" r="1.1" fill="rgba(255, 255, 255, 0.85)" />
              </g>
            </g>

            {/* Right Eye */}
            <rect
              x="56"
              y="36"
              width="14"
              height="20"
              rx="7"
              fill={`url(#${scleraGradId})`}
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="0.6"
            />
            <g clipPath={`url(#${rightClipId})`}>
              <g ref={rightPupilRef} className={styles.rightPupil}>
                <rect
                  x="58.25"
                  y="39.5"
                  width="9.5"
                  height="13"
                  rx="4.75"
                  fill={`url(#${pupilGradId})`}
                  stroke="var(--orb-accent, #6bdcff)"
                  strokeWidth="0.75"
                  strokeOpacity="0.5"
                />
                <ellipse cx="61.2" cy="42.5" rx="1.9" ry="2.3" fill="#ffffff" />
                <circle cx="65.2" cy="49" r="1.1" fill="rgba(255, 255, 255, 0.85)" />
              </g>
            </g>
          </g>

          {/* 2. Happy cartoon eyes (⌒ ⌒) */}
          <g className={styles.happyEyesGroup}>
            <path className={styles.happyArc} d="M 30.5 48.5 Q 37 39.5 43.5 48.5" />
            <path className={styles.happyArc} d="M 56.5 48.5 Q 63 39.5 69.5 48.5" />
          </g>

          {/* 3. Wink cartoon eye (^ ~) */}
          <g className={styles.winkEyesGroup}>
            <path className={styles.happyArc} d="M 30.5 48.5 Q 37 39.5 43.5 48.5" />
            {/* Open right eye with twinkle */}
            <rect
              x="56"
              y="36"
              width="14"
              height="20"
              rx="7"
              fill={`url(#${scleraGradId})`}
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="0.6"
            />
            <g clipPath={`url(#${rightClipId})`}>
              <rect
                x="58.25"
                y="39.5"
                width="9.5"
                height="13"
                rx="4.75"
                fill={`url(#${pupilGradId})`}
                stroke="var(--orb-accent, #6bdcff)"
                strokeWidth="0.75"
                strokeOpacity="0.5"
              />
              <ellipse cx="61.2" cy="42.5" rx="1.9" ry="2.3" fill="#ffffff" />
              <circle cx="65.2" cy="49" r="1.1" fill="rgba(255, 255, 255, 0.85)" />
            </g>
          </g>

          {/* 4. Loving Heart Eyes (♥ ♥) */}
          <g className={styles.heartEyesGroup}>
            <path
              className={styles.heartShape}
              d="M 37 50.5 C 37 50.5 29.5 44 29.5 39 C 29.5 35.5 32.5 33.5 35.5 35.8 C 36.5 36.6 37 37.5 37 37.5 C 37 37.5 37.5 36.6 38.5 35.8 C 41.5 33.5 44.5 35.5 44.5 39 C 44.5 44 37 50.5 37 50.5 Z"
            />
            <path
              className={styles.heartShape}
              d="M 63 50.5 C 63 50.5 55.5 44 55.5 39 C 55.5 35.5 58.5 33.5 61.5 35.8 C 62.5 36.6 63 37.5 63 37.5 C 63 37.5 63.5 36.6 64.5 35.8 C 67.5 33.5 70.5 35.5 70.5 39 C 70.5 44 63 50.5 63 50.5 Z"
            />
          </g>

          {/* 5. Surprised wide eyes (O O) */}
          <g className={styles.surprisedEyesGroup}>
            <circle cx="37" cy="46" r="9" fill={`url(#${scleraGradId})`} stroke="rgba(255, 255, 255, 0.5)" strokeWidth="0.6" />
            <circle cx="37" cy="46" r="3.2" fill="#080a12" />
            <circle cx="35.5" cy="44.5" r="1.1" fill="#ffffff" />

            <circle cx="63" cy="46" r="9" fill={`url(#${scleraGradId})`} stroke="rgba(255, 255, 255, 0.5)" strokeWidth="0.6" />
            <circle cx="63" cy="46" r="3.2" fill="#080a12" />
            <circle cx="61.5" cy="44.5" r="1.1" fill="#ffffff" />
          </g>

          {/* 6. Dizzy spiral eyes (@ @) */}
          <g className={styles.dizzyEyesGroup}>
            <circle cx="37" cy="46" r="9" fill={`url(#${scleraGradId})`} opacity="0.8" />
            <path
              className={styles.spiralPath}
              d="M 37 46 m -1.5 -1.5 a 2 2 0 0 1 3 0 a 4 4 0 0 1 -1 5 a 6 6 0 0 1 -7 -3 a 8 8 0 0 1 4 -9 a 10 10 0 0 1 11 5"
            />
            <circle cx="63" cy="46" r="9" fill={`url(#${scleraGradId})`} opacity="0.8" />
            <path
              className={styles.spiralPath}
              d="M 63 46 m -1.5 -1.5 a 2 2 0 0 1 3 0 a 4 4 0 0 1 -1 5 a 6 6 0 0 1 -7 -3 a 8 8 0 0 1 4 -9 a 10 10 0 0 1 11 5"
            />
          </g>

          {/* Rosy blush cheeks */}
          <g className={styles.blushGroup}>
            <ellipse
              cx="33.5"
              cy="55.5"
              rx="5.5"
              ry="3"
              fill="rgba(255, 110, 160, 0.75)"
              filter={`url(#${blushFilterId})`}
            />
            <ellipse
              cx="66.5"
              cy="55.5"
              rx="5.5"
              ry="3"
              fill="rgba(255, 110, 160, 0.75)"
              filter={`url(#${blushFilterId})`}
            />
          </g>
        </g>
      </svg>
    </div>
  );
});
