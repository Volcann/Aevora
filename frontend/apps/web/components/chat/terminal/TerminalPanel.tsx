"use client";

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, ChevronDown, ChevronRight, Copy, Download, Search, Terminal, WrapText, X } from "lucide-react";
import { cleanTerminalText, terminalLines, type TerminalSegment } from "./terminal-model";
import styles from "./Terminal.module.css";

type ActiveTool = { name: string; status: "start" | "done" | "error" } | null;
interface TerminalPanelProps { title: string; logs: string; live?: boolean; defaultOpen?: boolean; activeTool?: ActiveTool }

function Highlighted({ segment, query }: { segment: TerminalSegment; query: string }) {
  if (!query) return <>{segment.text}</>;
  const lower = segment.text.toLocaleLowerCase(), needle = query.toLocaleLowerCase();
  const chunks = [];
  let cursor = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    chunks.push(segment.text.slice(cursor, at), <mark key={at}>{segment.text.slice(at, at + query.length)}</mark>);
    cursor = at + query.length;
    at = lower.indexOf(needle, cursor);
  }
  chunks.push(segment.text.slice(cursor));
  return <>{chunks}</>;
}

/** This is a log viewer, not a shell. All content comes from existing tool events. */
export const TerminalPanel = memo(function TerminalPanel({ title, logs, live = false, defaultOpen = false, activeTool = null }: TerminalPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [wrap, setWrap] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState(true);
  const [notice, setNotice] = useState("");
  const pane = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const search = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const id = useId();
  const output = useMemo(() => terminalLines(logs), [logs]);
  const needle = query.trim();
  const filtered = useMemo(() => needle ? output.lines.filter(line => line.text.toLocaleLowerCase().includes(needle.toLocaleLowerCase())) : output.lines, [output, needle]);
  const status = activeTool?.status === "error" ? "error" : activeTool?.status === "start" ? "running" : activeTool?.status === "done" ? "done" : live ? "live" : "saved";
  const statusLabel = { error: "Tool error", running: "Running", done: "Tool finished", live: "Live output", saved: "Saved output" }[status];
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, []);
  useEffect(() => {
    if (open && !needle && followRef.current && pane.current) pane.current.scrollTop = pane.current.scrollHeight;
  }, [logs, open, needle, wrap]);
  useEffect(() => { if (showSearch) search.current?.focus(); }, [showSearch]);
  const notify = (value: string) => {
    if (!mounted.current) return;
    setNotice(value);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => { if (mounted.current) setNotice(""); }, 2400);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(cleanTerminalText(logs)); notify("Copied output"); }
    catch { notify("Clipboard unavailable. Select the output to copy it."); }
  };
  const download = () => {
    try {
      const blob = new Blob([cleanTerminalText(logs)], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "tool-output"}.log`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      // Revocation after the browser has consumed the download navigation.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Output downloaded");
    } catch { notify("Download unavailable. Use Copy output instead."); }
  };
  const follow = () => {
    followRef.current = true; setFollowing(true); setQuery("");
    if (pane.current) pane.current.scrollTop = pane.current.scrollHeight;
  };
  return <section className={styles.panel} data-terminal-status={status} aria-label={`${title} terminal`}>
    <header className={styles.header}>
      <span className={styles.windowDots} aria-hidden="true"><i /><i /><i /></span>
      <button type="button" className={styles.disclosure} aria-expanded={open} aria-controls={`${id}-output`} onClick={() => setOpen(!open)}>
        <Terminal size={13} aria-hidden="true" /><span className={styles.title} title={title}>{title}</span>
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
      </button>
      <span className={styles.status} data-state={status} role="status"><i aria-hidden="true" /><span>{statusLabel}</span></span>
    </header>
    {open && <div id={`${id}-output`}>
      <div className={styles.toolbar}>
        <span className={styles.readOnly}>READ-ONLY <span>·</span> TOOL OUTPUT</span>
        <div className={styles.actions}>
          <button type="button" aria-label="Search logs" title="Search output" aria-pressed={showSearch} onClick={() => { setShowSearch(!showSearch); setQuery(""); }}><Search size={13} /></button>
          <button type="button" aria-label="Wrap lines" title={wrap ? "Disable line wrapping" : "Wrap long lines"} aria-pressed={wrap} onClick={() => setWrap(!wrap)}><WrapText size={13} /></button>
          <button type="button" aria-label="Download logs" title="Download full output" disabled={!logs} onClick={download}><Download size={13} /></button>
          <button type="button" aria-label="Copy logs" title="Copy full output" disabled={!logs} onClick={() => { void copy(); }}>{notice === "Copied output" ? <Check size={13} /> : <Copy size={13} />}</button>
        </div>
      </div>
      {showSearch && <div className={styles.searchBar}><Search size={12} aria-hidden="true" /><input ref={search} aria-label="Filter terminal output" placeholder="Find in output…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setQuery(""); setShowSearch(false); } }} /><span>{needle ? `${filtered.length} lines` : ""}</span><button type="button" aria-label="Close log search" onClick={() => { setQuery(""); setShowSearch(false); }}><X size={12} /></button></div>}
      {output.omitted && <p className={styles.limitNote}>Showing recent output only. Copy or download includes the full log. Line numbers are relative to this view.</p>}
      <div ref={pane} className={styles.viewport} data-wrap={wrap} role="region" aria-label="Terminal output" tabIndex={0} onScroll={event => {
        if (needle) return;
        const element = event.currentTarget;
        const next = element.scrollHeight - element.scrollTop - element.clientHeight < 28;
        followRef.current = next; setFollowing(next);
      }}>
        {!logs.trim() ? <div className={styles.empty}><span aria-hidden="true">›</span> Waiting for tool output…{live && <i className={styles.cursor} aria-hidden="true" />}</div> : filtered.length === 0 ? <p className={styles.empty}>No matching output.</p> : <div className={styles.lines}>
          {filtered.map(line => <div className={styles.line} data-kind={line.kind} key={line.number}>
            <span className={styles.lineNumber} aria-hidden="true">{line.number}</span>
            <code>{line.segments.length ? line.segments.map((segment, index) => <span key={index} data-tone={segment.tone} data-bold={segment.bold}><Highlighted segment={segment} query={needle} /></span>) : "\u00a0"}</code>
          </div>)}
          {live && !needle && <div className={styles.liveLine} aria-hidden="true"><span>›</span><i className={styles.cursor} /></div>}
        </div>}
      </div>
      <footer className={styles.footer}>
        <span>{needle ? `${filtered.length} matching` : `${output.lines.length} visible`} {output.lines.length === 1 && !needle ? "line" : "lines"}</span>
        {live ? <button type="button" aria-label="Follow terminal output" aria-pressed={following && !needle} onClick={follow}><ArrowDown size={11} />{following && !needle ? "Following output" : "Jump to latest"}</button> : <span>Output only · no shell access</span>}
      </footer>
    </div>}
    <span className={styles.copyNotice} role="status">{notice}</span>
  </section>;
});
