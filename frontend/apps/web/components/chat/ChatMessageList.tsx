"use client";
import { useEffect, useRef, useState } from "react";
import { Code2, Lightbulb, PenLine, AudioLines, AlertTriangle, Check, ArrowDown, Loader2, ChevronDown, ChevronRight, Terminal } from "lucide-react";
import type { MessageItem } from "../../lib/api";
import type { SendVoicePrompt } from "../orb/core/voice-session";
import { OrbCanvas } from "../orb/OrbCanvas";
import { OrbPlayLayer, PlayfulOrb } from "../orb/playful/OrbPlayLayer";
import { useOrbTheme } from "../orb/hooks/useOrbTheme";
import playStyles from "../orb/playful/PlayfulOrb.module.css";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ChatHistory } from "./ChatHistory";
import { LiveLogsPanel } from "./ToolLogAccordion";
import styles from "./Chat.module.css";

interface ChatMessageListProps {
  messages: MessageItem[];
  isStreaming: boolean;
  streamingMessage: string;
  streamingLogs?: string[];
  activeTool: {
    name: string;
    status: "start" | "done" | "error";
  } | null;
  onSelectPrompt: (prompt: string) => void;
  onVoicePrompt: SendVoicePrompt;
  onOpenSiriModal?: () => void;
}

const starters = [
  { Icon: Lightbulb, title: "Think it through", sub: "Turn a rough idea into a plan", prompt: "Help me think through an idea. Ask me what I have in mind, then help me make a practical plan." },
  { Icon: Code2, title: "Build something", sub: "A second pair of eyes on code", prompt: "Help me review some code. Ask me for the code and what I want to improve." },
  { Icon: PenLine, title: "Find the words", sub: "Make your message feel right", prompt: "Help me write something clearly. Ask me about the audience, the message, and the tone." },
];

export function ChatMessageList({ messages, isStreaming, streamingMessage, streamingLogs = [], activeTool, onSelectPrompt, onVoicePrompt, onOpenSiriModal }: ChatMessageListProps) {
  const { theme: orbTheme } = useOrbTheme();
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [showJump, setShowJump] = useState(false);
  useEffect(() => {
    const el = scroll.current; if (el && follow.current)
      el.scrollTop = el.scrollHeight;
  }, [messages, streamingMessage, isStreaming, activeTool, streamingLogs]);
  if (!messages.length && !isStreaming)
    return <section className={styles.welcome} aria-label="Start a conversation">
      <div className={styles.welcomeInner}>

        <OrbPlayLayer size={165}><OrbCanvas size={165} showControls={false} onClick={onOpenSiriModal} onVoicePrompt={onVoicePrompt} /></OrbPlayLayer>

        <div className={styles.eyebrow}>A little clarity, a little company</div>
        <h1>What's on your mind<span>?</span></h1>
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

        <ChatHistory messages={messages} />

        {isStreaming && <article className={styles.message} aria-label="Aevora is replying">
          <div className={playStyles.replyAvatar} aria-hidden="true"><PlayfulOrb size={48} theme={orbTheme} state={2} streaming response={streamingMessage} interactive={false} label="Aevora is responding" /></div>
          <div className={styles.messageBody}>
            <div className={styles.assistantName}>
              <span>Aevora</span>
              <span className={playStyles.streamBadge}><i aria-hidden="true" />{streamingMessage ? "Responding" : "Thinking"}</span>
            </div>

            {activeTool && <div className={styles.toolStatus} data-status={activeTool.status} role="status">
              {activeTool.status === "error" ? <AlertTriangle size={12} /> : activeTool.status === "done" ? <Check size={12} /> : <Loader2 size={12} />}
              <code>
                {activeTool.name}
              </code>
              <span>
                {activeTool.status === "start" ? "Running" : activeTool.status === "done" ? "Completed" : "Failed"}
              </span>
            </div>}

            {/* Keep real tool output accessible even after response text begins. */}
            {(streamingLogs.length > 0 || activeTool) && (
              <LiveLogsPanel logs={streamingLogs} activeTool={activeTool} />
            )}

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
