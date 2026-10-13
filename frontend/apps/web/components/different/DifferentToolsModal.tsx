"use client";

import React, { useState } from "react";
import { Boxes, RefreshCw, X, Play, Check, Cpu } from "lucide-react";
import type { ToolItem } from "../../lib/api";

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolItem[];
  onSelectToolPrompt: (promptTemplate: string) => void;
  onRefreshTools?: () => Promise<void>;
}

export function AgentToolsModal({
  isOpen,
  onClose,
  tools,
  onSelectToolPrompt,
  onRefreshTools,
}: ToolsModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    if (!onRefreshTools) return;
    setIsRefreshing(true);
    try {
      await onRefreshTools();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getToolPrompt = (tool: ToolItem): string => {
    if (tool.description) {
      const short = tool.description.split(".")[0].trim();
      return `Use ${tool.name} to ${short.toLowerCase()}.`;
    }
    return `Use the ${tool.name} tool: `;
  };

  const copyToolName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 1800);
    } catch {}
  };

  return (
    <div className="dashboard-modal open select-none" onClick={onClose}>
      <div
        className="dashboard-card max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="dashboard-header border-b border-border/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
              <Boxes size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Agent Distributed Tools</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Celery Worker Online
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Connected background tools executed via distributed Celery worker & Redis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefreshTools && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-2.5 py-1 text-xs rounded-lg border border-border bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Refresh tools from backend"
              >
                <RefreshCw size={12} className={isRefreshing ? "animate-spin text-cyan-400" : "text-muted-foreground"} />
                <span className="text-[11px] font-medium hidden sm:inline">Sync</span>
              </button>
            )}
            <button
              type="button"
              className="sidebar-toggle-icon"
              onClick={onClose}
              title="Close modal"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Worker Telemetry Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="p-3 rounded-xl bg-surface/50 border border-border flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Execution Architecture
            </span>
            <span className="text-xs font-semibold text-foreground">
              Distributed Celery Tasks
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface/50 border border-border flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Task Queue & Broker
            </span>
            <span className="text-xs font-mono text-cyan-300 truncate" title="laptop.tools,celery (Redis :6382)">
              laptop.tools,celery
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface/50 border border-border flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Available Tools
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {tools.length} registered tool{tools.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Tool Cards List */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
          {tools.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              No tools reported by the backend. Ensure the Celery tools worker is running on queue laptop.tools,celery.
            </div>
          ) : (
            tools.map((tool) => {
              const properties = (tool.parameters?.properties as Record<string, any>) || {};
              const requiredList: string[] = Array.isArray(tool.parameters?.required)
                ? (tool.parameters.required as string[])
                : [];
              const promptTemplate = getToolPrompt(tool);

              return (
                <div
                  key={tool.name}
                  className="p-4 rounded-xl bg-surface/60 border border-border hover:border-primary/40 transition-all shadow-xs flex flex-col gap-2.5 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 font-mono text-xs font-bold">
                        {tool.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-hover border border-border text-[10px] font-semibold text-muted-foreground">
                        runner: celery_worker
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToolName(tool.name)}
                      className="text-[11px] text-muted-foreground hover:text-cyan-300 transition-colors cursor-pointer px-1.5 py-0.5"
                      title="Copy tool identifier"
                    >
                      {copiedName === tool.name ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <Check size={11} strokeWidth={2.5} /> Copied
                        </span>
                      ) : (
                        "Copy Name"
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tool.description ||
                      (tool.name.includes("lazy_reviewer")
                        ? "Analyzes and reviews Git pull requests, code quality, and branch diffs."
                        : tool.name.includes("environment")
                        ? "Initializes, provisions, and starts local project development environments."
                        : "Registered tool executed via Celery background tasks.")}
                  </p>

                  {/* Parameters preview if available */}
                  {Object.keys(properties).length > 0 && (
                    <div className="pt-2 border-t border-border/50 text-[11px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">
                        Input Parameters
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(properties).map(([paramName, paramInfo]: [string, any]) => {
                          const isReq = requiredList.includes(paramName);
                          return (
                            <span
                              key={paramName}
                              className="px-2 py-0.5 rounded bg-black/40 border border-border/60 font-mono text-[11px] text-foreground/85 flex items-center gap-1.5"
                            >
                              <span className="text-primary font-semibold">{paramName}</span>
                              <span className="text-[9px] text-muted-foreground">
                                ({paramInfo.type || "string"})
                              </span>
                              {isReq && (
                                <span className="text-[9px] text-red-400 font-bold">*req</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action row */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-1">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                      Prompt: <span className="text-foreground/90 italic">"{promptTemplate}"</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectToolPrompt(promptTemplate);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/40 text-primary text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Play size={11} className="fill-current" />
                      <span>Run in Chat</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>You can also invoke tools dynamically by typing <code className="text-cyan-300 font-mono">@</code> in the chat input.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-surface border border-border hover:bg-surface-hover text-foreground text-xs font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Export backward compatibility alias
export { AgentToolsModal as McpToolsModal };
export type { ToolsModalProps as McpToolsModalProps };
