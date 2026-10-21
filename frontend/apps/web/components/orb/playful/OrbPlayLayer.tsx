"use client";

import { memo, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { OrbVisual, type OrbVisualProps } from "../OrbVisual";
import { COLOR_TREATMENTS, energyScale, type OrbTrick } from "./playful-model";
import { PLAY_TRICK_EVENT, usePlayPreferences } from "./usePlayPreferences";
import { usePlayEnvironment } from "./usePlayEnvironment";
import styles from "./PlayfulOrb.module.css";

interface LayerProps {
  children: ReactNode;
  size?: number;
  streaming?: boolean;
  response?: string;
  interactive?: boolean;
  paused?: boolean;
}
/** An additive presentation shell. The original orb markup, shaders and palettes are untouched. */
export function OrbPlayLayer({ children, size = 80, streaming = false, response = "", interactive = true, paused = false }: LayerProps) {
  const { preferences } = usePlayPreferences();
  const { animate, reduced } = usePlayEnvironment();
  const root = useRef<HTMLDivElement>(null);
  const impulse = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [trick, setTrick] = useState<OrbTrick | "">("");
  const trickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResponse = useRef({ length: 0, at: 0 });
  const impulseAnimation = useRef<Animation | null>(null);
  const filterId = `orb-fluid-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const moving = animate && inView && !paused;
  const morphing = moving && streaming && preferences.morph !== "off";
  const treatment = COLOR_TREATMENTS.find(item => item.id === preferences.treatment) ?? COLOR_TREATMENTS[0];
  const energy = energyScale(preferences.energy);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const react = (event: Event) => {
      const next = (event as CustomEvent<{ trick?: OrbTrick }>).detail?.trick;
      if (!next || !["wiggle", "hop", "spin", "celebrate"].includes(next) || !moving || !preferences.reactions) return;
      if (trickTimer.current) clearTimeout(trickTimer.current);
      setTrick(next);
      root.current?.querySelector("[data-renderer]")?.dispatchEvent(new CustomEvent("orb:mood", { detail: { mood: "happy", duration: 1800 } }));
      trickTimer.current = setTimeout(() => { setTrick(""); trickTimer.current = null; }, 1400);
    };
    window.addEventListener(PLAY_TRICK_EVENT, react);
    return () => { window.removeEventListener(PLAY_TRICK_EVENT, react); if (trickTimer.current) clearTimeout(trickTimer.current); setTrick(""); };
  }, [interactive, moving, preferences.reactions]);

  useEffect(() => {
    const orb = root.current?.querySelector("[data-renderer]");
    if (preferences.mode !== "sleepy" || streaming || !moving) return;
    const snooze = () => orb?.dispatchEvent(new CustomEvent("orb:mood", { detail: { mood: "sleepy", duration: 4500 } }));
    snooze();
    const timer = setInterval(snooze, 4300);
    return () => { clearInterval(timer); orb?.dispatchEvent(new CustomEvent("orb:mood", { detail: { mood: "normal", duration: 100 } })); };
  }, [preferences.mode, streaming, moving]);

  // Impulses come from real response growth; no invented audio/word signals.
  useEffect(() => {
    const now = performance.now();
    const previous = lastResponse.current;
    const growth = response.length - previous.length;
    lastResponse.current = { length: response.length, at: previous.at };
    if (!morphing || growth <= 0 || now - previous.at < 180) return;
    lastResponse.current.at = now;
    impulseAnimation.current?.cancel();
    const stretch = 1 + Math.min(.055, .016 + growth / 2200) * energy;
    impulseAnimation.current = impulse.current?.animate?.([
      { transform: "scale(1)" },
      { transform: `scale(${stretch}, ${2 - stretch})`, offset: .3 },
      { transform: "scale(1)" },
    ], { duration: 390, easing: "ease-out" }) ?? null;
  }, [response, morphing, energy]);
  useEffect(() => {
    if (!morphing) { impulseAnimation.current?.cancel(); lastResponse.current = { length: 0, at: 0 }; }
    return () => { impulseAnimation.current?.cancel(); };
  }, [morphing]);

  return <div ref={root} className={styles.layer}
    data-play-mode={interactive ? preferences.mode : "classic"}
    data-morph={morphing ? preferences.morph : "off"}
    data-streaming={streaming ? response ? "responding" : "thinking" : "idle"}
    data-animated={moving} data-reduced={reduced} data-trick={trick}
    data-treatment={preferences.treatment}
    style={{ "--play-size": `${size}px`, "--play-speed": `${1 / energy}`, "--play-travel": `${6 * energy}px` } as CSSProperties}>
    {morphing && preferences.morph === "fluid" && <svg className={styles.filterDefs} width="0" height="0" aria-hidden="true" focusable="false">
      <defs><filter id={filterId} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={1.4 / size} numOctaves="1" seed="8" result="noise">
          <animate attributeName="baseFrequency" values={`${1.4 / size};${2.1 / size};${1.2 / size};${1.4 / size}`} dur={`${5 / energy}s`} repeatCount="indefinite" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={size * .105 * energy} xChannelSelector="R" yChannelSelector="G" />
      </filter></defs>
    </svg>}
    <div className={styles.idleMotion}><div className={styles.trickMotion}>
      <div className={styles.morphMotion} style={morphing && preferences.morph === "fluid" ? { filter: `url(#${filterId})` } : undefined}>
        <div ref={impulse} className={styles.impulse}>
          <div className={styles.treatment} style={treatment.filter !== "none" ? { filter: treatment.filter } : undefined}>{children}</div>
        </div>
      </div>
    </div></div>
    {trick === "celebrate" && moving && <span className={styles.celebration} aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--spark-index": i } as CSSProperties} />)}</span>}
  </div>;
}

export const PlayfulOrb = memo(function PlayfulOrb({ streaming = false, response = "", interactive = true, paused = false, ...props }: OrbVisualProps & Omit<LayerProps, "children">) {
  return <OrbPlayLayer size={props.size ?? 280} streaming={streaming} response={response} interactive={interactive} paused={paused}><OrbVisual {...props} /></OrbPlayLayer>;
});
