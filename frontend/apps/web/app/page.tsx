"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  api,
  type ChatSessionItem,
  type MessageItem,
  type ToolItem,
  type UserProfile,
  getSavedTokens,
  quitApp,
} from "../lib/api";
import { TopNavSwitcher, type ViewType } from "../components/nav/TopNavSwitcher";
import { AuthViews } from "../components/auth/AuthViews";
import { SiriVoiceModal } from "../components/orb/SiriVoiceModal";
import { CodexPetOrb } from "../components/orb/CodexPetOrb";
import {
  openDesktopPet,
  closeDesktopPet,
  getPetSyncChannel,
  isDesktopPetOpen,
  subscribeDesktopPetVisibility,
} from "../lib/desktopPet";
import {
  getSavedOrbTheme,
  saveOrbTheme,
  ORB_THEME_CHANGE_EVENT,
} from "../lib/orbTheme";
import { SettingsModal, type SettingsTab } from "../components/settings/SettingsModal";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { ChatMessageList } from "../components/chat/ChatMessageList";
import { ChatInput } from "../components/chat/ChatInput";
import chatStyles from "../components/chat/Chat.module.css";
import type { VoicePromptOptions } from "../components/orb/core/voice-session";

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewType>("login");
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Chat state
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [activeTool, setActiveTool] = useState<{
    name: string;
    status: "start" | "done" | "error";
  } | null>(null);
  const [theme, setTheme] = useState("dark");
  const [orbTheme, setOrbTheme] = useState<number>(() => getSavedOrbTheme());
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [tools, setTools] = useState<ToolItem[]>([]);

  // Modals & Floating Companion
  const [isSiriModalOpen, setIsSiriModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>("boost");
  const [isBoostEnabled, setIsBoostEnabled] = useState(true);
  const [isPetOrbVisible, setIsPetOrbVisible] = useState(true);
  const [petMode, setPetMode] = useState<"docked" | "desktop">("docked");
  const [resetToken, setResetToken] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamTimerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionLoadRef = useRef(0);
  const [companionError, setCompanionError] = useState<string | null>(null);

  useEffect(() => {
    setIsSidebarOpen(!window.matchMedia("(max-width:700px)").matches);
    const unsubscribe = subscribeDesktopPetVisibility((visible) => setPetMode(visible ? "desktop" : "docked"));
    return () => { unsubscribe(); abortControllerRef.current?.abort(); if (streamTimerIdRef.current) clearTimeout(streamTimerIdRef.current); };
  }, []);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ themeIndex: number }>;
      if (customEvent.detail?.themeIndex !== undefined) {
        setOrbTheme(customEvent.detail.themeIndex);
      }
    };
    window.addEventListener(ORB_THEME_CHANGE_EVENT, handleSync);
    return () => window.removeEventListener(ORB_THEME_CHANGE_EVENT, handleSync);
  }, []);

  const handleOrbThemeChange = (newThemeIndex: number) => {
    setOrbTheme(newThemeIndex);
    saveOrbTheme(newThemeIndex);
  };

  const handleOpenSettings = (tab: SettingsTab = "boost") => {
    setSettingsInitialTab(tab);
    setIsSettingsModalOpen(true);
  };

  // Load saved pet visibility, pet mode, and boost preferences
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPet = localStorage.getItem("aevora-pet-enabled");
      if (savedPet !== null) {
        setIsPetOrbVisible(savedPet === "true");
      }
      const savedMode = localStorage.getItem("aevora-pet-mode");
      if (savedMode === "desktop") {
        void isDesktopPetOpen().then((open) => setPetMode(open ? "desktop" : "docked")).catch(() => setPetMode("docked"));
      }
      const savedBoost = localStorage.getItem("aevora-boost-enabled");
      if (savedBoost !== null) {
        setIsBoostEnabled(savedBoost === "true");
      }
    }
  }, []);

  const handleDetachPetToDesktop = async () => {
    setCompanionError(null);
    try {
      const opened = await openDesktopPet();
      if (!opened) throw new Error("Your browser blocked the companion popup. Allow popups for this app and try again.");
      setPetMode("desktop");
    } catch (error) {
      setCompanionError(error instanceof Error ? error.message : "The desktop companion could not open.");
    }
  };

  const handleDockPetInside = async () => {
    try { await closeDesktopPet(); setPetMode("docked"); }
    catch (error) { setCompanionError(error instanceof Error ? error.message : "The companion could not be docked."); }
  };

  const handleToggleBoost = () => {
    setIsBoostEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("aevora-boost-enabled", String(next));
      }
      return next;
    });
  };

  const handleTogglePetOrb = () => {
    setIsPetOrbVisible((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("aevora-pet-enabled", String(next));
      }
      return next;
    });
  };

  // Apply theme to document element
  useEffect(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem("aevora-theme") : null;
    const initialTheme = savedTheme || theme;
    document.documentElement.setAttribute("data-theme", initialTheme);
    if (initialTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("aevora-theme", newTheme);
    }
    if (newTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  };

  // Check URL token for password reset
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        setResetToken(token);
        setCurrentView("reset");
      }
    }
  }, []);

  // Load chat sessions from API
  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  // Inter-window sync channel listener for Desktop Pet
  useEffect(() => {
    const ch = getPetSyncChannel();
    if (!ch) return;

    const handleSync = (e: MessageEvent) => {
      const data = e.data;
      if (!data) return;
      if (data.type === "PET_UNDOCKED") {
        setPetMode("desktop");
      } else if (data.type === "PET_DOCKED") {
        setPetMode("docked");
      } else if (data.type === "PET_STREAM_DONE") {
        loadSessions();
      }
    };

    ch.addEventListener("message", handleSync);
    return () => ch.removeEventListener("message", handleSync);
  }, [loadSessions]);

  // Production App Initialization: Strict Auth Check
  useEffect(() => {
    async function init() {
      // 1. Check backend health
      try {
        const health = await api.health();
        setApiStatus(health.status === "offline" ? "offline" : "online");
      } catch {
        setApiStatus("offline");
      }

      // 2. Strict Auth Check: Only allow chat if valid tokens exist and profile resolves
      const tokens = getSavedTokens();
      if (tokens?.access) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          setCurrentView("chat");

          // Load chat sessions
          const sessionList = await loadSessions();
          if (sessionList.length > 0) {
            setCurrentSessionId(sessionList[0].id);
            try {
              const detail = await api.getSession(sessionList[0].id);
              setMessages(detail.messages || []);
            } catch {}
          }

          // Load tools
          try {
            const toolList = await api.getTools();
            setTools(toolList);
          } catch {}
        } catch {
          // Token invalid or expired: force sign in
          await api.logout();
          setUser(null);
          setCurrentView("login");
        }
      } else {
        // Unauthenticated: keep user on login screen
        setUser(null);
        setCurrentView("login");
      }

      setIsInitializing(false);
    }

    init();
  }, [loadSessions]);

  // Handle successful login or register
  const handleAuthSuccess = async (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setCurrentView("chat");

    const sessionList = await loadSessions();
    if (sessionList.length > 0) {
      setCurrentSessionId(sessionList[0].id);
      try {
        const detail = await api.getSession(sessionList[0].id);
        setMessages(detail.messages || []);
      } catch {}
    } else {
      setCurrentSessionId(null);
      setMessages([]);
    }

    try {
      const toolList = await api.getTools();
      setTools(toolList);
    } catch {}
  };

  // Select a session
  const handleSelectSession = async (sessionId: string) => {
    handleStopStreaming();
    setIsSiriModalOpen(false);
    window.dispatchEvent(new CustomEvent("aevora:voice-owner", { detail: "session-change" }));
    const request = ++sessionLoadRef.current;
    setCurrentSessionId(sessionId);
    setMessages([]);
    try {
      const detail = await api.getSession(sessionId);
      if (request === sessionLoadRef.current) setMessages(detail.messages || []);
    } catch { if (request === sessionLoadRef.current) setMessages([]); }
  };

  // Create new session
  const handleNewSession = async () => {
    if (!user) return;
    handleStopStreaming();
    setIsSiriModalOpen(false);
    window.dispatchEvent(new CustomEvent("aevora:voice-owner", { detail: "new-session" }));
    ++sessionLoadRef.current;
    setCurrentSessionId(null);
    setMessages([]);
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId);
    } catch {}

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      if (remaining.length > 0) {
        handleSelectSession(remaining[0].id);
      } else {
        setCurrentSessionId(null);
        setMessages([]);
      }
    }
  };

  // Presentation lifecycle: the existing API client, endpoints and payloads are unchanged.
  const handleStopStreaming = useCallback(() => {
    const active = abortControllerRef.current;
    abortControllerRef.current = null; // Invalidate callbacks before abort dispatches.
    active?.abort();
    if (streamTimerIdRef.current) clearTimeout(streamTimerIdRef.current);
    streamTimerIdRef.current = null;
    setIsStreaming(false);
    setStreamingMessage("");
    setActiveTool(null);
  }, []);

  const handleSend = async (prompt: string, options?: VoicePromptOptions) => {
    if (!user) { setCurrentView("login"); return; }
    if (!prompt.trim() || options?.signal?.aborted) return;
    handleStopStreaming();
    ++sessionLoadRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let settled = false;
    let response = "";
    let failure: Error | null = null;
    const current = () => abortControllerRef.current === controller && !controller.signal.aborted && !settled;
    const clearRender = () => {
      if (streamTimerIdRef.current) clearTimeout(streamTimerIdRef.current);
      streamTimerIdRef.current = null;
    };
    const externalAbort = () => {
      if (abortControllerRef.current === controller) handleStopStreaming();
      else controller.abort();
    };
    options?.signal?.addEventListener("abort", externalAbort, { once: true });
    setMessages((previous) => [...previous, { id: `u-${crypto.randomUUID()}`, role: "user", content: prompt }]);
    setIsStreaming(true);
    const complete = () => {
      if (!current()) return;
      settled = true;
      clearRender();
      if (response.trim()) setMessages((previous) => [...previous, { id: `ai-${crypto.randomUUID()}`, role: "model", content: response }]);
      setStreamingMessage(""); setIsStreaming(false); setActiveTool(null);
      void loadSessions(); options?.onDone?.();
    };
    const fail = (error: Error) => {
      if (!current()) return;
      failure = error; settled = true; clearRender();
      setMessages((previous) => [...previous, { id: `error-${crypto.randomUUID()}`, role: "model", content: `Error communicating with AI model: ${error.message}` }]);
      setStreamingMessage(""); setIsStreaming(false); setActiveTool(null);
    };
    try {
      await api.streamChat(currentSessionId, prompt, {
        onSessionCreated: (id, title) => {
          if (!current()) return;
          setCurrentSessionId(id);
          setSessions((previous) => [{ id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 1 }, ...previous.filter((item) => item.id !== id)]);
        },
        onChunk: (chunk) => {
          if (!current()) return;
          response += chunk; options?.onChunk?.(chunk);
          // Batch actual received text; never manufacture progress or run an idle 60Hz React timer.
          if (!streamTimerIdRef.current) streamTimerIdRef.current = setTimeout(() => {
            streamTimerIdRef.current = null;
            if (current()) setStreamingMessage(response);
          }, isBoostEnabled ? 32 : 64);
        },
        onToolStart: (name) => { if (current()) setActiveTool({ name, status: "start" }); },
        onToolDone: (name) => { if (current()) setActiveTool({ name, status: "done" }); },
        onToolError: (name) => { if (current()) setActiveTool({ name, status: "error" }); },
        onDone: complete,
        onError: fail,
      }, controller.signal, { voiceMode: !!options?.voiceMode });
      if (current()) complete();
    } catch (error) { fail(error instanceof Error ? error : new Error("The reply could not be completed.")); }
    finally {
      options?.signal?.removeEventListener("abort", externalAbort);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
    // VoiceSession renders and announces this error. Text chat already displays it above.
    if (failure && options?.voiceMode) throw failure;
  };

  const handleVoicePrompt = (prompt: string, options?: VoicePromptOptions) => handleSend(prompt, { ...options, voiceMode: true });

  // Production Logout Handler
  const handleLogout = async () => {
    handleStopStreaming();
    setIsSiriModalOpen(false);
    window.dispatchEvent(new CustomEvent("aevora:voice-owner", { detail: "sign-out" }));
    await closeDesktopPet().catch(() => undefined);
    await api.logout();
    setUser(null);
    setSessions([]);
    setMessages([]);
    setCurrentSessionId(null);
    setCurrentView("login");
  };

  // Quit application handler
  const handleQuit = () => {
    quitApp();
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  // Splash loader during initial auth verification
  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
            <span className="text-xl font-black text-white">A</span>
          </div>
          <span className="text-sm font-semibold tracking-wide text-[var(--text-muted)]">
            Initializing Aevora...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={chatStyles.shell}>
      {/* ─── Production Top Application Header ───────────────────────── */}
      <TopNavSwitcher
        currentView={currentView}
        user={user}
        onViewChange={(v) => setCurrentView(v)}
        onOpenSettings={handleOpenSettings}
        onLogout={handleLogout}
        currentSessionTitle={currentSession?.title}
        apiStatus={apiStatus}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        isSidebarOpen={isSidebarOpen}
        onOpenVoice={() => setIsSiriModalOpen(true)}
        onOpenCompanion={() => { void handleDetachPetToDesktop(); }}
      />
      {companionError && <div className={chatStyles.notice} role="alert">{companionError}<button onClick={() => setCompanionError(null)} aria-label="Dismiss companion error">×</button></div>}

      {/* ─── Main Content: Only Authenticated Users Can Access Chat ── */}
      {user ? (
        <div className={chatStyles.body}>
          {/* Chat Sidebar */}
          <ChatSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            user={user}
            onLogout={handleLogout}
            isOpen={isSidebarOpen}
            onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
            onOpenAuth={() => {}}
            onOpenSettings={() => handleOpenSettings("boost")}
          />

          {/* Main Chat Feed */}
          <main className={chatStyles.main}>
            <ChatMessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingMessage={streamingMessage}
              activeTool={activeTool}
              onSelectPrompt={handleSend}
              onVoicePrompt={handleVoicePrompt}
              onOpenSiriModal={() => setIsSiriModalOpen(true)}
            />

            <ChatInput
              onSend={handleSend}
              isStreaming={isStreaming}
              onToggleVoiceMode={() => setIsSiriModalOpen(true)}
              tools={tools}
              isBoostEnabled={isBoostEnabled}
              onToggleBoost={handleToggleBoost}
              onStopStreaming={handleStopStreaming}
            />
          </main>
        </div>
      ) : (
        /* Unauthenticated: Production Auth Views (Login, Register, Forgot, Reset) */
        <AuthViews
          currentView={currentView}
          onSwitchView={(v) => setCurrentView(v)}
          onAuthSuccess={handleAuthSuccess}
          resetToken={resetToken}
          setResetToken={setResetToken}
        />
      )}

      {/* ─── Siri Voice Orb Modal ────────────────────────────────────── */}
      <SiriVoiceModal
        isOpen={isSiriModalOpen}
        onClose={() => setIsSiriModalOpen(false)}
        onSendVoicePrompt={handleVoicePrompt}
        onStopStreaming={handleStopStreaming}
        isStreaming={isStreaming}
        streamingMessage={streamingMessage}
        activeTool={activeTool}
        orbTheme={orbTheme}
        onOrbThemeChange={handleOrbThemeChange}
      />

      {/* ─── Settings & Boost Preferences Modal ──────────────────────── */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsInitialTab}
        petMode={petMode}
        onDetachPetToDesktop={handleDetachPetToDesktop}
        onDockPetInside={handleDockPetInside}
        onSelectToolPrompt={(prompt) => {
          setIsSettingsModalOpen(false);
          handleSend(prompt);
        }}
        user={user}
        theme={theme}
        onThemeChange={handleThemeChange}
        orbTheme={orbTheme}
        onOrbThemeChange={handleOrbThemeChange}
        isPetOrbVisible={isPetOrbVisible}
        onTogglePetOrb={handleTogglePetOrb}
        onOpenVoiceModal={() => setIsSiriModalOpen(true)}
        tools={tools}
        onRefreshTools={async () => {
          try {
            const list = await api.getTools();
            setTools(list);
          } catch {}
        }}
        onLogout={handleLogout}
        onQuit={handleQuit}
        isBoostEnabled={isBoostEnabled}
        onToggleBoost={handleToggleBoost}
      />

      {/* ─── Floating Codex Pet Orb Companion (In-App Docked Mode) ─── */}
      {petMode === "docked" && (
        <CodexPetOrb
          isVisible={isPetOrbVisible}
          onToggleVisible={handleTogglePetOrb}
          onOpenFullVoiceModal={() => setIsSiriModalOpen(true)}
          onSendPrompt={handleVoicePrompt}
          onStopStreaming={handleStopStreaming}
          onDetachToDesktop={handleDetachPetToDesktop}
          isStreaming={isStreaming}
          streamingMessage={streamingMessage}
          activeTool={activeTool}
        />
      )}
    </div>
  );
}
