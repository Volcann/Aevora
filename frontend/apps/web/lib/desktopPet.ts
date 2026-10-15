"use client";

import { getDesktopRuntime } from "./desktop-runtime";

export interface PetSyncMessage {
  type: "PET_PROMPT_SENT" | "PET_STREAM_CHUNK" | "PET_STREAM_DONE" | "MAIN_STREAM_CHUNK" | "MAIN_STREAM_DONE" | "ACTIVE_TOOL" | "PET_DOCKED" | "PET_UNDOCKED" | "AUTH_SYNC" | "MOOD_CHANGE";
  payload?: unknown;
}
let syncChannel: BroadcastChannel | null = null;
let popup: Window | null = null;
export function getPetSyncChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  try { syncChannel ??= new BroadcastChannel("aevora_pet_sync_channel"); } catch { return null; }
  return syncChannel;
}
export function broadcastPetMessage(message: PetSyncMessage): void {
  try { getPetSyncChannel()?.postMessage(message); } catch { /* Optional UI synchronization. */ }
}
export function isElectronApp(): boolean { return Boolean(getDesktopRuntime()); }
function saveMode(mode: "desktop" | "docked"): void {
  try { localStorage.setItem("aevora-pet-mode", mode); } catch { /* Optional persistence. */ }
}
export async function openDesktopPet(coords?: { x?: number; y?: number }): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const desktop = getDesktopRuntime();
  if (desktop) await desktop.openPet(coords);
  else {
    if (popup && !popup.closed) { popup.focus(); return true; }
    const left = coords?.x ?? Math.max(0, window.screen.availWidth - 390);
    const top = coords?.y ?? Math.max(0, window.screen.availHeight - 620);
    popup = window.open("/pet/", "AevoraCompanion", `popup=yes,width=360,height=552,left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=no`);
    if (!popup) return false;
    popup.focus();
  }
  saveMode("desktop");
  broadcastPetMessage({ type: "PET_UNDOCKED" });
  return true;
}
export async function closeDesktopPet(): Promise<void> {
  const desktop = getDesktopRuntime();
  if (desktop) await desktop.closePet();
  else if (typeof window !== "undefined" && window.location.pathname.startsWith("/pet") && window.opener) window.close();
  else { popup?.close(); popup = null; }
  saveMode("docked");
  broadcastPetMessage({ type: "PET_DOCKED" });
}
export async function isDesktopPetOpen(): Promise<boolean> {
  return getDesktopRuntime()?.isPetOpen() ?? Boolean(popup && !popup.closed);
}
export async function resizeDesktopPet(width: number, height: number): Promise<void> {
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("Invalid companion dimensions.");
  await getDesktopRuntime()?.resizePet(width, height);
}
export async function setDesktopPetPosition(x: number, y: number): Promise<void> {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid companion position.");
  await getDesktopRuntime()?.positionPet(x, y);
}
export async function setDesktopPetPinned(pinned: boolean): Promise<void> { await getDesktopRuntime()?.pinPet(pinned); }
export async function focusMainWindow(): Promise<void> {
  const desktop = getDesktopRuntime();
  if (desktop) await desktop.focusMain();
  else if (window.opener && !window.opener.closed) window.opener.focus();
  else window.open("/", "AevoraMain");
}
export function subscribeDesktopPetVisibility(callback: (visible: boolean) => void): () => void {
  const unsubscribe = getDesktopRuntime()?.onPetVisibility(callback);
  const channel = getPetSyncChannel();
  const onMessage = (event: MessageEvent<PetSyncMessage>) => {
    if (event.data?.type === "PET_DOCKED") callback(false);
    if (event.data?.type === "PET_UNDOCKED") callback(true);
  };
  channel?.addEventListener("message", onMessage);
  return () => { unsubscribe?.(); channel?.removeEventListener("message", onMessage); };
}
export async function nudgeDesktopPet(dx: number, dy: number): Promise<void> {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error("Invalid companion movement.");
  await getDesktopRuntime()?.nudgePet(dx, dy);
}
export async function notifyDesktopPetReady(): Promise<boolean> { return getDesktopRuntime()?.petReady() ?? true; }
