"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PLAY, normalizePlay, type OrbTrick, type PlayPreferences } from "./playful-model";

export const PLAY_STORAGE_KEY = "aevora-orb-play-v1";
export const PLAY_CHANGE_EVENT = "aevora:orb-play-change";
export const PLAY_TRICK_EVENT = "aevora:orb-trick";
let cache: PlayPreferences | undefined;
function read(): PlayPreferences {
  try { return normalizePlay(JSON.parse(localStorage.getItem(PLAY_STORAGE_KEY) || "null")); }
  catch { return { ...DEFAULT_PLAY }; }
}
function snapshot(): PlayPreferences { return cache ??= typeof window === "undefined" ? { ...DEFAULT_PLAY } : read(); }
function subscribe(callback: () => void) {
  const change = () => callback();
  const storage = (event: StorageEvent) => {
    if (event.key !== PLAY_STORAGE_KEY && event.key !== null) return;
    cache = read(); callback();
  };
  window.addEventListener(PLAY_CHANGE_EVENT, change);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(PLAY_CHANGE_EVENT, change); window.removeEventListener("storage", storage); };
}
export function setPlayPreferences(patch: Partial<PlayPreferences>): void {
  if (typeof window === "undefined") return;
  cache = normalizePlay({ ...snapshot(), ...patch });
  try { localStorage.setItem(PLAY_STORAGE_KEY, JSON.stringify(cache)); } catch { /* In-memory settings still work. */ }
  window.dispatchEvent(new Event(PLAY_CHANGE_EVENT));
}
export function playOrbTrick(trick: OrbTrick): void {
  window.dispatchEvent(new CustomEvent(PLAY_TRICK_EVENT, { detail: { trick } }));
}
export function usePlayPreferences() {
  const preferences = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PLAY);
  return { preferences, setPreferences: setPlayPreferences, reset: () => setPlayPreferences(DEFAULT_PLAY) };
}
