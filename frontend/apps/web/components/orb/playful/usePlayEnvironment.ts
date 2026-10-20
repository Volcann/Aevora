"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useOrbMotion } from "../hooks/useOrbMotion";
import { getDesktopRuntime } from "../../../lib/desktop-runtime";

function subscribe(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  document.addEventListener("visibilitychange", callback);
  return () => { query.removeEventListener("change", callback); document.removeEventListener("visibilitychange", callback); };
}
const snapshot = () => (document.hidden ? 2 : 0) + (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0);
/** Pause added motion when hidden, OS-reduced, or the native renderer is inactive. */
export function usePlayEnvironment() {
  const flags = useSyncExternalStore(subscribe, snapshot, () => 0);
  const { pref } = useOrbMotion();
  const [nativeActive, setNativeActive] = useState(true);
  useEffect(() => {
    const desktop = getDesktopRuntime();
    let mounted = true;
    let receivedEvent = false;
    const off = desktop?.onRenderState?.((active) => { receivedEvent = true; if (mounted) setNativeActive(active); });
    void desktop?.getRenderState?.().then((active) => { if (mounted && !receivedEvent) setNativeActive(active); }).catch(() => {});
    return () => { mounted = false; off?.(); };
  }, []);
  const reduced = !!(flags & 1) && pref !== "on";
  const visible = !(flags & 2) && nativeActive;
  return { reduced, visible, animate: !reduced && visible };
}
