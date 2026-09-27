"use client";

import NextTopLoader from "nextjs-toploader";

export function TopLoader() {
  return (
    <NextTopLoader color="var(--primary)" height={3} showSpinner={false} />
  );
}
