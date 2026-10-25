"use client";

export interface DesktopRuntime {
  readonly platform: string;
  openPet(coords?: { x?: number; y?: number }): Promise<boolean>;
  closePet(): Promise<void>;
  isPetOpen(): Promise<boolean>;
  resizePet(width: number, height: number): Promise<void>;
  positionPet(x: number, y: number): Promise<void>;
  nudgePet(dx: number, dy: number): Promise<void>;
  pinPet(pinned: boolean): Promise<void>;
  focusMain(): Promise<void>;
  petReady(): Promise<boolean>;
  quit(): Promise<void>;
  getRenderState(): Promise<boolean>;
  getTokens?(): Promise<{ access?: string; refresh?: string } | null>;
  setTokens?(tokens: { access?: string; refresh?: string }): Promise<boolean>;
  updateRefreshToken?(token: string): Promise<boolean>;
  onPetVisibility(callback: (visible: boolean) => void): () => void;
  onRenderState(callback: (active: boolean) => void): () => void;
  onResume(callback: () => void): () => void;
  onTokensUpdated?(callback: (tokens: { access?: string; refresh?: string }) => void): () => void;
  onOpenTokenSettings?(callback: () => void): () => void;
}

declare global { interface Window { readonly aevoraDesktop?: DesktopRuntime } }
export function getDesktopRuntime(): DesktopRuntime | undefined {
  return typeof window === "undefined" ? undefined : window.aevoraDesktop;
}
