"use client";

export interface OrbThemeItem {
  id: string;
  name: string;
  dotClass: string;
  ambient: string;
  boxShadow: string;
  barGrad: string;
  desc: string;
  primaryColor: string;
}

export const ORB_THEMES: OrbThemeItem[] = [
  {
    id: "apple",
    name: "Apple Intelligence",
    dotClass: "dot-rainbow bg-gradient-to-tr from-cyan-400 via-pink-500 to-purple-600",
    ambient: "radial-gradient(circle, rgba(0, 240, 255, 0.28) 0%, rgba(255, 0, 128, 0.22) 42%, rgba(121, 40, 202, 0.16) 65%, transparent 75%)",
    boxShadow: "0 0 60px rgba(0, 240, 255, 0.35), 0 0 100px rgba(255, 0, 128, 0.22), inset 0 0 40px rgba(255, 255, 255, 0.25)",
    barGrad: "linear-gradient(180deg, #00f0ff 0%, #ff0080 60%, #7928ca 100%)",
    desc: "Multi-spectrum neural refraction with vibrant rainbow glow",
    primaryColor: "#00f0ff",
  },
  {
    id: "siri",
    name: "Siri Classic",
    dotClass: "dot-classic bg-gradient-to-tr from-blue-500 via-cyan-400 to-pink-500",
    ambient: "radial-gradient(circle, rgba(0, 124, 240, 0.26) 0%, rgba(0, 223, 216, 0.22) 42%, rgba(255, 0, 127, 0.16) 65%, transparent 75%)",
    boxShadow: "0 0 60px rgba(0, 223, 216, 0.35), 0 0 100px rgba(0, 124, 240, 0.25), inset 0 0 40px rgba(255, 255, 255, 0.25)",
    barGrad: "linear-gradient(180deg, #00dfd8 0%, #007cf0 55%, #ff007f 100%)",
    desc: "Electric azure cyan with magenta acoustic rings",
    primaryColor: "#007cf0",
  },
  {
    id: "emerald",
    name: "Aevora Emerald",
    dotClass: "dot-aevora bg-gradient-to-tr from-emerald-400 via-teal-300 to-amber-400",
    ambient: "radial-gradient(circle, rgba(46, 194, 89, 0.28) 0%, rgba(0, 229, 242, 0.22) 42%, rgba(234, 179, 8, 0.16) 65%, transparent 75%)",
    boxShadow: "0 0 60px rgba(46, 194, 89, 0.35), 0 0 100px rgba(0, 229, 242, 0.25), inset 0 0 40px rgba(255, 255, 255, 0.25)",
    barGrad: "linear-gradient(180deg, #00e5f2 0%, #2ec259 55%, #eab308 100%)",
    desc: "Signature Aevora bio-luminescence with emerald and gold",
    primaryColor: "#2ec259",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    dotClass: "dot-cyber bg-gradient-to-tr from-rose-500 via-cyan-400 to-yellow-400",
    ambient: "radial-gradient(circle, rgba(255, 0, 85, 0.28) 0%, rgba(0, 255, 255, 0.22) 42%, rgba(250, 204, 21, 0.16) 65%, transparent 75%)",
    boxShadow: "0 0 60px rgba(255, 0, 85, 0.35), 0 0 100px rgba(0, 255, 255, 0.25), inset 0 0 40px rgba(255, 255, 255, 0.25)",
    barGrad: "linear-gradient(180deg, #00ffff 0%, #ff0055 55%, #ffe600 100%)",
    desc: "High-contrast neon rose, cyan, and electric yellow",
    primaryColor: "#ff0055",
  },
  {
    id: "cosmic",
    name: "Cosmic",
    dotClass: "dot-nebula bg-gradient-to-tr from-purple-500 via-orange-500 to-sky-400",
    ambient: "radial-gradient(circle, rgba(157, 78, 221, 0.28) 0%, rgba(255, 84, 0, 0.22) 42%, rgba(0, 180, 216, 0.16) 65%, transparent 75%)",
    boxShadow: "0 0 60px rgba(157, 78, 221, 0.35), 0 0 100px rgba(255, 84, 0, 0.22), inset 0 0 40px rgba(255, 255, 255, 0.25)",
    barGrad: "linear-gradient(180deg, #38bdf8 0%, #9d4edd 55%, #ff5400 100%)",
    desc: "Deep nebula violet and solar flare orange",
    primaryColor: "#9d4edd",
  },
  {
    id: "rgb",
    name: "RGB Chroma",
    dotClass: "dot-rgb bg-gradient-to-tr from-red-500 via-green-400 to-blue-500",
    ambient: "radial-gradient(circle, rgba(255, 0, 80, 0.32) 0%, rgba(0, 255, 120, 0.26) 35%, rgba(0, 120, 255, 0.22) 65%, transparent 75%)",
    boxShadow: "0 0 60px rgba(255, 0, 80, 0.45), 0 0 100px rgba(0, 255, 120, 0.35), inset 0 0 40px rgba(0, 150, 255, 0.35)",
    barGrad: "linear-gradient(180deg, #ff0055 0%, #00ff66 50%, #0066ff 100%)",
    desc: "Dynamic RGB Chroma spectrum wave with rotating red, green, and blue hues",
    primaryColor: "#ff0055",
  },
];

export const ORB_THEME_STORAGE_KEY = "aevora-orb-theme";
export const ORB_THEME_CHANGE_EVENT = "aevora-orb-theme-change";

export function normalizeOrbTheme(value: number | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < ORB_THEMES.length ? value : 5;
}

export function getSavedOrbTheme(): number {
  if (typeof window === "undefined") return 5; // Default to RGB Chroma
  try {
    const migrated = localStorage.getItem("aevora_orb_migrated_rgb");
    if (!migrated) {
      localStorage.setItem("aevora_orb_migrated_rgb", "true");
      localStorage.setItem(ORB_THEME_STORAGE_KEY, "5");
      return 5;
    }
    const val = localStorage.getItem(ORB_THEME_STORAGE_KEY);
    if (val !== null && val.trim() !== "") {
      return normalizeOrbTheme(Number(val));
    }
  } catch {}
  return 5;
}

export function saveOrbTheme(themeIndex: number): void {
  if (typeof window === "undefined") return;
  const safeIndex = normalizeOrbTheme(themeIndex);
  try {
    localStorage.setItem(ORB_THEME_STORAGE_KEY, String(safeIndex));
  } catch { /* Theme changes still work when persistent storage is blocked. */ }
  window.dispatchEvent(
    new CustomEvent(ORB_THEME_CHANGE_EVENT, { detail: { themeIndex: safeIndex } })
  );
}
