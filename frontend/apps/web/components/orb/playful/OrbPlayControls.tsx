"use client";

import { useState } from "react";
import { Check, ChevronDown, RotateCcw, Sparkles, X } from "lucide-react";
import { ORB_THEMES } from "../../../lib/orbTheme";
import { useOrbTheme } from "../hooks/useOrbTheme";
import { PlayfulOrb } from "./OrbPlayLayer";
import { COLOR_TREATMENTS, DEFAULT_PLAY, MORPH_STYLES, PLAY_MODES, type OrbTrick } from "./playful-model";
import { playOrbTrick, usePlayPreferences } from "./usePlayPreferences";
import { usePlayEnvironment } from "./usePlayEnvironment";
import styles from "./OrbPlayControls.module.css";

export function OrbPlayControls({ compact = false, native = false, onHome, onClose }: { compact?: boolean; native?: boolean; onHome?: () => void; onClose?: () => void }) {
  const { preferences, setPreferences } = usePlayPreferences();
  const { theme, selectTheme } = useOrbTheme();
  const { reduced } = usePlayEnvironment();
  const [preview, setPreview] = useState(false);
  const [open, setOpen] = useState(!compact);
  const mode = PLAY_MODES.find(item => item.id === preferences.mode)!;
  return <section className={styles.controls} data-compact={compact} aria-label="Orb playground">
    <header className={styles.heading}>
      <button type="button" className={styles.disclosure} aria-expanded={open} onClick={() => setOpen(!open)}><Sparkles size={14} /><span>Orb playground</span><ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : undefined }} /></button>
      {onClose && <button type="button" className={styles.icon} onClick={onClose} aria-label="Close orb playground"><X size={14} /></button>}
    </header>
    {open && <div className={styles.content}>
      {!compact && <div className={styles.preview}>
        <PlayfulOrb size={96} theme={theme} state={preview ? 2 : 0} streaming={preview} response={preview ? "Local animation preview" : ""} label="Orb appearance preview" />
        <div><strong>Same orb. More personality.</strong><p>Original colors, glow and eyes stay intact. Every new color treatment is optional.</p><button type="button" className={styles.previewButton} aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? "End preview" : "Preview streaming shape"}</button></div>
      </div>}
      <fieldset><legend>Personality</legend><div className={styles.modeGrid}>
        {PLAY_MODES.map(item => <button key={item.id} type="button" className={styles.option} aria-pressed={preferences.mode === item.id} disabled={native && item.id === "follow"} title={native && item.id === "follow" ? "Pointer-follow is available in the main workspace" : item.hint} onClick={() => setPreferences({ mode: item.id })}>{item.name}</button>)}
      </div><p className={styles.hint}>{mode.hint}</p></fieldset>
      <div className={styles.selectRow}>
        <label>While responding<select aria-label="Streaming shape" value={preferences.morph} onChange={event => setPreferences({ morph: event.target.value as typeof preferences.morph })}>{MORPH_STYLES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Energy<select aria-label="Play energy" value={preferences.energy} onChange={event => setPreferences({ energy: event.target.value as typeof preferences.energy })}><option value="gentle">Gentle</option><option value="balanced">Balanced</option><option value="lively">Lively</option></select></label>
      </div>
      <fieldset><legend>Original palettes</legend><div className={styles.paletteGrid}>
        {ORB_THEMES.map((item, index) => <button key={item.id} className={styles.palette} type="button" title={item.name} aria-label={`${item.name} orb palette`} aria-pressed={theme === index} onClick={() => selectTheme(index)}><i style={{ background: item.barGrad }}>{theme === index && <Check size={12} />}</i><span>{item.name.replace("Apple Intelligence", "Spectrum").replace("Siri Classic", "Classic").replace("Aevora Emerald", "Emerald").replace("RGB Chroma", "Chroma")}</span></button>)}
      </div></fieldset>
      <fieldset><legend>Optional color themes</legend><div className={styles.treatments}>
        {COLOR_TREATMENTS.map(item => <button key={item.id} type="button" className={styles.treatment} aria-pressed={preferences.treatment === item.id} title={item.id === "original" ? "No color filter — keep your original palette" : `${item.name} treatment over the selected palette`} onClick={() => setPreferences({ treatment: item.id })}><i style={{ background: item.swatch }} /><span>{item.name}</span></button>)}
      </div></fieldset>
      <label className={styles.toggle}><input type="checkbox" checked={preferences.reactions} onChange={event => setPreferences({ reactions: event.target.checked })} />Playful reactions</label>
      <div className={styles.tricks} aria-label="Play with the orb">{([ ["wiggle", "Wiggle"], ["hop", "Hop"], ["spin", "Spin"], ["celebrate", "Celebrate"] ] as [OrbTrick, string][]).map(([id, label]) => <button key={id} type="button" disabled={reduced || !preferences.reactions} onClick={() => playOrbTrick(id)}>{label}</button>)}</div>
      {reduced && <p className={styles.notice} role="status">Reduced motion is active. Extra movement and shape animations are paused.</p>}
      <p className={styles.hint}>{native ? "Close the chat to let Roam move the desktop window; hover over it to pause. Pointer-follow is available in the main workspace." : "Drag or gently toss the floating orb. Arrow keys move it; Home brings it back. Travel pauses while its chat is open."}</p>
      <footer className={styles.footer}>
        {onHome && <button type="button" onClick={onHome}>Bring orb home</button>}
        <button type="button" onClick={() => { setPreferences({ ...DEFAULT_PLAY, morph: "off" }); setPreview(false); }}><RotateCcw size={12} />Original look & motion</button>
      </footer>
    </div>}
  </section>;
}
