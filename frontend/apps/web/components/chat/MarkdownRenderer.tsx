"use client";

import React, { useState } from "react";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

// ─── Code Block Component with Copy Functionality ─────────────────────────
function CodeBlock({
  language,
  code,
  isStreaming,
}: {
  language: string;
  code: string;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-3.5 rounded-xl overflow-hidden border border-border/80 bg-[#0d1117] font-mono text-xs shadow-md">
      {/* Code Block Top Header */}
      <div className="px-3.5 py-2 bg-[#161b22] border-b border-border/60 text-[11px] text-muted-foreground flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70 inline-block" />
          <span className="ml-1.5 font-semibold uppercase tracking-wider text-[10px] text-cyan-400/90">
            {language || "code"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-white/10 text-[11px] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-[#22c55e] font-medium text-[11px]">Copied!</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Text Content */}
      <pre className="p-4 overflow-x-auto text-[#e6edf3] leading-relaxed scrollbar-thin selection:bg-cyan-500/30">
        <code>{code}</code>
        {isStreaming && <span className="stream-cursor" />}
      </pre>
    </div>
  );
}

// ─── Table Helper Types & Utilities ───────────────────────────────────────
function isTableDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-") || !trimmed.includes("|")) return false;
  const cells = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function getAlignment(cell: string): "left" | "center" | "right" {
  const trimmed = cell.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
  if (trimmed.endsWith(":")) return "right";
  return "left";
}

// ─── Main Markdown Renderer Component ─────────────────────────────────────
export function MarkdownRenderer({ content, isStreaming = false }: MarkdownRendererProps) {
  // Inline formatting: links, bold, italic, strikethrough, inline code
  const parseInline = (
    text: string,
    isEnd = false,
    showCursor = false
  ): React.ReactNode => {
    if (!text && !showCursor) return null;

    const tokenRegex =
      /(\[.*?\]\(.*?\)|\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|~~.*?~~|`.*?`)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.slice(lastIdx, match.index));
      }

      const token = match[0];
      const key = `inline-${match.index}`;

      if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
        const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
          parts.push(
            <a
              key={key}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors font-medium"
            >
              {linkMatch[1]}
            </a>
          );
        } else {
          parts.push(token);
        }
      } else if (token.startsWith("***") && token.endsWith("***")) {
        parts.push(
          <strong key={key} className="font-bold text-foreground">
            <em className="italic">{token.slice(3, -3)}</em>
          </strong>
        );
      } else if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={key} className="font-bold text-foreground">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(
          <em key={key} className="italic text-foreground/90">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith("~~") && token.endsWith("~~")) {
        parts.push(
          <del key={key} className="line-through text-muted-foreground">
            {token.slice(2, -2)}
          </del>
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={key}
            className="px-1.5 py-0.5 rounded-md bg-surface border border-border text-[0.84em] font-mono text-cyan-300 font-medium"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else {
        parts.push(token);
      }

      lastIdx = tokenRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }

    if (isEnd && showCursor) {
      parts.push(<span key="stream-cursor" className="stream-cursor" />);
    }

    return parts.length > 0 ? (
      <>{parts}</>
    ) : isEnd && showCursor ? (
      <span key="stream-cursor" className="stream-cursor" />
    ) : (
      text
    );
  };

  const renderBlocks = () => {
    const rawLines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      const isLastLine = i === rawLines.length - 1;

      // 1. Code Blocks (fenced with ```)
      if (line.trim().startsWith("```")) {
        const lang = line.trim().replace(/^```/, "").trim();
        const codeLines: string[] = [];
        let closed = false;
        i++;

        while (i < rawLines.length) {
          if (rawLines[i].trim().startsWith("```")) {
            closed = true;
            i++;
            break;
          }
          codeLines.push(rawLines[i]);
          i++;
        }

        const isActivelyStreamingCode = !closed && isStreaming && i >= rawLines.length;
        elements.push(
          <CodeBlock
            key={`code-${i}`}
            language={lang}
            code={codeLines.join("\n")}
            isStreaming={isActivelyStreamingCode}
          />
        );
        continue;
      }

      // 2. Tables (GFM Tables)
      if (
        line.includes("|") &&
        i + 1 < rawLines.length &&
        isTableDelimiter(rawLines[i + 1])
      ) {
        const headers = parseTableRow(line);
        const delimiterCells = parseTableRow(rawLines[i + 1]);
        const alignments = delimiterCells.map(getAlignment);
        const rows: string[][] = [];
        i += 2;

        while (i < rawLines.length && rawLines[i].includes("|") && rawLines[i].trim() !== "") {
          rows.push(parseTableRow(rawLines[i]));
          i++;
        }

        elements.push(
          <div
            key={`table-${i}`}
            className="my-3.5 overflow-x-auto rounded-xl border border-border bg-surface/30 shadow-xs scrollbar-thin"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-hover/80 border-b border-border">
                  {headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      className={`px-3.5 py-2.5 font-semibold text-foreground uppercase tracking-wider text-[11px] ${
                        alignments[hIdx] === "center"
                          ? "text-center"
                          : alignments[hIdx] === "right"
                          ? "text-right"
                          : "text-left"
                      }`}
                    >
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-surface/50 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-3.5 py-2 leading-relaxed text-foreground/90 ${
                          alignments[cIdx] === "center"
                            ? "text-center"
                            : alignments[cIdx] === "right"
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // 3. Blockquotes (>)
      if (line.trim().startsWith(">")) {
        const quoteLines: string[] = [];
        while (i < rawLines.length && rawLines[i].trim().startsWith(">")) {
          quoteLines.push(rawLines[i].replace(/^>\s?/, ""));
          i++;
        }
        const isQuoteEnd = i >= rawLines.length && isStreaming;
        elements.push(
          <blockquote
            key={`quote-${i}`}
            className="border-l-3 border-cyan-400 bg-surface/40 px-3.5 py-2.5 rounded-r-xl my-2.5 text-muted-foreground text-xs leading-relaxed italic"
          >
            {quoteLines.map((ql, qIdx) => (
              <div key={qIdx}>
                {parseInline(
                  ql,
                  isQuoteEnd && qIdx === quoteLines.length - 1,
                  isStreaming
                )}
              </div>
            ))}
          </blockquote>
        );
        continue;
      }

      // 4. Horizontal Rules (---, ***, ___)
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        elements.push(<hr key={`hr-${i}`} className="my-4 border-t border-border" />);
        i++;
        continue;
      }

      // 5. Headings (#, ##, ###, ####)
      if (line.startsWith("# ")) {
        elements.push(
          <h2
            key={`h1-${i}`}
            className="font-extrabold text-lg text-foreground mt-4 mb-2 pb-1 border-b border-border/40"
          >
            {parseInline(line.slice(2), isLastLine, isStreaming)}
          </h2>
        );
        i++;
        continue;
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h3
            key={`h2-${i}`}
            className="font-bold text-base text-foreground mt-3.5 mb-1.5 pb-0.5 border-b border-border/30"
          >
            {parseInline(line.slice(3), isLastLine, isStreaming)}
          </h3>
        );
        i++;
        continue;
      }
      if (line.startsWith("### ")) {
        elements.push(
          <h4
            key={`h3-${i}`}
            className="font-bold text-sm text-foreground mt-3 mb-1"
          >
            {parseInline(line.slice(4), isLastLine, isStreaming)}
          </h4>
        );
        i++;
        continue;
      }
      if (line.startsWith("#### ")) {
        elements.push(
          <h5
            key={`h4-${i}`}
            className="font-semibold text-xs text-foreground uppercase tracking-wide mt-2.5 mb-1"
          >
            {parseInline(line.slice(5), isLastLine, isStreaming)}
          </h5>
        );
        i++;
        continue;
      }

      // 6. Bullet Lists (- , * , + ) & Task Lists
      const bulletMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
      if (bulletMatch) {
        const indentLevel = Math.floor(bulletMatch[1].length / 2);
        const itemText = bulletMatch[3];
        const taskMatch = itemText.match(/^\[([ xX])\]\s+(.*)$/);

        elements.push(
          <div
            key={`bullet-${i}`}
            className="flex items-start gap-2.5 my-1.5"
            style={{ paddingLeft: `${indentLevel * 16 + 4}px` }}
          >
            {taskMatch ? (
              <span className="mt-0.5 text-xs text-cyan-400">
                {taskMatch[1].toLowerCase() === "x" ? "☑" : "☐"}
              </span>
            ) : (
              <span className="text-cyan-400 font-bold text-xs mt-0.5 select-none">•</span>
            )}
            <div className="flex-1 leading-relaxed text-sm">
              {parseInline(
                taskMatch ? taskMatch[2] : itemText,
                isLastLine,
                isStreaming
              )}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // 7. Numbered Lists (1. 2. etc.)
      const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numMatch) {
        const indentLevel = Math.floor(numMatch[1].length / 2);
        elements.push(
          <div
            key={`num-${i}`}
            className="flex items-start gap-2 my-1.5"
            style={{ paddingLeft: `${indentLevel * 16 + 4}px` }}
          >
            <span className="text-cyan-400 font-semibold text-xs mt-0.5 min-w-[18px] select-none">
              {numMatch[2]}.
            </span>
            <div className="flex-1 leading-relaxed text-sm">
              {parseInline(numMatch[3], isLastLine, isStreaming)}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // 8. Empty lines
      if (!line.trim()) {
        elements.push(<div key={`empty-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // 9. Standard Paragraph
      elements.push(
        <p key={`p-${i}`} className="leading-relaxed my-1.5 text-sm text-foreground/95">
          {parseInline(line, isLastLine, isStreaming)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return <div className="space-y-0.5 text-sm">{renderBlocks()}</div>;
}
