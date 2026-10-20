"use client";

import { TerminalPanel } from "./terminal/TerminalPanel";

interface ToolLogAccordionProps {
  title?: string;
  logs: string | readonly string[];
  defaultOpen?: boolean;
}

/** Existing public interface; presentation only, never executes a command. */
export function ToolLogAccordion({ title = "Tool execution logs", logs, defaultOpen = false }: ToolLogAccordionProps) {
  const output = typeof logs === "string" ? logs : logs.join("\n");
  if (!output.trim()) return null;
  return <TerminalPanel title={title} logs={output} defaultOpen={defaultOpen} />;
}

export function LiveLogsPanel({ logs, activeTool }: {
  logs: readonly string[];
  activeTool: { name: string; status: "start" | "done" | "error" } | null;
}) {
  return <TerminalPanel title={activeTool?.name || "AI logs"} logs={logs.join("\n")} activeTool={activeTool} defaultOpen live />;
}
