"use client";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AtSign, AudioLines, ArrowUp, Boxes, Square, Zap } from "lucide-react";
import type { ToolItem } from "../../lib/api";
import styles from "./Chat.module.css";
interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  onToggleVoiceMode: () => void;
  tools: ToolItem[];
  isBoostEnabled?: boolean;
  onToggleBoost?: () => void;
  onStopStreaming?: () => void;
}
export function ChatInput({ onSend, isStreaming, onToggleVoiceMode, tools, isBoostEnabled = true, onToggleBoost, onStopStreaming }: ChatInputProps) {
  const [text, setText] = useState("");
  const [showTools, setShowTools] = useState(false);
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
    if (!showTools)
      return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node))
        setShowTools(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [showTools]);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    let prompt = text.trim();
    if (!prompt || isStreaming)
      return;
    if (prompt.toLowerCase() === "/boost") {
      onToggleBoost?.();
      setText("");
      setShowTools(false);
      return;
    }
    if (prompt.toLowerCase().startsWith("/boost ")) {
      prompt = prompt.slice(7).trim();
      if (!isBoostEnabled)
        onToggleBoost?.();
    }
    if (!prompt)
      return;
    onSend(prompt);
    setText("");
    setShowTools(false);
    textarea.current?.focus();
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape")
      setShowTools(false);
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229) {
      event.preventDefault();
      submit();
    }
  };
  return <div className={styles.composerWrap}>
    <div className={styles.composerInner} ref={root}>

      {showTools && <div className={styles.toolsPopover} id="chat-tools">
        <h3>Connected tools · select to mention</h3>
        {tools.length ? tools.map((tool) => <button
          key={tool.name}
          type="button"
          onClick={() => { setText((current) => `${current.replace(/@\w*$/, "").trim()} @${tool.name} `.trimStart()); setShowTools(false); textarea.current?.focus(); }}>
          <Boxes size={14} />
          <span>
            <strong>
              {tool.name}
            </strong>
            <small>
              {tool.description}
            </small>
          </span>
        </button>) : <p>No tools are available. Refresh connected tools in Settings.</p>}
      </div>}

      <form className={styles.composer} onSubmit={submit}>

        <textarea
          ref={textarea}
          rows={1}
          className={styles.textarea}
          value={text}
          aria-label="Message Aevora"
          placeholder={isStreaming ? "Write your next thought…" : "Ask anything, or just start a conversation…"}
          onChange={(event) => { setText(event.target.value); setShowTools(event.target.value.endsWith("@")); }}
          onKeyDown={keyDown}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }} />

        <div className={styles.composerBar}>

          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setShowTools(!showTools)}
            aria-label="Mention a connected tool"
            aria-expanded={showTools}
            aria-controls="chat-tools">
            <AtSign size={17} />
          </button>

          {onToggleBoost && <button
            type="button"
            className={`${styles.iconButton} ${styles.boost}`}
            onClick={onToggleBoost}
            aria-label="Toggle fast text rendering"
            aria-pressed={isBoostEnabled}
            data-active={isBoostEnabled}>
            <Zap size={16} />
          </button>}

          <span className={styles.composerHint}>
            {isStreaming ? "Reply in progress" : "Make room for a new idea"}
          </span>

          <button
            type="button"
            className={`${styles.iconButton} ${styles.voiceComposer}`}
            onClick={onToggleVoiceMode}
            aria-label="Start a voice conversation">
            <AudioLines size={18} />
          </button>

          {isStreaming && onStopStreaming ? <button
            key="stop"
            type="button"
            className={styles.send}
            onClick={(event) => { event.preventDefault(); onStopStreaming(); }}
            aria-label="Stop response">
            <Square size={14} fill="currentColor" />
          </button> : <button
            key="send"
            type="submit"
            className={styles.send}
            disabled={!text.trim() || isStreaming}
            aria-label="Send message">
            <ArrowUp size={19} />
          </button>}

        </div>

      </form>

      <div className={styles.composerFootnote}>
        <span>Aevora can make mistakes. Check important details.</span>
        <span aria-hidden="true">·</span>
        <kbd>Shift + Enter for a new line</kbd>
      </div>

    </div>
  </div>;
}
