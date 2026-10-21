"use client";

import React, { useState, useEffect } from "react";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import styles from "./Settings.module.css";
import { OrbPlayControls } from "../orb/playful/OrbPlayControls";
import {
  Zap,
  Palette,
  Bot,
  Boxes,
  Shield,
  Activity,
  X,
  Check,
  RefreshCw,
  Power,
  LogOut,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
  ArrowDownLeft,
  Play,
  Cpu,
  Copy,
  Key,
} from "lucide-react";
import {
  api,
  getApiBaseUrl,
  setApiBaseUrl,
  getSavedTokens,
  isJwtExpired,
  type ToolItem,
  type UserProfile,
} from "../../lib/api";
import {
  ORB_THEMES,
  saveOrbTheme,
  getSavedOrbTheme,
  ORB_THEME_CHANGE_EVENT,
  type OrbThemeItem,
} from "../../lib/orbTheme";

export type SettingsTab =
  | "boost"
  | "appearance"
  | "companion"
  | "tools"
  | "account"
  | "diagnostics"
  | "mcps";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  theme: string;
  onThemeChange: (theme: string) => void;
  isPetOrbVisible: boolean;
  onTogglePetOrb: () => void;
  onOpenVoiceModal?: () => void;
  tools: ToolItem[];
  onRefreshTools?: () => Promise<void>;
  onLogout?: () => void;
  onQuit?: () => void;
  isBoostEnabled: boolean;
  onToggleBoost: () => void;
  initialTab?: SettingsTab;
  petMode?: "docked" | "desktop";
  onDetachPetToDesktop?: () => void;
  onDockPetInside?: () => void;
  onSelectToolPrompt?: (prompt: string) => void;
  orbTheme?: number;
  onOrbThemeChange?: (themeIndex: number) => void;
}

const THEME_OPTIONS = [
  { id: "dark", label: "Indigo Dark", desc: "Classic dark theme with vibrant purple & indigo accents", bg: "#0d1117", border: "#7c6aff" },
  { id: "light", label: "Indigo Light", desc: "Clean modern light theme with high contrast text", bg: "#f6f8fa", border: "#6d4aff" },
  { id: "oled", label: "Midnight OLED", desc: "True black with neon violet highlights for OLED displays", bg: "#000000", border: "#8b5cf6" },
  { id: "cyberpunk", label: "Cyberpunk Neon", desc: "Deep ultraviolet night with intense neon glow", bg: "#0a071b", border: "#f43f5e" },
  { id: "aurora", label: "Aurora Borealis", desc: "Dark oceanic night with emerald and cyan luminescence", bg: "#06131a", border: "#10b981" },
  { id: "obsidian", label: "Obsidian Rose", desc: "Deep dark stone with sophisticated rose accents", bg: "#110e14", border: "#fb7185" },
  { id: "ocean", label: "Deep Ocean", desc: "Abyssal blue with oceanic turquoise highlights", bg: "#05111e", border: "#06b6d4" },
  { id: "solarized-dark", label: "Solarized Dark", desc: "Easy on the eyes with low contrast dark tones", bg: "#002b36", border: "#268bd2" },
  { id: "solarized-light", label: "Solarized Light", desc: "Warm and readable light tone for daytime coding", bg: "#fdf6e3", border: "#2aa198" },
  { id: "dracula", label: "Dracula", desc: "A dark theme for many editors, shells, and more", bg: "#282a36", border: "#bd93f9" },
  { id: "monokai", label: "Monokai Pro", desc: "Beautiful color scheme with excellent contrast", bg: "#2d2a2e", border: "#ff6188" },
  { id: "nord", label: "Nord", desc: "An arctic, north-bluish clean and elegant theme", bg: "#2e3440", border: "#88c0d0" },
];

const PRESETS = [
  { h: 138, s: 55, l: 42, label: "Forest" },
  { h: 211, s: 80, l: 42, label: "Ocean" },
  { h: 260, s: 65, l: 52, label: "Violet" },
  { h: 0, s: 72, l: 48, label: "Crimson" },
  { h: 28, s: 80, l: 48, label: "Amber" },
  { h: 180, s: 60, l: 38, label: "Teal" },
  { h: 330, s: 65, l: 48, label: "Rose" },
];

export const SettingsModal = React.memo(function SettingsModal({
  isOpen,
  onClose,
  user,
  theme,
  onThemeChange,
  isPetOrbVisible,
  onTogglePetOrb,
  onOpenVoiceModal,
  tools,
  onRefreshTools,
  onLogout,
  onQuit,
  isBoostEnabled,
  onToggleBoost,
  initialTab = "boost",
  petMode = "docked",
  onDetachPetToDesktop,
  onDockPetInside,
  onSelectToolPrompt,
  orbTheme,
  onOrbThemeChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const dialogRef = useDialogFocus(isOpen, onClose);

  // Aevora Orb theme state synced across components & storage
  const [selectedOrbTheme, setSelectedOrbTheme] = useState<number>(() => {
    return orbTheme !== undefined ? orbTheme : getSavedOrbTheme();
  });

  useEffect(() => {
    if (orbTheme !== undefined) {
      setSelectedOrbTheme(orbTheme);
    }
  }, [orbTheme]);

  useEffect(() => {
    const handleOrbThemeSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ themeIndex: number }>;
      if (customEvent.detail?.themeIndex !== undefined) {
        setSelectedOrbTheme(customEvent.detail.themeIndex);
      }
    };
    window.addEventListener(ORB_THEME_CHANGE_EVENT, handleOrbThemeSync);
    return () => window.removeEventListener(ORB_THEME_CHANGE_EVENT, handleOrbThemeSync);
  }, []);

  const handleSelectOrbTheme = (idx: number) => {
    setSelectedOrbTheme(idx);
    saveOrbTheme(idx);
    onOrbThemeChange?.(idx);
  };

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // HSL tone state
  const [hue, setHue] = useState(250);
  const [sat, setSat] = useState(80);
  const [lit, setLit] = useState(65);

  // Boost settings
  const [isPromptBoostEnabled, setIsPromptBoostEnabled] = useState(true);

  // Connection settings
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sync tools state
  const [isRefreshingTools, setIsRefreshingTools] = useState(false);

  // Diagnostics state
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState<boolean | null>(null);

  // Refresh Token management state
  const [currentRefreshToken, setCurrentRefreshToken] = useState<string>("");
  const [newRefreshTokenInput, setNewRefreshTokenInput] = useState("");
  const [showCurrentToken, setShowCurrentToken] = useState(false);
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [isRefreshingNow, setIsRefreshingNow] = useState(false);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentRefreshToken(getSavedTokens()?.refresh || "");
      setTokenSuccess(null);
      setTokenError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleTokensUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ tokens?: { refresh?: string } }>;
      if (customEvent.detail?.tokens?.refresh) {
        setCurrentRefreshToken(customEvent.detail.tokens.refresh);
      } else {
        setCurrentRefreshToken(getSavedTokens()?.refresh || "");
      }
    };
    window.addEventListener("aevora:tokens-updated", handleTokensUpdated);
    return () => window.removeEventListener("aevora:tokens-updated", handleTokensUpdated);
  }, []);

  // Load prompt boost from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPromptBoost = localStorage.getItem("aevora-prompt-boost");
      if (savedPromptBoost !== null) {
        setIsPromptBoostEnabled(savedPromptBoost === "true");
      }
    }
  }, []);

  // Check battery API
  useEffect(() => {
    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      (navigator as any).getBattery?.().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setBatteryCharging(battery.charging);
      }).catch(() => {});
    }
  }, []);

  if (!isOpen) return null;

  const handleTogglePromptBoost = () => {
    const next = !isPromptBoostEnabled;
    setIsPromptBoostEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("aevora-prompt-boost", String(next));
    }
  };

  const applyAccent = (h: number, s: number, l: number) => {
    setHue(h);
    setSat(s);
    setLit(l);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--accent-h", String(h));
      root.style.setProperty("--accent-s", `${s}%`);
      root.style.setProperty("--accent-l", `${l}%`);
      root.style.setProperty("--gh-green", `hsl(${h}, ${s}%, ${l}%)`);
      root.style.setProperty("--gh-green-dark", `hsl(${h}, ${s}%, ${Math.max(10, l - 12)}%)`);
      root.style.setProperty("--gh-green-bright", `hsl(${h}, ${s}%, ${Math.min(90, l + 15)}%)`);
      root.style.setProperty("--gh-green-glow", `hsla(${h}, ${s}%, ${l}%, 0.28)`);
      root.style.setProperty("--primary", `hsl(${h}, ${s}%, ${l}%)`);
    }
  };

  const handleResetColor = () => {
    applyAccent(250, 80, 65);
  };

  const handleTestConnection = async () => {
    setIsTestingPing(true);
    setPingStatus(null);
    const startTime = performance.now();
    try {
      const res = await fetch(`${apiUrl}/api/v1/health/`);
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        setPingStatus(`🟢 Online (${latency}ms) — Status: ${data.status || "OK"}`);
      } else {
        setPingStatus(`🔴 HTTP Error ${res.status} (${latency}ms)`);
      }
    } catch (err: any) {
      setPingStatus(`🔴 Failed: ${err?.message || "Unreachable"}`);
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleSaveApiUrl = () => {
    setIsSavingUrl(true);
    setApiBaseUrl(apiUrl);
    setTimeout(() => {
      setIsSavingUrl(false);
      setPingStatus("Saved successfully!");
    }, 400);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!oldPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPasswordSuccess(res.message || "Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSyncTools = async () => {
    if (!onRefreshTools) return;
    setIsRefreshingTools(true);
    try {
      await onRefreshTools();
    } finally {
      setIsRefreshingTools(false);
    }
  };

  const handleCopyToken = () => {
    if (!currentRefreshToken) return;
    navigator.clipboard?.writeText(currentRefreshToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleUpdateRefreshToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenError(null);
    setTokenSuccess(null);

    const tokenToApply = newRefreshTokenInput.trim();
    if (!tokenToApply) {
      setTokenError("Please enter a refresh token.");
      return;
    }

    setIsUpdatingToken(true);
    try {
      const result = await api.updateRefreshToken(tokenToApply);
      if (result.success) {
        setTokenSuccess("Refresh token verified and updated successfully! Access token renewed.");
        setCurrentRefreshToken(result.tokens?.refresh || tokenToApply);
        setNewRefreshTokenInput("");
      } else {
        setTokenError(result.error || "Failed to validate refresh token with authentication server.");
      }
    } catch (err: any) {
      setTokenError(err.message || "An unexpected error occurred while updating the refresh token.");
    } finally {
      setIsUpdatingToken(false);
    }
  };

  const handleRefreshNow = async () => {
    setTokenError(null);
    setTokenSuccess(null);
    setIsRefreshingNow(true);
    try {
      const newAccess = await api.refreshAccessToken();
      if (newAccess) {
        const latest = getSavedTokens();
        setCurrentRefreshToken(latest?.refresh || "");
        setTokenSuccess("Access token refreshed successfully from backend!");
      } else {
        setTokenError("Failed to refresh token. The refresh token may be expired or invalid. Please update it with a new one.");
      }
    } catch (err: any) {
      setTokenError(err.message || "Error communicating with authentication server.");
    } finally {
      setIsRefreshingNow(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1500] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby="settings-panel-title"
        className={`${styles.dialog} relative w-full max-w-4xl lg:max-w-5xl h-[720px] max-h-[92vh] bg-surface-solid border border-border rounded-2xl shadow-2xl p-0 overflow-hidden flex flex-col sm:flex-row`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Left Sidebar Navigation */}
        <div className="w-full sm:w-60 md:w-64 bg-surface/80 border-b sm:border-b-0 sm:border-r border-border p-3.5 sm:p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 px-2 py-3 mb-2 border-b border-border/60">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-sm shrink-0">
                <SlidersHorizontal size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground truncate">Settings</div>
                <div className="text-[10px] text-muted-foreground truncate">Preferences & Hub</div>
              </div>
            </div>

            <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("boost")}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap sm:whitespace-normal shrink-0 sm:shrink cursor-pointer ${
                  activeTab === "boost"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Zap size={14} className={activeTab === "boost" ? "fill-current" : "text-amber-400"} />
                <span>AI & Boost Mode</span>
                {isBoostEnabled && activeTab !== "boost" && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("appearance")}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap sm:whitespace-normal shrink-0 sm:shrink cursor-pointer ${
                  activeTab === "appearance"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Palette size={14} className={activeTab === "appearance" ? "" : "text-purple-400"} />
                <span>Appearance</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("companion")}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap sm:whitespace-normal shrink-0 sm:shrink cursor-pointer ${
                  activeTab === "companion"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Bot size={14} className={activeTab === "companion" ? "" : "text-cyan-400"} />
                <span>Companion & Voice</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tools")}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap sm:whitespace-normal shrink-0 sm:shrink cursor-pointer ${
                  activeTab === "tools"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Boxes size={14} className={activeTab === "tools" ? "" : "text-emerald-400"} />
                <span>Agent Tools (Celery)</span>
                <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded-full bg-surface-hover border border-border">
                  {tools.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("account")}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap sm:whitespace-normal shrink-0 sm:shrink cursor-pointer ${
                  activeTab === "account"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Shield size={14} className={activeTab === "account" ? "" : "text-blue-400"} />
                <span>Account &amp; Tokens</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("diagnostics")}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap sm:whitespace-normal shrink-0 sm:shrink cursor-pointer ${
                  activeTab === "diagnostics"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Activity size={14} className={activeTab === "diagnostics" ? "" : "text-red-400"} />
                <span>Diagnostics</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("mcps")}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap sm:whitespace-normal shrink-0 sm:shrink cursor-pointer ${
                  activeTab === "mcps"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Cpu size={14} className={activeTab === "mcps" ? "" : "text-orange-400"} />
                <span>MCP Servers</span>
              </button>

              {/* Mobile-only quick actions */}
              {user && onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="sm:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              )}
              {onQuit && (
                <button
                  type="button"
                  onClick={onQuit}
                  className="sm:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Power size={13} />
                  <span>Quit</span>
                </button>
              )}
            </nav>
          </div>

          {/* Bottom quick actions (desktop) */}
          <div className="hidden sm:flex pt-3 border-t border-border flex-col gap-1.5 shrink-0">
            {user && onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <LogOut size={13} />
                <span>Sign Out ({user.username})</span>
              </button>
            )}
            {onQuit && (
              <button
                type="button"
                onClick={onQuit}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <Power size={13} />
                <span>Quit Application</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Tab Content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-surface-solid overflow-hidden">
          {/* Header */}
          <div className={`${styles.header} px-6 py-4 border-b border-border flex items-center justify-between gap-3 shrink-0`}>
            <div>
              <h2 id="settings-panel-title" className="text-base font-bold text-foreground">
                {activeTab === "boost" && "AI Engine & Performance Boost"}
                {activeTab === "appearance" && "Appearance & Customization"}
                {activeTab === "companion" && "Codex Pet & Voice Assistant"}
                {activeTab === "tools" && "Agent Distributed Tools (Celery Worker)"}
                {activeTab === "account" && "Account & Authentication Tokens"}
                {activeTab === "diagnostics" && "System Diagnostics & Telemetry"}
                {activeTab === "mcps" && "Model Context Protocol (MCP) Servers"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTab === "boost" && "Tune streaming acceleration, slash command (/boost), and connection endpoints."}
                {activeTab === "appearance" && "Choose curated color themes and dial in your precise HSL accent tone."}
                {activeTab === "companion" && "Manage floating Codex companion orb and speech recognition."}
                {activeTab === "tools" && "Aevora executes tools natively via distributed Celery tasks and Redis."}
                {activeTab === "account" && "Manage session tokens, refresh tokens, profile credentials, and security."}
                {activeTab === "diagnostics" && "Live telemetry, network latency, and platform runtime health."}
                {activeTab === "mcps" && "Manage local and remote MCP servers connected to your workspace."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
              title="Close Settings"
              aria-label="Close settings"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className={`${styles.content} flex-1 min-h-0 overflow-y-auto p-6 space-y-6 scrollbar-thin`}>
            {/* ─── TAB 1: AI & BOOST ────────────────────────────────────────── */}
            {activeTab === "boost" && (
              <div className="space-y-5">
                {/* Master Boost Mode Switch */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-surface to-surface border border-amber-500/30 shadow-xs flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                      <Zap size={20} className={isBoostEnabled ? "animate-pulse fill-current" : ""} />
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-bold text-foreground">
                          AI Performance Boost (/boost)
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${
                            isBoostEnabled
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-surface-hover text-muted-foreground border border-border"
                          }`}
                        >
                          {isBoostEnabled ? "⚡ BOOSTED" : "STANDARD"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Accelerate Gemini streaming with low-latency chunk buffering and high-priority tool execution.
                        You can also type <code className="text-amber-300 font-mono text-[11px] bg-black/30 px-1.5 py-0.5 rounded">/boost</code> directly in chat to toggle anytime.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleBoost}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      isBoostEnabled ? "bg-amber-500" : "bg-surface-hover border-border"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isBoostEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Prompt Auto-Enhance Switch */}
                <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-surface-hover text-primary shrink-0 mt-0.5">
                      <SlidersHorizontal size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground">
                        Prompt Auto-Boost (Precision Tuning)
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Automatically structures prompts with contextual clarity before sending to the model, reducing follow-up turns.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTogglePromptBoost}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      isPromptBoostEnabled ? "bg-primary" : "bg-surface-hover border-border"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        isPromptBoostEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Backend Connection URL */}
                <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-foreground">
                        Backend API Base URL
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Colima / Docker container endpoint running Django & Celery.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted-foreground">
                      Default: :8002
                    </span>
                  </div>

                  <div className={`${styles.connectionControls} flex items-center gap-2`}>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="http://127.0.0.1:8002"
                      className="flex-1 px-3 py-2 text-xs rounded-lg bg-input-bg border border-border text-foreground focus:outline-hidden focus:border-primary font-mono"
                    />

                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingPing}
                      className="px-3 py-2 text-xs font-medium rounded-lg bg-surface border border-border hover:bg-surface-hover text-foreground transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isTestingPing && <RefreshCw size={12} className="animate-spin" />}
                      <span>Ping Test</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveApiUrl}
                      disabled={isSavingUrl}
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>

                  {pingStatus && (
                    <div className="text-xs px-3 py-2 rounded-lg bg-black/30 border border-border/80 font-mono">
                      {pingStatus}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 2: APPEARANCE ────────────────────────────────────────── */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                {/* Aevora Voice & Orb Theme Selection */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-surface to-surface border border-cyan-500/30 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-pulse" />
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Aevora Voice &amp; Orb Theme
                      </label>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {ORB_THEMES[selectedOrbTheme]?.name || "Active"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Choose the chromatic plasma shader palette for Aevora Voice Intelligence, the full-screen voice modal, and the Codex companion orb.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {ORB_THEMES.map((ot, idx) => {
                      const isSelected = selectedOrbTheme === idx;
                      return (
                        <button
                          key={ot.id}
                          type="button"
                          onClick={() => handleSelectOrbTheme(idx)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 relative ${
                            isSelected
                              ? "bg-cyan-500/15 border-cyan-400 ring-1 ring-cyan-400/50 shadow-sm"
                              : "bg-surface/60 border-border hover:border-cyan-400/40 hover:bg-surface"
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full mt-0.5 shrink-0 bg-gradient-to-tr ${ot.dotClass} shadow-xs`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${isSelected ? "text-cyan-300" : "text-foreground"}`}>
                                {ot.name}
                              </span>
                              {isSelected && (
                                <Check size={13} className="text-cyan-400 stroke-[2.5]" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                              {ot.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Theme Selector */}
                <div>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2.5">
                    Curated Color Theme
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {THEME_OPTIONS.map((t) => {
                      const isSelected = theme === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => onThemeChange(t.id)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                            isSelected
                              ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-sm"
                              : "bg-surface/50 border-border hover:border-primary/40 hover:bg-surface"
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-full shrink-0 mt-0.5 border"
                            style={{ backgroundColor: t.bg, borderColor: t.border }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">
                                {t.label}
                              </span>
                              {isSelected && (
                                <Check size={13} className="text-primary stroke-[2.5]" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                              {t.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Tone (HSL) Controls */}
                <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        Custom Accent Tone (HSL)
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Fine-tune Hue, Saturation, and Lightness dynamically across all components.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full border border-white/20 shadow-xs"
                        style={{ backgroundColor: `hsl(${hue}, ${sat}%, ${lit}%)` }}
                        title={`hsl(${hue}, ${sat}%, ${lit}%)`}
                      />
                      <button
                        type="button"
                        onClick={handleResetColor}
                        className="text-[11px] text-link hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Sliders */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Hue</span>
                        <span>{hue}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={hue}
                        onChange={(e) => applyAccent(+e.target.value, sat, lit)}
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Saturation</span>
                        <span>{sat}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={sat}
                        onChange={(e) => applyAccent(hue, +e.target.value, lit)}
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Lightness</span>
                        <span>{lit}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="80"
                        value={lit}
                        onChange={(e) => applyAccent(hue, sat, +e.target.value)}
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Quick Color Presets */}
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                      Quick Swatches
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PRESETS.map((p) => {
                        const isSelected = p.h === hue && p.s === sat && p.l === lit;
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => applyAccent(p.h, p.s, p.l)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                              isSelected
                                ? "border-primary bg-primary/20 text-foreground"
                                : "border-border bg-surface hover:bg-surface-hover text-muted-foreground"
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: `hsl(${p.h}, ${p.s}%, ${p.l}%)` }}
                            />
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 3: COMPANION & VOICE ─────────────────────────────────── */}
            {activeTab === "companion" && (
              <div className="space-y-5">
                <OrbPlayControls />
                {/* Codex Pet Orb Toggle */}
                <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                      <Bot size={20} />
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-bold text-foreground">
                          Floating Codex Pet Orb
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${
                            isPetOrbVisible
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : "bg-surface-hover text-muted-foreground border border-border"
                          }`}
                        >
                          {isPetOrbVisible ? "VISIBLE" : "HIDDEN"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Interactive draggable canvas pet in bottom corner that reacts dynamically to AI thinking, tool executions, and user messages.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onTogglePetOrb}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      isPetOrbVisible ? "bg-purple-500" : "bg-surface-hover border-border"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isPetOrbVisible ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Desktop Floating Mode (Float outside or dock inside) */}
                {isPetOrbVisible && (onDetachPetToDesktop || onDockPetInside) && (
                  <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        {petMode === "desktop" ? <ExternalLink size={20} /> : <ArrowDownLeft size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            Desktop Floating Mode
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${
                              petMode === "desktop"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : "bg-surface-hover text-muted-foreground border border-border"
                            }`}
                          >
                            {petMode === "desktop" ? "DESKTOP FLOATING" : "DOCKED IN-APP"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Float Codex Pet anywhere outside this window across your desktop screens, or dock it neatly in the bottom right corner of the chat workspace.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={petMode === "desktop" ? onDockPetInside : onDetachPetToDesktop}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      {petMode === "desktop" ? (
                        <>
                          <ArrowDownLeft size={13} />
                          <span>Dock Inside</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink size={13} />
                          <span>Float Outside</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Aevora Orb Visual Theme Selector */}
                <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        Aevora Orb Visual Theme
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Choose chromatic plasma aura for your companion and voice modal.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-cyan-400">
                      {ORB_THEMES[selectedOrbTheme]?.name}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {ORB_THEMES.map((th, idx) => {
                      const isSelected = selectedOrbTheme === idx;
                      return (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => handleSelectOrbTheme(idx)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.25)] font-semibold"
                              : "bg-surface border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${th.dotClass}`} />
                          <span>{th.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Voice Assistant Launch */}
                {onOpenVoiceModal && (
                  <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                        <Radio size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            Siri-Style Voice Interface
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            FULL-DUPLEX AUDIO
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Real-time conversational voice modal with animated reactive audio orb, microphone listening, and instant spoken audio.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenVoiceModal();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-400/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/25 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      <Radio size={13} />
                      <span>Launch Voice</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 4: AGENT TOOLS (CELERY DISTRIBUTED) ──────────────────── */}
            {activeTab === "tools" && (
              <div className="space-y-4">
                {/* Architecture Clarification Banner */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-emerald-300">
                      Native Celery Distributed Architecture
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Our platform executes automated agent tools asynchronously through backend <strong>Celery workers</strong> and <strong>Redis</strong> task queue (<code className="text-cyan-300 font-mono">laptop.tools,celery</code>).
                      All tools execute server-side with zero local client configuration required.
                    </p>
                  </div>
                </div>

                {/* Worker Diagnostics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-surface/50 border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Execution Worker
                    </span>
                    <span className="text-xs font-semibold text-foreground mt-0.5 block">
                      Celery Worker Engine
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface/50 border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Task Queue
                    </span>
                    <span className="text-xs font-mono text-cyan-300 mt-0.5 block truncate" title="laptop.tools,celery">
                      laptop.tools,celery
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface/50 border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Connected Tools
                    </span>
                    <span className="text-xs font-bold text-emerald-400 mt-0.5 block">
                      {tools.length} Registered
                    </span>
                  </div>
                </div>

                {/* Tools List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      Loaded Background Tools
                    </span>
                    {onRefreshTools && (
                      <button
                        type="button"
                        onClick={handleSyncTools}
                        disabled={isRefreshingTools}
                        className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-hover text-xs font-medium text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={isRefreshingTools ? "animate-spin text-primary" : ""} />
                        <span>Sync Tools</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                    {tools.map((t) => {
                      const promptTemplate = t.description
                        ? `Use ${t.name} to ${t.description.split(".")[0].trim().toLowerCase()}.`
                        : `Use the ${t.name} tool: `;
                      return (
                        <div
                          key={t.name}
                          className="p-3 rounded-xl bg-surface/60 border border-border hover:border-primary/40 transition-colors flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-cyan-300">
                              {t.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover border border-border text-muted-foreground font-mono">
                              celery_task
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {t.description || "Asynchronous agent tool executed by Celery."}
                          </p>
                          {onSelectToolPrompt && (
                            <div className="flex items-center justify-end pt-1 border-t border-border/40 mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectToolPrompt(promptTemplate);
                                  onClose();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/40 text-primary text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Play size={10} className="fill-current" />
                                <span>Run in Chat</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 5: ACCOUNT & TOKENS ────────────────────────────────── */}
            {activeTab === "account" && (
              <div className="space-y-5">
                {/* Profile Card if user exists, else unauthenticated alert */}
                {user ? (
                  <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 flex items-center justify-center text-lg font-black text-white shrink-0 shadow-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-foreground truncate">{user.username}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Account Active
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-amber-300 block">Session Unauthenticated or Expired</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Your session token has expired or is missing. Enter and verify your Refresh Token below to immediately restore and refresh your session across the Electron app and browser without re-logging in.
                      </p>
                    </div>
                  </div>
                )}

                {/* Authentication & Refresh Token Card */}
                <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Key size={15} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          Authentication &amp; Refresh Token
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Controls JWT token rotation with Django. Prevents 401 &quot;Token is expired&quot; errors.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {currentRefreshToken ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Refresh Token Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          No Refresh Token
                        </span>
                      )}
                    </div>
                  </div>

                  {tokenSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span>{tokenSuccess}</span>
                    </div>
                  )}

                  {tokenError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{tokenError}</span>
                    </div>
                  )}

                  {/* Active Refresh Token display */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Current Refresh Token
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showCurrentToken ? "text" : "password"}
                          readOnly
                          value={currentRefreshToken || "No refresh token configured"}
                          className="w-full px-3 py-2 text-xs rounded-lg bg-input-bg border border-border text-foreground font-mono pr-20 select-all"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                          {currentRefreshToken && (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowCurrentToken(!showCurrentToken)}
                                className="p-1 hover:text-foreground transition-colors cursor-pointer"
                                title={showCurrentToken ? "Hide token" : "Show token"}
                              >
                                {showCurrentToken ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button
                                type="button"
                                onClick={handleCopyToken}
                                className="p-1 hover:text-foreground transition-colors cursor-pointer"
                                title="Copy refresh token"
                              >
                                {copiedToken ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {currentRefreshToken && (
                        <button
                          type="button"
                          onClick={handleRefreshNow}
                          disabled={isRefreshingNow}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-surface border border-border hover:bg-surface-hover text-foreground transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                          title="Manually trigger token refresh from backend"
                        >
                          {isRefreshingNow ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          <span>Refresh Now</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form to update/paste new Refresh Token */}
                  <form onSubmit={handleUpdateRefreshToken} className="space-y-3 pt-2 border-t border-border/60">
                    <div>
                      <label className="text-[11px] font-semibold text-foreground block mb-1">
                        Update Refresh Token (Electron &amp; Web)
                      </label>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Paste a new refresh token to instantly authenticate and renew your access token across the application.
                      </p>
                      <textarea
                        rows={2}
                        value={newRefreshTokenInput}
                        onChange={(e) => setNewRefreshTokenInput(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full px-3 py-2 text-xs rounded-lg bg-input-bg border border-border text-foreground font-mono focus:outline-hidden focus:border-primary resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        disabled={isUpdatingToken || !newRefreshTokenInput.trim()}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isUpdatingToken && <RefreshCw size={12} className="animate-spin" />}
                        <span>Update &amp; Verify Token</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Change Password Form (only if user profile is loaded) */}
                {user && (
                  <form onSubmit={handleChangePassword} className="p-4 rounded-xl bg-surface/50 border border-border space-y-3.5">
                    <span className="text-xs font-bold text-foreground block">
                      Change Password
                    </span>

                    {passwordSuccess && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>{passwordSuccess}</span>
                      </div>
                    )}

                    {passwordError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{passwordError}</span>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showOldPassword ? "text" : "password"}
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                            className="w-full px-3 py-2 text-xs rounded-lg bg-input-bg border border-border text-foreground focus:outline-hidden focus:border-primary pr-9"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOldPassword(!showOldPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showOldPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          New Password (min 8 chars)
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-input-bg border border-border text-foreground focus:outline-hidden focus:border-primary pr-9"
                            placeholder="Enter new secure password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full px-3 py-2 text-xs rounded-lg bg-input-bg border border-border text-foreground focus:outline-hidden focus:border-primary"
                          placeholder="Re-type new password"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {passwordLoading && <RefreshCw size={12} className="animate-spin" />}
                        <span>Update Password</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ─── TAB 6: DIAGNOSTICS & TELEMETRY ──────────────────────────── */}
            {activeTab === "diagnostics" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-surface/50 border border-border flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Platform Environment
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      Linux x86_64 Desktop
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface/50 border border-border flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Battery Level
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {batteryLevel !== null ? `${batteryLevel}% ${batteryCharging ? "⚡ (Charging)" : ""}` : "Direct AC / Desktop"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface/50 border border-border flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Aevora Core Version
                    </span>
                    <span className="text-xs font-mono text-cyan-300">
                      v0.1.0-colima
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface/50 border border-border flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Model Provider
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      Google Gemini 2.5 Flash
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground">
                      Backend Gateway Health
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Checks HTTP responsiveness of :8002 endpoints.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingPing}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-hover text-xs font-medium text-foreground transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isTestingPing && <RefreshCw size={11} className="animate-spin" />}
                    <span>Run Ping</span>
                  </button>
                </div>
              </div>
            )}

            {/* ─── TAB 7: MCP SERVERS ──────────────────────────────────────── */}
            {activeTab === "mcps" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-sm font-bold text-foreground">
                        Connected MCP Servers
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Extending agent capabilities with local tools and remote integrations.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-hover text-xs font-medium text-foreground transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={11} />
                      <span>Sync</span>
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg border border-border/60 bg-surface/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Cpu size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>System Filesystem</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400">Online</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">Local file reading and searching</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg border border-border/60 bg-surface/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <Cpu size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>GitHub Integration</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/20 text-indigo-400">Active</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">Repository access and PR management</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-surface/40 shrink-0">
            <span className="text-[11px] text-muted-foreground">
              Aevora Desktop • Colima :8002 • Celery Worker
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
