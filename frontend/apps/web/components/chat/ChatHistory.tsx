"use client";

import { memo, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import type { MessageItem } from "../../lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import styles from "./Chat.module.css";

function CopyMessage({ content }: { content: string }) {
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className={styles.messageTools}>
      <button
        className={styles.iconButton}
        aria-label="Copy response"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(content);
            setStatus("Copied");
          } catch {
            setStatus("Copy unavailable");
          }
        }}
      >
        {status === "Copied" ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <span role="status">{status}</span>
    </div>
  );
}

// Immutable message objects allow older rows to stay untouched as replies arrive.
const ChatMessage = memo(function ChatMessage({ message }: { message: MessageItem }) {
  const modelName = typeof message.model === "object" && message.model?.name
    ? message.model.name
    : message.model_name;

  return (
    <article
      className={styles.message}
      data-role={message.role === "user" ? "user" : "assistant"}
      aria-label={message.role === "user" ? "You" : "Aevora"}
    >
      {message.role === "user" ? (
        <div className={styles.userBubble}>{message.content}</div>
      ) : (
        <>
          <div className={styles.assistantAvatar} aria-hidden="true">a</div>
          <div className={styles.messageBody}>
            <div className={styles.assistantName}>
              <span>Aevora</span>
              {modelName && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-400/20">
                  {modelName}
                </span>
              )}
            </div>
            {/^(⚠ Error:|Error communicating)/.test(message.content) ? (
              <div className={styles.error}>
                <AlertTriangle size={16} />
                <span>{message.content}</span>
              </div>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
            <CopyMessage content={message.content} />
          </div>
        </>
      )}
    </article>
  );
});

/** Streaming characters update the live row, not the entire message history. */
export const ChatHistory = memo(function ChatHistory({ messages }: { messages: MessageItem[] }) {
  return <>{messages.map((message) => <ChatMessage key={message.id} message={message} />)}</>;
});
