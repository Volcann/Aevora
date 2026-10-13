import React from "react";
import { PanelLeft } from "lucide-react";
import type { UserProfile } from "../../lib/api";

interface ChatHeaderProps {
  currentSessionTitle?: string;
  isVoiceMode: boolean;
  onToggleVoiceMode: () => void;
  onToggleSidebar: () => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  apiStatus: string;
}

export function ChatHeader({
  currentSessionTitle,
  onToggleSidebar,
  apiStatus,
}: ChatHeaderProps) {
  return (
    <header className="chat-header select-none">
      <div className="chat-header-left">
        <button
          type="button"
          className="sidebar-toggle-icon"
          onClick={onToggleSidebar}
          title="Toggle Sidebar"
        >
          <PanelLeft size={16} />
        </button>

        <div className="flex items-center gap-2 truncate">
          <span className="session-title-badge truncate max-w-[280px] sm:max-w-md">
            {currentSessionTitle || "New Conversation"}
          </span>
        </div>
      </div>

      <div className="chat-header-actions flex items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-surface/60 border border-border/60 px-2.5 py-1 rounded-full">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              apiStatus === "offline"
                ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                : "bg-emerald-400 shadow-[0_0_6px_#34d399]"
            }`}
          />
          <span className="hidden sm:inline font-medium">
            {apiStatus === "offline"
              ? "Backend Offline"
              : "Aevora Engine Online"}
          </span>
        </div>
      </div>
    </header>
  );
}
