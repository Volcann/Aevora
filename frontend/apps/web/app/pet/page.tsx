"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  AtSign,
  Boxes,
  Check,
  ChevronDown,
  Cpu,
  GripHorizontal,
  MessageCircle,
  Minimize2,
  Pin,
  PinOff,
  Plus,
  Square,
  X,
} from "lucide-react";
import { api, getSavedTokens, type AIModelItem, type ToolItem } from "../../lib/api";
import {
  broadcastPetMessage,
  closeDesktopPet,
  focusMainWindow,
  isElectronApp,
  notifyDesktopPetReady,
  nudgeDesktopPet,
  resizeDesktopPet,
  setDesktopPetPinned,
  subscribeDesktopPetVisibility,
} from "../../lib/desktopPet";
import { OrbVisual } from "../../components/orb/OrbVisual";
import { useOrbTheme } from "../../components/orb/hooks/useOrbTheme";
import { useTextChat } from "../../hooks/useTextChat";
import type { SendPrompt } from "../../lib/text-session";
import {
  CompanionSparks,
  type CompanionSparksHandle,
} from "../../components/orb/CompanionSparks";
import { CompanionMarkdown } from "../../components/chat/CompanionMarkdown";
import styles from "../../components/orb/DesktopPet.module.css";

export default function StandaloneDesktopPetPage() {
  const [expanded, setExpanded] = useState(false);
  const [native, setNative] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [draft, setDraft] = useState("");
  const [windowError, setWindowError] = useState<string | null>(null);

  // Models, tools & session state
  const [models, setModels] = useState<AIModelItem[]>([]);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aevora-selected-model") || null;
    }
    return null;
  });
  const [showMenu, setShowMenu] = useState(false);
  const showMenuRef = useRef(false);
  useEffect(() => { showMenuRef.current = showMenu; }, [showMenu]);
  const [activeTab, setActiveTab] = useState<"models" | "tools">("models");

  const sessionId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sparksRef = useRef<CompanionSparksHandle>(null);
  const nearBottom = useRef(true);
  const { theme } = useOrbTheme();

  // Load models and tools from backend
  useEffect(() => {
    let active = true;
    api
      .getModels()
      .then((list) => {
        if (!active) return;
        setModels(list);
        if (list.length > 0) {
          const saved =
            typeof window !== "undefined"
              ? localStorage.getItem("aevora-selected-model")
              : null;
          const exists = list.some((m) => m.name === saved);
          setSelectedModel(exists && saved ? saved : list[0].name);
        }
      })
      .catch(() => {});

    api
      .getTools()
      .then((list) => {
        if (active) setTools(list);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName);
    if (typeof window !== "undefined") {
      localStorage.setItem("aevora-selected-model", modelName);
    }
  };

  const handleNewChat = () => {
    session.stop();
    session.reset();
    sessionId.current = null;
    setDraft("");
    setShowMenu(false);
  };

  const send = useCallback<SendPrompt>(
    async (prompt, options) => {
      if (!getSavedTokens()?.access) {
        throw new Error("Sign in to Aevora in the main app first, then return here.");
      }
      let failure: Error | null = null;
      let response = "";
      broadcastPetMessage({ type: "PET_PROMPT_SENT", payload: { prompt } });
      await api.streamChat(
        sessionId.current,
        prompt,
        {
          onSessionCreated: (id) => {
            if (!options?.signal?.aborted) sessionId.current = id;
          },
          onChunk: (chunk) => {
            if (options?.signal?.aborted) return;
            response += chunk;
            options?.onChunk?.(chunk);
            broadcastPetMessage({ type: "PET_STREAM_CHUNK", payload: chunk });
          },
          onDone: () => {
            if (!options?.signal?.aborted) {
              broadcastPetMessage({
                type: "PET_STREAM_DONE",
                payload: { response, sessionId: sessionId.current },
              });
              options?.onDone?.();
            }
          },
          onError: (error) => {
            failure = error;
          },
        },
        options?.signal,
        { voiceMode: false, model: selectedModel || undefined }
      );
      if (failure) throw failure;
    },
    [selectedModel]
  );

  const { session, snapshot } = useTextChat({ onPrompt: send });

  useEffect(() => {
    const desktop = isElectronApp();
    setNative(desktop);
    if (!desktop) setExpanded(true);
    document.documentElement.classList.add("pet-desktop-window");
    document.body.classList.add("pet-desktop-window");
    let mounted = true;
    void notifyDesktopPetReady()
      .then((value) => {
        if (mounted) setPinned(value);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setWindowError(
            error instanceof Error ? error.message : "The companion could not open."
          );
        }
      });
    const stopOnHide = subscribeDesktopPetVisibility((visible) => {
      if (!visible) {
        session.stop();
        setExpanded(false);
      }
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showMenuRef.current) {
          setShowMenu(false);
        } else {
          setExpanded(false);
        }
      }
    };
    const authChanged = (event: StorageEvent) => {
      if (event.key === "aevora_access_token" || event.key === null) {
        session.reset();
        sessionId.current = null;
        setDraft("");
      }
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("storage", authChanged);
    return () => {
      mounted = false;
      stopOnHide();
      session.stop();
      window.removeEventListener("keydown", escape);
      window.removeEventListener("storage", authChanged);
      document.documentElement.classList.remove("pet-desktop-window");
      document.body.classList.remove("pet-desktop-window");
    };
  }, [session]);

  useEffect(() => {
    let mounted = true;
    void resizeDesktopPet(expanded ? 320 : 168, expanded ? 440 : 190).catch(
      (error: unknown) => {
        if (mounted) {
          setWindowError(
            error instanceof Error
              ? error.message
              : "The companion window could not be resized."
          );
        }
      }
    );
    return () => {
      mounted = false;
    };
  }, [expanded]);

  useEffect(() => {
    if (nearBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [snapshot.turns]);

  const runWindowAction = (action: () => Promise<void>) => {
    setWindowError(null);
    void action().catch((error: unknown) =>
      setWindowError(error instanceof Error ? error.message : "Window action failed.")
    );
  };

  const close = async () => {
    session.stop();
    setExpanded(false);
    await closeDesktopPet();
  };

  const togglePinned = async () => {
    await setDesktopPetPinned(!pinned);
    setPinned(!pinned);
  };

  const status = snapshot.error
    ? "Needs your attention"
    : snapshot.streaming
      ? "Thinking it through…"
      : "Here for you";

  return (
    <main
      className={styles.desktop}
      data-expanded={expanded}
      data-native={native}
      aria-label="Aevora desktop companion"
    >
      {expanded && (
        <section className={styles.panel} aria-label="Companion conversation">
          {/* Ambient Aurora Glow */}
          <div className={styles.aurora} />

          {/* Canvas Physics Spark System & Celestial Ambient Motes */}
          <CompanionSparks ref={sparksRef} />

          {/* Refined Header: Single crisp '+' for new chat with kinetic hover */}
          <header className={styles.header}>
            <div className={styles.brand}>
              <span className={styles.brandDot} />
              <div>
                <strong>Aevora</strong>
                <span>Your desktop companion</span>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.newChatBtn}
                aria-label="New chat"
                title="Create a new chat (Cmd+N)"
                onClick={(e) => {
                  sparksRef.current?.burstAtElement(e.currentTarget);
                  handleNewChat();
                }}
              >
                <Plus size={15} strokeWidth={2.2} />
              </button>

              {native && (
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={pinned ? "Unpin companion" : "Keep companion on top"}
                  aria-pressed={pinned}
                  title={pinned ? "Unpin window" : "Keep on top"}
                  onClick={(e) => {
                    sparksRef.current?.burstAtElement(e.currentTarget);
                    runWindowAction(togglePinned);
                  }}
                >
                  {pinned ? <Pin size={14} /> : <PinOff size={14} />}
                </button>
              )}

              <button
                type="button"
                className={styles.icon}
                aria-label="Open main chat"
                title="Open full workspace"
                onClick={(e) => {
                  sparksRef.current?.burstAtElement(e.currentTarget);
                  runWindowAction(focusMainWindow);
                }}
              >
                <ArrowUpRight size={15} />
              </button>

              <button
                type="button"
                className={styles.icon}
                aria-label="Minimize companion"
                title="Minimize companion"
                onClick={(e) => {
                  sparksRef.current?.burstAtElement(e.currentTarget);
                  setExpanded(false);
                }}
              >
                <Minimize2 size={14} />
              </button>
            </div>
          </header>

          {/* Clean Status Bar: No duplicate model badge */}
          <div className={styles.widgetStatus} role="status">
            <div className={styles.statusLeft}>
              <span className={styles.statusDot} data-state={snapshot.state} />
              <span>{status}</span>
            </div>
            <div className={styles.statusMeta}>
              <span>{tools.length} tools active</span>
            </div>
          </div>

          {/* Chat Messages Feed with Custom Translucent Scrollbar */}
          <div
            ref={scrollRef}
            className={styles.messages}
            aria-live="polite"
            aria-relevant="additions text"
            onScroll={(event) => {
              const node = event.currentTarget;
              nearBottom.current =
                node.scrollHeight - node.scrollTop - node.clientHeight < 50;
            }}
          >
            {snapshot.turns.length === 0 && (
              <div className={styles.empty}>
                <MessageCircle size={22} />
                <h1>
                  A little company.
                  <br />A lot of possibility.
                </h1>
                <p>Ask a question, think out loud, or mention connected tools with @.</p>
                <div className={styles.suggestions}>
                  <button
                    type="button"
                    className={styles.suggestionBtn}
                    onClick={(e) => {
                      sparksRef.current?.burstAtElement(e.currentTarget);
                      void session.send(
                        "Help me break down my next task into three small, practical steps."
                      );
                    }}
                  >
                    <span>Plan next step</span>
                    <ArrowUpRight size={13} />
                  </button>
                  <button
                    type="button"
                    className={styles.suggestionBtn}
                    onClick={(e) => {
                      sparksRef.current?.burstAtElement(e.currentTarget);
                      void session.send(
                        "Share one useful software engineering idea, in a short and conversational way."
                      );
                    }}
                  >
                    <span>Spark an idea</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {snapshot.turns.map((turn, index) => {
              const isStreamingAssistant =
                turn.role === "assistant" &&
                snapshot.streaming &&
                index === snapshot.turns.length - 1;
              return (
                <div key={turn.id} className={styles.turn} data-role={turn.role}>
                  <div className={styles.turnHeader}>
                    <span>{turn.role === "user" ? "You" : "Aevora"}</span>
                    {turn.role === "assistant" && selectedModel && (
                      <span className={styles.modelTag}>{selectedModel}</span>
                    )}
                    {isStreamingAssistant && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-400/20 inline-flex items-center gap-1 shadow-[0_0_8px_rgba(0,240,255,0.25)]">
                        ✨ Sparking
                      </span>
                    )}
                  </div>
                  {turn.role === "assistant" ? (
                    <div className={styles.turnBody}>
                      <CompanionMarkdown content={turn.text} isStreaming={isStreamingAssistant} />
                      {isStreamingAssistant && <span className="stream-cursor" />}
                    </div>
                  ) : (
                    <p>{turn.text}</p>
                  )}
                </div>
              );
            })}

            {(snapshot.error || windowError) && (
              <p role="alert" className={styles.error}>
                {snapshot.error || windowError}
              </p>
            )}
          </div>

          {/* Elevated Drawer for Models & Tools */}
          {showMenu && (
            <div
              className={styles.menuPopover}
              role="dialog"
              aria-label="Models and tools"
            >
              <div className={styles.popoverHeader}>
                <span className={styles.popoverHeaderTitle}>
                  {activeTab === "models"
                    ? "Select AI engine"
                    : "Connected tools · click to mention"}
                </span>

                <button
                  type="button"
                  onClick={() => setShowMenu(false)}
                  className={styles.popoverClose}
                  aria-label="Close menu"
                >
                  <X size={14} />
                </button>
              </div>

              {activeTab === "models" && (
                <div className={styles.popoverBody}>
                  <div className={styles.popoverList}>
                    {models.length ? (
                      models.map((m) => {
                        const isSelected =
                          selectedModel === m.name ||
                          (!selectedModel && m.name === "gemini-3.5-flash-lite");
                        const quotaVal = m.quota ?? "0.00";
                        return (
                          <button
                            key={m.name}
                            type="button"
                            onClick={(e) => {
                              sparksRef.current?.burstAtElement(e.currentTarget);
                              handleSelectModel(m.name);
                              setShowMenu(false);
                            }}
                            className={`${styles.listItem} ${
                              isSelected ? styles.itemSelected : ""
                            }`}
                          >
                            <div className={styles.itemLeft}>
                              <div className={styles.itemIcon}>
                                <Cpu size={13} />
                              </div>
                              <div>
                                <strong className={styles.itemName}>{m.name}</strong>
                                <span className={styles.itemMeta}>
                                  Quota: <code>{String(quotaVal)}</code>
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <span className={styles.activeBadge}>
                                <Check size={10} strokeWidth={3} /> Active
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className={styles.emptyNote}>
                        No models reported by backend.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "tools" && (
                <div className={styles.popoverBody}>
                  <div className={styles.popoverList}>
                    {tools.length ? (
                      tools.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={(e) => {
                            sparksRef.current?.burstAtElement(e.currentTarget);
                            setDraft((curr) =>
                              `${curr.replace(/@\w*$/, "").trim()} @${t.name} `.trimStart()
                            );
                            setShowMenu(false);
                            inputRef.current?.focus();
                          }}
                          className={styles.listItem}
                        >
                          <div className={styles.itemLeft}>
                            <div className={styles.itemIcon}>
                              <Boxes size={13} />
                            </div>
                            <div>
                              <strong className={styles.itemName}>@{t.name}</strong>
                              <span className={styles.itemMeta}>{t.description}</span>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className={styles.emptyNote}>No tools available.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Integrated Composer with Model & Tools Controls */}
          <div className={styles.composerWrap}>
            <form
              className={styles.composerCard}
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim() && !snapshot.streaming) {
                  sparksRef.current?.burst(undefined, undefined, 20);
                  void session.send(draft);
                  setDraft("");
                }
              }}
            >
              <input
                ref={inputRef}
                className={styles.composerInput}
                aria-label="Message to companion"
                placeholder="Ask anything… (@ for tools)"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (event.target.value.endsWith("@")) {
                    setActiveTab("tools");
                    setShowMenu(true);
                  }
                }}
              />

              <div className={styles.composerToolbar}>
                <div className={styles.composerControls}>
                  <button
                    type="button"
                    className={styles.toolsPill}
                    onClick={(e) => {
                      sparksRef.current?.burstAtElement(e.currentTarget, 12);
                      setActiveTab("tools");
                      setShowMenu((prev) => !prev || activeTab !== "tools");
                      inputRef.current?.focus();
                    }}
                    title="Mention a tool (@)"
                    aria-label="Mention a tool (@)"
                  >
                    <AtSign size={12} className="text-violet-400" />
                  </button>

                  <button
                    type="button"
                    className={styles.modelPill}
                    onClick={(e) => {
                      sparksRef.current?.burstAtElement(e.currentTarget, 12);
                      setActiveTab("models");
                      setShowMenu((prev) => !prev || activeTab !== "models");
                    }}
                    title="Select AI Model"
                    aria-label="Select AI Model"
                  >
                    <Cpu size={12} className="text-violet-400" />
                    <span className={styles.modelPillText}>
                      {selectedModel || "gemini-3.5-flash-lite"}
                    </span>
                    <ChevronDown size={11} className="text-zinc-400" />
                  </button>
                </div>

                {snapshot.streaming ? (
                  <button
                    type="button"
                    className={styles.stopBtn}
                    onClick={session.stop}
                    aria-label="Stop companion response"
                    title="Stop response"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={styles.sendBtn}
                    aria-label="Send to companion"
                    title="Send (Enter)"
                    disabled={!draft.trim() || snapshot.streaming}
                  >
                    <ArrowUp size={15} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </form>


          </div>
        </section>
      )}

      {/* Dock & Floating Orb Visual (Collapsed State) */}
      <div className={styles.petDock}>
        <div className={styles.dockToolbar}>
          <button
            type="button"
            className={styles.dragHandle}
            aria-label="Drag companion window"
            title="Drag to move · arrow keys move 16 pixels"
            onKeyDown={(event) => {
              const delta = {
                ArrowLeft: [-16, 0],
                ArrowRight: [16, 0],
                ArrowUp: [0, -16],
                ArrowDown: [0, 16],
              }[event.key];
              if (delta && native) {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent("orb:move"));
                runWindowAction(() => nudgeDesktopPet(delta[0] ?? 0, delta[1] ?? 0));
              }
            }}
          >
            <GripHorizontal size={15} />
            {expanded && <span className={styles.dragLabel}>Move</span>}
          </button>
          <button
            type="button"
            className={styles.close}
            aria-label="Hide desktop companion"
            onClick={() => runWindowAction(close)}
          >
            <X size={13} />
          </button>
        </div>
        <OrbVisual
          size={expanded ? 76 : 106}
          state={snapshot.state}
          theme={theme}
          signal={session.signal}
          label={expanded ? "Minimize companion chat" : "Open companion chat"}
          onActivate={() => setExpanded(!expanded)}
        />
        {!expanded && (
          <button
            type="button"
            className={styles.statusPill}
            onClick={() => setExpanded(true)}
          >
            <span data-state={snapshot.state} />
            {windowError ? "Needs your attention" : status}
          </button>
        )}
      </div>
    </main>
  );
}
