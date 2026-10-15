"use client";
import { memo } from "react";
import { AudioLines, Monitor, PanelLeft, Settings } from "lucide-react";
import type { UserProfile } from "../../lib/api";
import styles from "../chat/Chat.module.css";
export type ViewType = "chat" | "login" | "register" | "forgot" | "reset";
interface TopNavSwitcherProps {
  currentView: ViewType;
  user: UserProfile | null;
  onViewChange: (view: ViewType) => void;
  onOpenSettings?: () => void;
  currentSessionTitle?: string;
  apiStatus?: "checking" | "online" | "offline" | string;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onOpenVoice?: () => void;
  onOpenCompanion?: () => void;
}
export const TopNavSwitcher = memo(function TopNavSwitcher({ currentView, user, onViewChange, onOpenSettings, currentSessionTitle, apiStatus, onToggleSidebar, isSidebarOpen, onOpenVoice, onOpenCompanion }: TopNavSwitcherProps) {
  return <nav className={styles.nav} aria-label="Application">

    {user && onToggleSidebar && <button
      className={styles.iconButton}
      onClick={onToggleSidebar}
      aria-label="Toggle conversation sidebar"
      aria-expanded={isSidebarOpen}
      aria-controls="conversation-sidebar">
      <PanelLeft size={18} />
    </button>}

    <button
      className={styles.brand}
      onClick={() => user && onViewChange("chat")}
      aria-label="Aevora home"><span className={styles.brandMark} aria-hidden="true">a</span>Aevora</button>

    <div className={styles.navTitle}>
      {user ? currentSessionTitle || "Personal workspace" : currentView === "register" ? "Create an account" : currentView === "login" ? "Welcome back" : "Account recovery"}
    </div>

    <div className={styles.navActions}>

      {user && <div className={styles.service} data-status={apiStatus}>
        <span className={styles.serviceDot} />
        {apiStatus === "online" ? "Service connected" : apiStatus === "offline" ? "Service offline" : "Checking service"}
      </div>}

      {user && onOpenVoice && <button
        className={`${styles.navButton} ${styles.voiceNav}`}
        onClick={onOpenVoice}
        aria-label="Open voice call">
        <AudioLines size={15} />
        <span>Voice call</span>
      </button>}

      {user && onOpenCompanion && <button className={styles.navButton} onClick={onOpenCompanion} aria-label="Open desktop companion">
        <Monitor size={15} />
        <span>Companion</span>
      </button>}

      {onOpenSettings && <button className={styles.iconButton} onClick={onOpenSettings} aria-label="Open settings">
        <Settings size={17} />
      </button>}

    </div>

  </nav>;
});
