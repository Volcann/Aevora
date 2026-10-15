"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { StreamingText } from "../lib/streaming-text";
import {
  api,
  type AIModelItem,
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
import type { SettingsTab } from "../components/settings/SettingsModal";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { ChatMessageList } from "../components/chat/ChatMessageList";
import { ChatInput } from "../components/chat/ChatInput";
import chatStyles from "../components/chat/Chat.module.css";
import type { VoicePromptOptions } from "../components/orb/core/voice-session";

// Keep the settings chunk off the initial route. Once opened, retain its state
// while closed (including unsaved connection settings and selected tabs).
const SettingsModal = dynamic(() => import("../components/settings/SettingsModal").then((module) => module.SettingsModal));

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
  const [models, setModels] = useState<AIModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aevora-selected-model") || null;
    }
    return null;
  });

  // Modals & Floating Companion
  const [isSiriModalOpen, setIsSiriModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>("boost");
  const [isBoostEnabled, setIsBoostEnabled] = useState(true);
  const [isPetOrbVisible, setIsPetOrbVisible] = useState(true);
  const [petMode, setPetMode] = useState<"docked" | "desktop">("docked");
  const [resetToken, setResetToken] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamPresentationRef = useRef<StreamingText | null>(null);
  const authLoadRef = useRef(0);
  const sessionsLoadRef = useRef(0);
  const sessionLoadRef = useRef(0);
  const [companionError, setCompanionError] = useState<string | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);

  useEffect(() => {
    setIsSidebarOpen(!window.matchMedia("(max-width:700px)").matches);
    const unsubscribe = subscribeDesktopPetVisibility((visible) => setPetMode(visible ? "desktop" : "docked"));
    return () => {
      unsubscribe();
      abortControllerRef.current?.abort();
      streamPresentationRef.current?.cancel();
      ++sessionLoadRef.current;
    };
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

  const handleOrbThemeChange = useCallback((newThemeIndex: number) => {
    setOrbTheme(newThemeIndex);
    saveOrbTheme(newThemeIndex);
  }, []);

  const handleOpenSettings = useCallback((tab: SettingsTab = "boost") => {
    setHasOpenedSettings(true);
    setSettingsInitialTab(tab);
    setIsSettingsModalOpen(true);
  }, []);

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

  const handleDetachPetToDesktop = useCallback(async () => {
    setCompanionError(null);
    try {
      const opened = await openDesktopPet();
      if (!opened) throw new Error("Your browser blocked the companion popup. Allow popups for this app and try again.");
      setPetMode("desktop");
    } catch (error) {
      setCompanionError(error instanceof Error ? error.message : "The desktop companion could not open.");
    }
  }, []);

  const handleDockPetInside = useCallback(async () => {
    try { await closeDesktopPet(); setPetMode("docked"); }
    catch (error) { setCompanionError(error instanceof Error ? error.message : "The companion could not be docked."); }
  }, []);

  const handleToggleBoost = useCallback(() => {
    setIsBoostEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("aevora-boost-enabled", String(next));
      }
      return next;
    });
  }, []);

  const handleTogglePetOrb = useCallback(() => {
    setIsPetOrbVisible((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("aevora-pet-enabled", String(next));
      }
      return next;
    });
  }, []);

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

  const handleThemeChange = useCallback((newTheme: string) => {
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
  }, []);

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
    const authRequest = authLoadRef.current;
    const request = ++sessionsLoadRef.current;
    try {
      const data = await api.getSessions();
      if (authRequest === authLoadRef.current && request === sessionsLoadRef.current) setSessions(data);
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

  // These requests are independent. Loading them together avoids a sequential
  // health -> profile -> history -> tools -> models waterfall.
  const loadWorkspace = useCallback(async (authRequest: number) => {
    const selectionRequest = sessionLoadRef.current;
    const current = () => authRequest === authLoadRef.current;
    const restoreConversation = async () => {
      const sessionList = await loadSessions();
      if (!current() || selectionRequest !== sessionLoadRef.current) return;
      const first = sessionList[0];
      setCurrentSessionId(first?.id ?? null);
      setMessages([]);
      if (!first) return;
      try {
        const detail = await api.getSession(first.id);
        if (current() && selectionRequest === sessionLoadRef.current) setMessages(detail.messages || []);
      } catch { /* A failed history request must not overwrite a newer selection. */ }
    };
    await Promise.all([
      restoreConversation(),
      api.getTools().then((list) => { if (current()) setTools(list); }).catch(() => undefined),
      api.getModels().then((list) => {
        if (!current()) return;
        setModels(list);
        if (list.length) {
          const saved = localStorage.getItem("aevora-selected-model");
          setSelectedModel(saved && list.some((model) => model.name === saved) ? saved : list[0]!.name);
        }
      }).catch(() => undefined),
    ]);
  }, [loadSessions]);

  useEffect(() => {
    const request = ++authLoadRef.current;
    const current = () => request === authLoadRef.current;
    let mounted = true;
    // A slow/offline health endpoint should not hold the sign-in form hostage.
    void api.health().then((health) => {
      if (mounted) setApiStatus(health.status === "offline" ? "offline" : "online");
    }).catch(() => { if (mounted) setApiStatus("offline"); });

    async function init() {
      try {
        // Preserve password-reset links rather than overwriting them with login.
        if (new URLSearchParams(window.location.search).get("token")) {
          setUser(null);
          setCurrentView("reset");
          return;
        }
        if (getSavedTokens()?.access) {
          const profile = await api.getMe();
          if (!current()) return;
          setUser(profile);
          setCurrentView("chat");
          await loadWorkspace(request);
        } else {
          setUser(null);
          setCurrentView("login");
        }
      } catch {
        if (!current()) return;
        await api.logout();
        if (!current()) return;
        setUser(null);
        setCurrentView("login");
      } finally {
        if (current()) setIsInitializing(false);
      }
    }
    void init();
    return () => { mounted = false; if (current()) ++authLoadRef.current; };
  }, [loadWorkspace]);

  const handleAuthSuccess = useCallback(async (authenticatedUser: UserProfile) => {
    const request = ++authLoadRef.current;
    ++sessionLoadRef.current;
    setUser(authenticatedUser);
    setCurrentView("chat");
    setConversationError(null);
    await loadWorkspace(request);
  }, [loadWorkspace]);

  // Cancel presentation and transport together; stale callbacks cannot revive a turn.
  const handleStopStreaming = useCallback(() => {
    const active = abortControllerRef.current;
    abortControllerRef.current = null;
    active?.abort();
    streamPresentationRef.current?.cancel();
    streamPresentationRef.current = null;
    setIsStreaming(false);
    setStreamingMessage("");
    setActiveTool(null);
  }, []);

  // Select a session
  const handleSelectSession = useCallback(async (sessionId: string) => {
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
  }, [handleStopStreaming]);

  // Select an AI model
  const handleSelectModel = useCallback((modelName: string) => {
    setSelectedModel(modelName);
    if (typeof window !== "undefined") {
      localStorage.setItem("aevora-selected-model", modelName);
    }
  }, []);

  // Create new session
  const handleNewSession = useCallback(async () => {
    if (!user) return;
    handleStopStreaming();
    setIsSiriModalOpen(false);
    window.dispatchEvent(new CustomEvent("aevora:voice-owner", { detail: "new-session" }));
    ++sessionLoadRef.current;
    setCurrentSessionId(null);
    setMessages([]);
  }, [user, handleStopStreaming]);

  // Delete only after the server accepts it. A late delete must not replace
  // a conversation the user selected while the request was in flight.
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const selectionRequest = sessionLoadRef.current;
    const authRequest = authLoadRef.current;
    setConversationError(null);
    try {
      await api.deleteSession(sessionId);
    } catch {
      if (authRequest === authLoadRef.current) setConversationError("The conversation could not be deleted. Please try again.");
      return;
    }
    if (authRequest !== authLoadRef.current) return;
    ++sessionsLoadRef.current;
    setSessions((previous) => previous.filter((session) => session.id !== sessionId));
    if (currentSessionId === sessionId && selectionRequest === sessionLoadRef.current) {
      handleStopStreaming();
      ++sessionLoadRef.current;
      const remaining = sessions.filter((session) => session.id !== sessionId);
      if (remaining[0]) void handleSelectSession(remaining[0].id);
      else {
        setCurrentSessionId(null);
        setMessages([]);
      }
    }
  }, [sessions, currentSessionId, handleSelectSession, handleStopStreaming]);

  const handleSend = useCallback(async (prompt: string, options?: VoicePromptOptions) => {
    if (!user) { setCurrentView("login"); return; }
    if (!prompt.trim() || options?.signal?.aborted) return;
    handleStopStreaming();
    ++sessionLoadRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let settled = false;
    let failure: Error | null = null;
    const current = () => abortControllerRef.current === controller && !controller.signal.aborted && !settled;
    const externalAbort = () => {
      if (abortControllerRef.current === controller) handleStopStreaming();
      else controller.abort();
    };
    options?.signal?.addEventListener("abort", externalAbort, { once: true });
    setMessages((previous) => [...previous, { id: `u-${crypto.randomUUID()}`, role: "user", content: prompt }]);
    setIsStreaming(true);

    const presentation = new StreamingText({
      boosted: isBoostEnabled,
      onText: (text) => { if (current()) setStreamingMessage(text); },
      onComplete: (response) => {
        if (!current()) return;
        settled = true;
        if (response.trim()) {
          setMessages((previous) => [
            ...previous,
            { id: `ai-${crypto.randomUUID()}`, role: "model", content: response, model_name: selectedModel || undefined },
          ]);
        }
        setStreamingMessage("");
        setIsStreaming(false);
        setActiveTool(null);
        void loadSessions();
        options?.onDone?.();
      },
    });
    streamPresentationRef.current = presentation;
    const complete = () => { if (current()) presentation.complete(); };

    const fail = (error: Error) => {
      if (!current()) return;
      failure = error;
      settled = true;
      presentation.cancel();
      setMessages((previous) => [
        ...previous,
        { id: `error-${crypto.randomUUID()}`, role: "model", content: `Error communicating with AI model: ${error.message}` },
      ]);
      setStreamingMessage("");
      setIsStreaming(false);
      setActiveTool(null);
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
          presentation.append(chunk);
          options?.onChunk?.(chunk);
        },
        onToolStart: (name) => { if (current()) setActiveTool({ name, status: "start" }); },
        onToolDone: (name) => { if (current()) setActiveTool({ name, status: "done" }); },
        onToolError: (name) => { if (current()) setActiveTool({ name, status: "error" }); },
        onDone: complete,
        onError: fail,
      }, controller.signal, { voiceMode: !!options?.voiceMode, model: selectedModel || undefined });
      if (current()) complete();
      // The network may finish before the typewriter. Keep cancellation and
      // the current-request guard alive until the last character is committed.
      await presentation.finished;
    } catch (error) { fail(error instanceof Error ? error : new Error("The reply could not be completed.")); }
    finally {
      options?.signal?.removeEventListener("abort", externalAbort);
      presentation.cancel();
      if (streamPresentationRef.current === presentation) streamPresentationRef.current = null;
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
    // VoiceSession renders and announces this error. Text chat already displays it above.
    if (failure && options?.voiceMode) throw failure;
  }, [user, currentSessionId, selectedModel, isBoostEnabled, handleStopStreaming, loadSessions]);

  const handleVoicePrompt = useCallback((prompt: string, options?: VoicePromptOptions) => handleSend(prompt, { ...options, voiceMode: true }), [handleSend]);

  // Production Logout Handler
  const handleLogout = useCallback(async () => {
    ++authLoadRef.current;
    ++sessionLoadRef.current;
    ++sessionsLoadRef.current;
    handleStopStreaming();
    setIsSettingsModalOpen(false);
    setConversationError(null);
    setIsSiriModalOpen(false);
    window.dispatchEvent(new CustomEvent("aevora:voice-owner", { detail: "sign-out" }));
    await closeDesktopPet().catch(() => undefined);
    await api.logout();
    setUser(null);
    setTools([]);
    setModels([]);
    setSessions([]);
    setMessages([]);
    setCurrentSessionId(null);
    setCurrentView("login");
  }, [handleStopStreaming]);

  const currentSession = useMemo(() => sessions.find((s) => s.id === currentSessionId), [sessions, currentSessionId]);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((open) => !open), []);
  const closeSettings = useCallback(() => setIsSettingsModalOpen(false), []);
  const openBoostSettings = useCallback(() => handleOpenSettings("boost"), [handleOpenSettings]);
  const selectToolPrompt = useCallback((prompt: string) => {
    setIsSettingsModalOpen(false);
    void handleSend(prompt);
  }, [handleSend]);
  const refreshTools = useCallback(async () => {
    const request = authLoadRef.current;
    try {
      const list = await api.getTools();
      if (request === authLoadRef.current) setTools(list);
    } catch { /* Keep the last successful tool list on a temporary failure. */ }
  }, []);

  const openVoice = useCallback(() => setIsSiriModalOpen(true), []);
  const closeVoice = useCallback(() => setIsSiriModalOpen(false), []);

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
        onViewChange={setCurrentView}
        onOpenSettings={openBoostSettings}
        currentSessionTitle={currentSession?.title}
        apiStatus={apiStatus}
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        onOpenVoice={openVoice}
        onOpenCompanion={handleDetachPetToDesktop}
      />
      {companionError && <div className={chatStyles.notice} role="alert">{companionError}<button onClick={() => setCompanionError(null)} aria-label="Dismiss companion error">×</button></div>}

      {conversationError && <div className={chatStyles.notice} role="alert">{conversationError}<button onClick={() => setConversationError(null)} aria-label="Dismiss conversation error">×</button></div>}

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
            onToggleOpen={toggleSidebar}
            onOpenSettings={openBoostSettings}
          />

          {/* Main Chat Feed */}
          <main className={chatStyles.main}>
            <ChatMessageList
              key={currentSessionId ?? "new-conversation"}
              messages={messages}
              isStreaming={isStreaming}
              streamingMessage={streamingMessage}
              activeTool={activeTool}
              onSelectPrompt={handleSend}
              onVoicePrompt={handleVoicePrompt}
              onOpenSiriModal={openVoice}
            />

            <ChatInput
              onSend={handleSend}
              isStreaming={isStreaming}
              onToggleVoiceMode={openVoice}
              tools={tools}
              models={models}
              selectedModel={selectedModel}
              onSelectModel={handleSelectModel}
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
          onSwitchView={setCurrentView}
          onAuthSuccess={handleAuthSuccess}
          resetToken={resetToken}
          setResetToken={setResetToken}
        />
      )}

      {/* ─── Siri Voice Orb Modal ────────────────────────────────────── */}
      <SiriVoiceModal
        isOpen={isSiriModalOpen}
        onClose={closeVoice}
        onSendVoicePrompt={handleVoicePrompt}
        onStopStreaming={handleStopStreaming}
        isStreaming={isStreaming}
        streamingMessage={streamingMessage}
        activeTool={activeTool}
        orbTheme={orbTheme}
        onOrbThemeChange={handleOrbThemeChange}
      />

      {/* ─── Settings & Boost Preferences Modal ──────────────────────── */}
      {hasOpenedSettings && <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={closeSettings}
        initialTab={settingsInitialTab}
        petMode={petMode}
        onDetachPetToDesktop={handleDetachPetToDesktop}
        onDockPetInside={handleDockPetInside}
        onSelectToolPrompt={selectToolPrompt}
        user={user}
        theme={theme}
        onThemeChange={handleThemeChange}
        orbTheme={orbTheme}
        onOrbThemeChange={handleOrbThemeChange}
        isPetOrbVisible={isPetOrbVisible}
        onTogglePetOrb={handleTogglePetOrb}
        onOpenVoiceModal={openVoice}
        tools={tools}
        onRefreshTools={refreshTools}
        onLogout={handleLogout}
        onQuit={quitApp}
        isBoostEnabled={isBoostEnabled}
        onToggleBoost={handleToggleBoost}
      />}

      {/* ─── Floating Codex Pet Orb Companion (In-App Docked Mode) ─── */}
      {petMode === "docked" && (
        <CodexPetOrb
          isVisible={isPetOrbVisible}
          onToggleVisible={handleTogglePetOrb}
          onOpenFullVoiceModal={openVoice}
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
