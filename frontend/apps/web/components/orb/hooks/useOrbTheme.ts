"use client";

import { useSyncExternalStore } from "react";
import { getSavedOrbTheme, normalizeOrbTheme, ORB_THEME_CHANGE_EVENT, ORB_THEME_STORAGE_KEY, saveOrbTheme } from "../../../lib/orbTheme";

let memoryTheme: number | undefined;
function subscribe(callback: () => void) {
  const sync = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== ORB_THEME_STORAGE_KEY && event.key !== null) return;
    memoryTheme = event instanceof CustomEvent
      ? normalizeOrbTheme((event as CustomEvent<{ themeIndex?: number }>).detail?.themeIndex)
      : getSavedOrbTheme();
    callback();
  };
  window.addEventListener(ORB_THEME_CHANGE_EVENT, sync);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(ORB_THEME_CHANGE_EVENT, sync);
    window.removeEventListener("storage", sync);
  };
}
const getSnapshot = () => memoryTheme ?? getSavedOrbTheme();
const getServerSnapshot = () => 1;

export function useOrbTheme(value?: number, onChange?: (index: number) => void) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const theme = normalizeOrbTheme(value ?? stored);
  const selectTheme = (index: number) => {
    const safe = normalizeOrbTheme(index);
    memoryTheme = safe;
    saveOrbTheme(safe);
    onChange?.(safe);
  };
  return { theme, selectTheme };
}
