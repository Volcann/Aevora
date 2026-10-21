"use client";

import { useEffect } from "react";
import { nudgeDesktopPet } from "../../../lib/desktopPet";
import { energyScale } from "./playful-model";
import { usePlayPreferences } from "./usePlayPreferences";
import { usePlayEnvironment } from "./usePlayEnvironment";

/** Reuses the EXISTING bounded native move API; no Electron/IPC changes. */
export function useNativePlayground(native: boolean, expanded: boolean) {
  const { preferences } = usePlayPreferences();
  const { animate } = usePlayEnvironment();
  useEffect(() => {
    if (!native || expanded || !animate || preferences.mode !== "roam") return;
    let disposed = false;
    let pending = false;
    let phase = 0;
    let hovered = false;
    const enter = () => { hovered = true; };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) hovered = false; };
    document.addEventListener("pointerover", enter);
    document.addEventListener("pointerout", leave);
    const speed = energyScale(preferences.energy);
    const timer = setInterval(() => {
      if (disposed || pending || hovered || document.hidden) return;
      phase += .11;
      pending = true;
      // Deliberately bounded to ~5 calls/sec and one outstanding move.
      void nudgeDesktopPet(Math.round(Math.cos(phase) * 9 * speed), Math.round(Math.sin(phase * .73) * 6 * speed))
        .catch(() => { clearInterval(timer); })
        .finally(() => { pending = false; });
    }, 200);
    return () => { disposed = true; clearInterval(timer); document.removeEventListener("pointerover", enter); document.removeEventListener("pointerout", leave); };
  }, [native, expanded, animate, preferences.mode, preferences.energy]);
}
