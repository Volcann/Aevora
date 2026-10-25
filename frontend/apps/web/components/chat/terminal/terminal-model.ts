/** Safe, read-only terminal text. Escape codes never become HTML or executable links. */
export interface TerminalSegment { text: string; tone?: string; bold?: boolean }
export interface TerminalLine { number: number; text: string; kind: "plain" | "command" | "error" | "warning" | "success" | "info"; segments: TerminalSegment[] }
export const MAX_VISIBLE_LINES = 1200;
export const MAX_VISIBLE_CHARACTERS = 240_000;
// Strip OSC (including hyperlinks), non-SGR CSI sequences, and non-printing controls.
export function cleanTerminalText(value: string): string {
  return value
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[()][0-2A-Z0-9]/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/\r\n?/g, "\n");
}
const ANSI_TONES: Record<number, string> = {
  30: "muted", 31: "red", 32: "green", 33: "yellow", 34: "blue", 35: "magenta", 36: "cyan", 37: "white",
  90: "muted", 91: "red", 92: "green", 93: "yellow", 94: "blue", 95: "magenta", 96: "cyan", 97: "white",
};
function kindOf(text: string): TerminalLine["kind"] {
  if (/^\s*(?:\$\s|❯\s|>\s|PS\s+[^>]+>)/.test(text)) return "command";
  if (/(?:^|\s|\[)(?:error|failed|failure|fatal|traceback)(?:\b|\])/i.test(text)) return "error";
  if (/(?:^|\s|\[)(?:warn(?:ing)?|deprecated)(?:\b|\])/i.test(text)) return "warning";
  if (/(?:^|\s|\[)(?:success|passed|complete(?:d)?|done)(?:\b|\])|^\s*[✓✔]/i.test(text)) return "success";
  if (/^\s*(?:\[?(?:info|debug)\b|→)/i.test(text)) return "info";
  return "plain";
}
export function terminalLines(raw: string): { lines: TerminalLine[]; omitted: boolean } {
  if (!raw) return { lines: [], omitted: false };
  const charTruncated = raw.length > MAX_VISIBLE_CHARACTERS;
  const tail = raw.slice(-MAX_VISIBLE_CHARACTERS)
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-ln-~]/g, "")
    .replace(/\r\n?/g, "\n");
  const all = tail.split("\n");
  // Avoid an artificial extra numbered line after a final newline.
  if (all.length > 1 && all.at(-1) === "") all.pop();
  const start = Math.max(0, all.length - MAX_VISIBLE_LINES);
  let tone: string | undefined;
  let bold = false;
  const lines = all.slice(start).map((source, index): TerminalLine => {
    const segments: TerminalSegment[] = [];
    const pattern = /\x1b\[([\d;]*)m/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    const append = (text: string) => { const clean = cleanTerminalText(text); if (clean) segments.push({ text: clean, tone, bold }); };
    while ((match = pattern.exec(source))) {
      append(source.slice(cursor, match.index));
      const codes = (match[1] || "0").split(";").map(Number);
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i]!;
        if (code === 0) { tone = undefined; bold = false; }
        else if (code === 1) bold = true;
        else if (code === 22) bold = false;
        else if (code === 39) tone = undefined;
        // Unsupported indexed/truecolor values must not be mistaken for SGR styles.
        else if (code === 38 || code === 48 || code === 58) i += codes[i + 1] === 2 ? 4 : codes[i + 1] === 5 ? 2 : 0;
        else if (ANSI_TONES[code]) tone = ANSI_TONES[code];
      }
      cursor = pattern.lastIndex;
    }
    append(source.slice(cursor));
    const text = segments.map(segment => segment.text).join("");
    return { number: start + index + 1, text, kind: kindOf(text), segments };
  });
  return { lines, omitted: charTruncated || start > 0 };
}
