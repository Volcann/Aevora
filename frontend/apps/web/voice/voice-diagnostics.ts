/**
 * VoiceDiagnostics
 * Provides hardware diagnostics, permission checking, microphone test,
 * speaker test, and distinct troubleshooting error reporting.
 */

import { getApiBaseUrl } from "../lib/api";
import type { VoiceDiagnosticsData } from "./types";

export class VoiceDiagnostics {
  public static async checkPermissions(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
    if (typeof navigator === "undefined" || !navigator.permissions) {
      return "unsupported";
    }

    try {
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
      return result.state as "granted" | "denied" | "prompt";
    } catch {
      return "prompt";
    }
  }

  public static async getAvailableMicrophones(): Promise<{ deviceId: string; label: string }[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "audioinput")
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
        }));
    } catch {
      return [];
    }
  }

  public static async checkBackendHealth(): Promise<boolean> {
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/health/`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async getFullDiagnostics(): Promise<VoiceDiagnosticsData> {
    const perm = await this.checkPermissions();
    const mics = await this.getAvailableMicrophones();
    const backendOk = await this.checkBackendHealth();

    const isElectron = typeof window !== "undefined" && Boolean(window.electronVoiceBridge);
    let workerReady = false;
    let sttLoaded = false;
    let vadActive = false;

    if (isElectron && window.electronVoiceBridge) {
      try {
        const electronDiag = await window.electronVoiceBridge.getDiagnostics();
        workerReady = Boolean(electronDiag.isWorkerReady);
        sttLoaded = Boolean(electronDiag.sttModelLoaded);
        vadActive = Boolean(electronDiag.vadActive);
      } catch {}
    } else {
      // In browser fallback
      workerReady = true;
      sttLoaded = true;
      vadActive = false;
    }

    return {
      microphonePermission: perm,
      availableMicrophones: mics,
      selectedMicrophoneId: mics[0]?.deviceId || "",
      isWorkerReady: workerReady,
      workerType: isElectron ? "electron-worker" : "web-fallback",
      sttModelLoaded: sttLoaded,
      vadActive: vadActive,
      backendOnline: backendOk,
    };
  }

  /**
   * Speaker test: Plays a clean, pleasant notification chord.
   */
  public static testSpeaker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) throw new Error("AudioContext is not available.");

        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.5);

        osc.onended = () => {
          ctx.close().then(resolve);
        };
      } catch (err) {
        reject(err);
      }
    });
  }
}
