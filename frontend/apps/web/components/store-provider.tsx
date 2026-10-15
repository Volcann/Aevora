"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";
import { createAppStore } from "@repo/store";

export function StoreProvider({ children }: { children: ReactNode }) {
  // A provider/request owns its store; SSR requests must not share user state.
  const [store] = useState(createAppStore);
  useEffect(() => setupListeners(store.dispatch), [store]);
  return <Provider store={store}>{children}</Provider>;
}
