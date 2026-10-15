import { configureStore } from "@reduxjs/toolkit";
import { api } from "./services";

export const createAppStore = () => configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export * from "./services";
export * from "./constants";
export * from "./utils";
