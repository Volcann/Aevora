"use client";

import { useState, useEffect } from "react";

export function useTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const onChange = () => {
      setIsTouchDevice(mediaQuery.matches);
    };

    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isTouchDevice;
}
