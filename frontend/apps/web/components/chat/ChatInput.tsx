"use client";
import { memo, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, AtSign, AudioLines, Boxes, Check, Cpu, Square } from "lucide-react";
import type { AIModelItem, ToolItem } from "../../lib/api";
import styles from "./Chat.module.css";

interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  onToggleVoiceMode: () => void;
  tools: ToolItem[];
  models?: AIModelItem[];
  selectedModel?: string | null;
  onSelectModel?: (modelName: string) => void;
  isBoostEnabled?: boolean;
  onToggleBoost?: () => void;
  onStopStreaming?: () => void;
}

const EMPTY_MODELS: AIModelItem[] = [];

export const ChatInput = memo(function ChatInput({
  onSend,
  isStreaming,
  onToggleVoiceMode,
  tools,
  models = EMPTY_MODELS,
  selectedModel,
  onSelectModel,
  isBoostEnabled = true,
  onToggleBoost,
  onStopStreaming,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [activeTab, setActiveTab] = useState<"models" | "tools">("models");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const composing = useRef(false);

  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto";
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 160)}px`;
    }
  }, [text]);

  useEffect(() => {
    if (!showTools) return;
    const element = root.current;
    const updateSpace = () => {
      if (!element) return;
      const top = element.closest("main")?.getBoundingClientRect().top ?? 0;
      element.style.setProperty("--tools-available-height", `${Math.max(0, element.getBoundingClientRect().top - top - 16)}px`);
    };
    updateSpace();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(updateSpace) : null;
    if (element) observer?.observe(element);
    window.addEventListener("resize", updateSpace);
    window.visualViewport?.addEventListener("resize", updateSpace);
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setShowTools(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", updateSpace);
      window.visualViewport?.removeEventListener("resize", updateSpace);
      observer?.disconnect();
    };
  }, [showTools]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    let prompt = text.trim();
    if (!prompt || isStreaming) return;
    if (prompt.toLowerCase() === "/boost") {
      onToggleBoost?.();
      setText("");
      setShowTools(false);
      return;
    }
    if (prompt.toLowerCase().startsWith("/boost ")) {
      prompt = prompt.slice(7).trim();
      if (!isBoostEnabled) onToggleBoost?.();
    }
    if (!prompt) return;
    onSend(prompt);
    setText("");
    setShowTools(false);
    textarea.current?.focus();
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") setShowTools(false);
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !composing.current &&
      event.keyCode !== 229
    ) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.composerWrap}>
      <div className={styles.composerInner} ref={root} onKeyDown={(event) => {
        if (event.key === "Escape" && showTools) {
          event.stopPropagation();
          setShowTools(false);
          textarea.current?.focus();
        }
      }}>
        {showTools && (
          <div className={styles.toolsPopover} id="chat-tools">

            {/* Tab 1: AI Models List & Selection */}
            {activeTab === "models" && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground px-1 pb-1">
                  Select model for this chat
                </div>
                <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
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
                          onClick={() => {
                            onSelectModel?.(m.name);
                            setShowTools(false);
                            textarea.current?.focus();
                          }}
                          className={`flex items-center justify-between w-full !p-2 rounded-xl !border transition-all text-left cursor-pointer ${
                            isSelected
                              ? "!bg-cyan-500/10 !border-cyan-400/50 shadow-xs"
                              : "!bg-surface/50 !border-border hover:!bg-surface-hover hover:!border-border/80"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-cyan-500 text-white"
                                  : "bg-surface-hover text-muted-foreground"
                              }`}
                            >
                              <Cpu size={13} />
                            </div>
                            <div className="min-w-0">
                              <span
                                className={`block text-xs font-semibold truncate ${
                                  isSelected ? "text-cyan-300" : "text-foreground"
                                }`}
                              >
                                {m.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                Quota:{" "}
                                <strong className="text-emerald-400 font-mono">
                                  {String(quotaVal)}
                                </strong>
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shrink-0">
                              <Check size={10} strokeWidth={3} /> Active
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground p-3 text-center">
                      No models reported by backend.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Connected Tools List */}
            {activeTab === "tools" && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground px-1 pb-1">
                  Connected tools · select to mention
                </div>
                <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
                  {tools.length ? (
                    tools.map((tool) => (
                      <button
                        key={tool.name}
                        type="button"
                        onClick={() => {
                          setText((current) =>
                            `${current.replace(/@\w*$/, "").trim()} @${tool.name} `.trimStart()
                          );
                          setShowTools(false);
                          textarea.current?.focus();
                        }}
                        className="flex items-start gap-2.5 w-full !p-2 rounded-xl !bg-surface/50 !border !border-border hover:!bg-surface-hover text-left transition-all cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-surface-hover text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Boxes size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <strong className="block text-xs font-semibold text-foreground truncate font-mono">
                            {tool.name}
                          </strong>
                          <small className="block text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                            {tool.description}
                          </small>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground p-3 text-center">
                      No tools are available. Refresh connected tools in Settings.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <form className={styles.composer} onSubmit={submit}>
          <textarea
            ref={textarea}
            rows={1}
            className={styles.textarea}
            value={text}
            aria-label="Message Aevora"
            placeholder={
              isStreaming
                ? "Reply in progress…"
                : `Ask ${selectedModel || "Aevora"} anything, or mention tools with @…`
            }
            onChange={(event) => {
              setText(event.target.value);
              if (event.target.value.endsWith("@")) {
                setActiveTab("tools");
                setShowTools(true);
              }
            }}
            onKeyDown={keyDown}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
          />

          <div className={styles.composerBar}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                setActiveTab("tools");
                setShowTools((prev) => !prev || activeTab !== "tools");
              }}
              aria-label="Mention a connected tool"
              aria-expanded={showTools && activeTab === "tools"}
              aria-controls="chat-tools"
              title="Mention a tool (@)"
            >
              <AtSign size={17} />
            </button>

            {/* Model Switcher Button in Composer Bar */}
            <button
              type="button"
              className={`${styles.modelSwitcher} flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xl bg-surface/80 border border-border hover:bg-surface-hover text-foreground transition-all cursor-pointer min-w-0 max-w-[170px]`}
              onClick={() => {
                setActiveTab("models");
                setShowTools((prev) => !prev || activeTab !== "models");
              }}
              title="Switch AI model"
              aria-label="Switch AI model"
              aria-expanded={showTools && activeTab === "models"}
              aria-controls="chat-tools"
            >
              <Cpu size={14} className="text-cyan-400 shrink-0" />
              <span className="truncate font-medium text-[11px]">
                {selectedModel || "gemini-3.5-flash-lite"}
              </span>
            </button>

            <span className={styles.composerHint}>
              {isStreaming ? "Reply in progress" : ""}
            </span>

            <button
              type="button"
              className={`${styles.iconButton} ${styles.voiceComposer}`}
              onClick={onToggleVoiceMode}
              aria-label="Start a voice conversation"
            >
              <AudioLines size={18} />
            </button>

            {isStreaming && onStopStreaming ? (
              <button
                key="stop"
                type="button"
                className={styles.send}
                onClick={(event) => {
                  event.preventDefault();
                  onStopStreaming();
                }}
                aria-label="Stop response"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                key="send"
                type="submit"
                className={styles.send}
                disabled={!text.trim() || isStreaming}
                aria-label="Send message"
              >
                <ArrowUp size={19} />
              </button>
            )}
          </div>
        </form>

        <div className={styles.composerFootnote}>
          <span>Aevora can make mistakes. Check important details.</span>
          <span aria-hidden="true">·</span>
          <kbd>Shift + Enter for a new line</kbd>
        </div>
      </div>
    </div>
  );
});
