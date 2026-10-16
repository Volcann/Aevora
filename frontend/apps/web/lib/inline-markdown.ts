/** Presentation-only inline tokens. Never rewrites the stored or streamed text. */
export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; children: InlineToken[] }
  | { kind: "em"; children: InlineToken[] }
  | { kind: "del"; children: InlineToken[] }
  | { kind: "link"; href: string; children: InlineToken[] };

const punctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
const word = /[\p{L}\p{N}]/u;

export function safeMarkdownHref(value: string): string | null {
  const href = value.trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return null;
  try {
    const url = new URL(href, "https://aevora.invalid/");
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? href : null;
  } catch { return null; }
}

function runLength(text: string, start: number, char: string): number {
  let end = start;
  while (text[end] === char) end++;
  return end - start;
}

function closingDelimiter(text: string, from: number, marker: string): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") { i++; continue; }
    if (text[i] === "`") {
      const count = runLength(text, i, "`");
      const end = text.indexOf("`".repeat(count), i + count);
      if (end >= 0) { i = end + count - 1; continue; }
    }
    if (!text.startsWith(marker, i) || /\s/.test(text[i - 1] ?? "")) continue;
    const count = runLength(text, i, marker[0]!);
    // A single * must not consume a nested **bold** opening/closing run.
    if (marker.length === 1 && count > 1) { i += count - 1; continue; }
    if (marker[0] === "_" && word.test(text[i + marker.length] ?? "")) continue;
    // Leave one star to close a nested italic before closing outer bold.
    return marker.length === 2 && count === 3 ? i + 1 : i;
  }
  return -1;
}

/** The app's existing inline subset, with escaped/nested emphasis and partial streams.
 * This is not a full CommonMark parser. Recursion is capped for untrusted model output.
 */
export function parseInlineTokens(text: string, streaming = false, depth = 0): InlineToken[] {
  if (depth >= 12) return [{ kind: "text", text }];
  const tokens: InlineToken[] = [];
  let plain = "";
  const flush = () => { if (plain) { tokens.push({ kind: "text", text: plain }); plain = ""; } };
  for (let i = 0; i < text.length;) {
    const char = text[i]!;
    if (char === "\\" && punctuation.test(text[i + 1] ?? "")) {
      plain += text[i + 1]; i += 2; continue;
    }
    if (char === "`") {
      const marker = "`".repeat(runLength(text, i, "`"));
      const end = text.indexOf(marker, i + marker.length);
      if (end >= 0) {
        flush(); tokens.push({ kind: "code", text: text.slice(i + marker.length, end) });
        i = end + marker.length; continue;
      }
    }
    if (char === "[") {
      const labelEnd = text.indexOf("](", i + 1);
      if (labelEnd >= 0) {
        let end = labelEnd + 2, balance = 1;
        for (; end < text.length; end++) {
          if (text[end] === "\\") { end++; continue; }
          if (text[end] === "(") balance++;
          if (text[end] === ")" && --balance === 0) break;
        }
        if (balance === 0) {
          flush();
          const children = parseInlineTokens(text.slice(i + 1, labelEnd), false, depth + 1);
          const href = safeMarkdownHref(text.slice(labelEnd + 2, end));
          if (href) tokens.push({ kind: "link", href, children });
          else tokens.push(...children);
          i = end + 1; continue;
        }
      }
    }
    if (char === "*" || char === "_" || char === "~") {
      const run = runLength(text, i, char);
      const length = char === "~" ? (run >= 2 ? 2 : 0) : Math.min(run, 3);
      const marker = char.repeat(length);
      const next = text[i + length];
      const canOpen = length > 0 && (next === undefined || !/\s/.test(next))
        && !(char === "_" && word.test(text[i - 1] ?? ""));
      if (canOpen) {
        const end = closingDelimiter(text, i + length, marker);
        if (end > i + length || (end < 0 && streaming)) {
          flush();
          let inner = text.slice(i + length, end < 0 ? text.length : end);
          // A closing ** split across chunks must not flash its first * as text.
          if (end < 0 && length > 1) {
            let pending = 0;
            while (pending < length - 1 && inner[inner.length - pending - 1] === char) pending++;
            if (pending) inner = inner.slice(0, -pending);
          }
          const children = parseInlineTokens(inner, end < 0 && streaming, depth + 1);
          const kind = char === "~" ? "del" : length === 1 ? "em" : "strong";
          tokens.push({ kind, children: length === 3 ? [{ kind: "em", children }] : children });
          i = end < 0 ? text.length : end + length; continue;
        }
        // Preserve an unmatched delimiter atomically, not as empty italic tokens.
        plain += marker; i += length; continue;
      }
    }
    plain += char; i++;
  }
  flush();
  return tokens;
}
