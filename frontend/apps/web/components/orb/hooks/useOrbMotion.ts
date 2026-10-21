"use client";

/**
 * useOrbMotion — persisted user override for orb animation.
 *
 * The orb renderer respects `prefers-reduced-motion: reduce` by default, which
 * completely halts its rAF loop. This hook lets users explicitly opt into full
 * animation even when their OS accessibility setting is on.
 *
 * Values stored in localStorage:
 *   "auto"  → honour the OS preference (default)
 *   "on"    → always animate, regardless of OS setting
 */

import { useSyncExternalStore } from "react";

export const ORB_MOTION_STORAGE_KEY = "aevora-orb-motion";
export const ORB_MOTION_CHANGE_EVENT = "aevora-orb-motion-change";

export type OrbMotionPref = "auto" | "on";

function readPref(): OrbMotionPref {
  if (typeof window === "undefined") return "auto";
  try {
    const val = localStorage.getItem(ORB_MOTION_STORAGE_KEY);
    if (val === "on") return "on";
  } catch { /* storage blocked — fall through */ }
  return "auto";
}

export function savePref(pref: OrbMotionPref): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORB_MOTION_STORAGE_KEY, pref);
  } catch { /* storage blocked — change still works in-memory */ }
  window.dispatchEvent(new CustomEvent(ORB_MOTION_CHANGE_EVENT, { detail: { pref } }));
}

let memory: OrbMotionPref | undefined;

function subscribe(callback: () => void) {
  const sync = (event: Event) => {
    if (event instanceof StorageEvent) {
      if (event.key !== ORB_MOTION_STORAGE_KEY && event.key !== null) return;
      memory = readPref();
    } else {
      memory = (event as CustomEvent<{ pref?: OrbMotionPref }>).detail?.pref ?? readPref();
    }
    callback();
  };
  window.addEventListener(ORB_MOTION_CHANGE_EVENT, sync);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(ORB_MOTION_CHANGE_EVENT, sync);
    window.removeEventListener("storage", sync);
  };
}

const getSnapshot = () => memory ?? readPref();
const getServerSnapshot = (): OrbMotionPref => "auto";

/** Returns the current user motion preference and a setter. */
export function useOrbMotion() {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setPref = (next: OrbMotionPref) => {
    memory = next;
    savePref(next);
  };
  return { pref, setPref };
}

/**
 * Returns true if the orb should currently be reduced/paused.
 * Call this at render time inside any component that needs to know.
 */
export function computeReduced(pref: OrbMotionPref): boolean {
  if (pref === "on") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
