import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web builds retain the original server auth proxy. The isolated desktop
  // build exports static assets instead; see scripts/build-desktop.mjs.
  ...(process.env.AEVORA_DESKTOP_BUILD === "1" ? { output: "export" as const } : {}),
  trailingSlash: true,
  transpilePackages: ["@repo/ui", "@repo/store"],
};

export default nextConfig;
