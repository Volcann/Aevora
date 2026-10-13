"use client";
import { useEffect, useRef, useState } from "react";
import { Code2, Lightbulb, PenLine, AudioLines, AlertTriangle, Check, Copy, ArrowDown, Loader2 } from "lucide-react";
import type { MessageItem } from "../../lib/api";
import type { SendVoicePrompt } from "../orb/core/voice-session";
import { OrbCanvas } from "../orb/OrbCanvas";
import { MarkdownRenderer } from "./MarkdownRenderer";
import styles from "./Chat.module.css";
interface ChatMessageListProps {
  messages: MessageItem[];
  isStreaming: boolean;
  streamingMessage: string;
  activeTool: {
    name: string;
    status: "start" | "done" | "error";
  } | null;
  onSelectPrompt: (prompt: string) => void;
  onVoicePrompt: SendVoicePrompt;
  onOpenSiriModal?: () => void;
}
function CopyMessage({ content }: {
  content: string;
}) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!status)
      return; const timer = setTimeout(() => setStatus(""), 2000); return () => clearTimeout(timer);
  }, [status]);
  return <div className={styles.messageTools}>
    <button
      className={styles.iconButton}
      aria-label="Copy response"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setStatus("Copied");
        }
        catch {
          setStatus("Copy unavailable");
        }
      }}>
      {status === "Copied" ? <Check size={13} /> : <Copy size={13} />}
    </button>
    <span role="status">
      {status}
    </span>
  </div>;
}
const starters = [
  { Icon: Lightbulb, title: "Think it through", sub: "Turn a rough idea into a plan", prompt: "Help me think through an idea. Ask me what I have in mind, then help me make a practical plan." },
  { Icon: Code2, title: "Build something", sub: "A second pair of eyes on code", prompt: "Help me review some code. Ask me for the code and what I want to improve." },
  { Icon: PenLine, title: "Find the words", sub: "Make your message feel right", prompt: "Help me write something clearly. Ask me about the audience, the message, and the tone." },
];
export function ChatMessageList({ messages, isStreaming, streamingMessage, activeTool, onSelectPrompt, onVoicePrompt, onOpenSiriModal }: ChatMessageListProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [showJump, setShowJump] = useState(false);
  useEffect(() => {
    const el = scroll.current; if (el && follow.current)
      el.scrollTop = el.scrollHeight;
  }, [messages, streamingMessage, isStreaming, activeTool]);
  if (!messages.length && !isStreaming)
    return <section className={styles.welcome} aria-label="Start a conversation">
      <div className={styles.welcomeInner}>

        <OrbCanvas size={165} showControls={false} onClick={onOpenSiriModal} onVoicePrompt={onVoicePrompt} />

        <div className={styles.eyebrow}>A little clarity, a little company</div>
        <h1>What’s on your mind<span>?</span></h1>
        <p>A place to think out loud, make something new,<br />or simply have a conversation.</p>

        <div className={styles.suggestions}>
          {starters.map(({ Icon, title, sub, prompt }) => <button key={title} className={styles.suggestion} onClick={() => onSelectPrompt(prompt)}>
            <Icon size={18} />
            <strong>
              {title}
            </strong>
            <span>
              {sub}
            </span>
          </button>)}
        </div>

        {onOpenSiriModal && <button className={styles.welcomeVoice} onClick={onOpenSiriModal}><AudioLines size={14} />Rather talk? Start a voice call</button>}

      </div>
    </section>;
  return <>
    <section
      ref={scroll}
      className={styles.feed}
      aria-label="Conversation messages"
      onScroll={(event) => { const el = event.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90; setShowJump(!follow.current); }}>
      <div className={styles.conversation}>

        {messages.map((message) => <article
          key={message.id}
          className={styles.message}
          data-role={message.role === "user" ? "user" : "assistant"}
          aria-label={message.role === "user" ? "You" : "Aevora"}>

          {message.role === "user" ? <div className={styles.userBubble}>
            {message.content}
          </div> : <><div className={styles.assistantAvatar} aria-hidden="true">a</div><div className={styles.messageBody}>
            <div className={styles.assistantName}>Aevora</div>
            {/^(⚠ Error:|Error communicating)/.test(message.content) ? <div className={styles.error}>
              <AlertTriangle size={16} />
              <span>
                {message.content}
              </span>
            </div> : <MarkdownRenderer content={message.content} />}
            <CopyMessage content={message.content} />
          </div></>}

        </article>)}

        {isStreaming && <article className={styles.message} aria-label="Aevora is replying">
          <div className={styles.assistantAvatar} aria-hidden="true">a</div>
          <div className={styles.messageBody}>
            <div className={styles.assistantName}>Aevora</div>

            {activeTool && <div className={styles.toolStatus} data-status={activeTool.status} role="status">
              {activeTool.status === "error" ? <AlertTriangle size={12} /> : activeTool.status === "done" ? <Check size={12} /> : <Loader2 size={12} />}
              <code>
                {activeTool.name}
              </code>
              <span>
                {activeTool.status === "start" ? "Running" : activeTool.status === "done" ? "Completed" : "Failed"}
              </span>
            </div>}

            {streamingMessage ? <MarkdownRenderer content={streamingMessage} isStreaming /> : <div className={styles.thinking} role="status"><span className={styles.thinkingDots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>Thinking…</div>}

          </div>
        </article>}

      </div>
    </section>
    {showJump && <button
      className={styles.jumpButton}
      onClick={() => {
        follow.current = true; setShowJump(false); if (scroll.current)
          scroll.current.scrollTop = scroll.current.scrollHeight;
      }}><ArrowDown size={13} />Latest messages</button>}
  </>;
}
