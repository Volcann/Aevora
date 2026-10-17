"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Terminal, Copy, Check } from "lucide-react";
import styles from "./Chat.module.css";

interface ToolLogAccordionProps {
  title?: string;
  logs: string | string[];
  defaultOpen?: boolean;
}

export function ToolLogAccordion({
  title = "Tool execution logs",
  logs,
  defaultOpen = false,
}: ToolLogAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const formattedLogs = Array.isArray(logs) ? logs.join("\n") : logs;

  if (!formattedLogs || !formattedLogs.trim()) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(formattedLogs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <div className={styles.toolLogBox}>
      <button
        type="button"
        className={styles.toolLogHeader}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className={styles.toolLogTitle}>
          <Terminal size={12} className="text-cyan-400" />
          <span>{title}</span>
          <span className={styles.toolLogChevron}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </span>
        {isOpen && (
          <span
            role="button"
            tabIndex={0}
            className={styles.toolLogCopyBtn}
            onClick={handleCopy}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleCopy(e as unknown as React.MouseEvent);
            }}
            title="Copy logs"
          >
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.toolLogContent}>
          <pre>{formattedLogs}</pre>
        </div>
      )}
    </div>
  );
}

/** Live AI logs panel — shown expanded during streaming, hidden when message arrives */
export function LiveLogsPanel({
  logs,
  activeTool,
}: {
  logs: readonly string[] | string[];
  activeTool: { name: string; status: "start" | "done" | "error" } | null;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the log pane as new lines arrive
  useEffect(() => {
    if (isOpen) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, isOpen]);

  const title = activeTool
    ? `${activeTool.name} — ${activeTool.status === "start" ? "running…" : activeTool.status === "done" ? "finished" : "error"}`
    : "AI logs";

  return (
    <div className={styles.toolLogBox} style={{ marginBottom: 12 }}>
      <button
        type="button"
        className={styles.toolLogHeader}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className={styles.toolLogTitle}>
          <Terminal size={12} className="text-cyan-400" />
          <span>{title}</span>
          <span className={styles.toolLogChevron}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </span>
        {/* Pulsing dot while running */}
        {activeTool?.status === "start" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#38bdf8" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", display: "inline-block", animation: "dotPulse 1.3s ease-in-out infinite" }} />
            live
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.toolLogContent}>
          <pre>
            {logs.length === 0
              ? <span style={{ color: "#64748b" }}>Waiting for output…</span>
              : logs.join("\n")}
          </pre>
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
