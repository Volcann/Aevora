"use client";
import { useEffect, useState } from "react";
import { Plus, PanelLeftClose, MessageSquare, Trash2, LogOut, Search, Settings } from "lucide-react";
import type { ChatSessionItem, UserProfile } from "../../lib/api";
import styles from "./Chat.module.css";
interface ChatSidebarProps {
  sessions: ChatSessionItem[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  user: UserProfile | null;
  onLogout: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenAuth: () => void;
  onOpenSettings?: () => void;
}
export function ChatSidebar({ sessions, currentSessionId, onSelectSession, onNewSession, onDeleteSession, user, onLogout, isOpen, onToggleOpen, onOpenSettings }: ChatSidebarProps) {
  const [query, setQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen)
      return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmDeleteId)
          setConfirmDeleteId(null);
        else
          onToggleOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onToggleOpen, confirmDeleteId]);
  if (!isOpen)
    return null;
  const closeOnMobile = () => {
    if (window.matchMedia("(max-width:700px)").matches)
      onToggleOpen();
  };
  const filtered = sessions.filter((session) => (session.title || "Untitled chat").toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <button
      className={styles.scrim}
      onClick={onToggleOpen}
      aria-label="Close conversation sidebar"
      tabIndex={-1} />
    <aside id="conversation-sidebar" className={styles.sidebar} aria-label="Conversations">

      <div className={styles.sidebarHead}>
        <button className={styles.newChat} onClick={() => { onNewSession(); closeOnMobile(); }}><Plus size={16} />New conversation</button>
        <button className={styles.iconButton} onClick={onToggleOpen} aria-label="Collapse sidebar">
          <PanelLeftClose size={16} />
        </button>
      </div>

      <label className={styles.search}>
        <Search size={14} />
        <input
          type="search"
          aria-label="Search conversations"
          placeholder="Search conversations"
          value={query}
          onChange={(event) => setQuery(event.target.value)} />
      </label>

      <div className={styles.historyHeading}>Your conversations</div>

      <div className={styles.history}>
        {filtered.length === 0 ? <p className={styles.emptyHistory}>
          {query ? "No matching conversations." : "A fresh start. Your conversations will appear here."}
        </p> : filtered.map((session) => <div key={session.id} className={styles.historyRow} data-active={session.id === currentSessionId}>

          <button
            className={styles.historySelect}
            aria-current={session.id === currentSessionId ? "page" : undefined}
            onClick={() => { onSelectSession(session.id); closeOnMobile(); }}>
            <MessageSquare size={13} />
            <span>
              {session.title || "Untitled chat"}
            </span>
          </button>

          <button
            className={`${styles.iconButton} ${styles.historyDelete}`}
            onClick={() => setConfirmDeleteId(session.id)}
            aria-label={`Delete ${session.title || "conversation"}`}>
            <Trash2 size={12} />
          </button>

          {confirmDeleteId === session.id && <div className={styles.deleteConfirm} role="group" aria-label="Confirm deletion">
            <span>Delete this chat?</span>
            <button onClick={() => { onDeleteSession(session.id); setConfirmDeleteId(null); }}>Delete</button>
            <button onClick={() => setConfirmDeleteId(null)}>Cancel</button>
          </div>}

        </div>)}
      </div>

      {user && <div className={styles.sidebarFooter}>
        <div className={styles.userAvatar}>
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className={styles.userDetails}>
          <strong>
            {user.username}
          </strong>
          <small>Personal account</small>
        </div>
        {onOpenSettings && <button className={styles.iconButton} onClick={onOpenSettings} aria-label="Account settings">
          <Settings size={15} />
        </button>}
        <button className={styles.iconButton} onClick={onLogout} aria-label="Sign out">
          <LogOut size={15} />
        </button>
      </div>}

    </aside>
  </>;
}
