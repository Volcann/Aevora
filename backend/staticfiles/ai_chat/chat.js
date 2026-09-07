/**
 * chat.js — Volcann AI chat UI logic
 *
 * Expects window.VOLCANN to be defined before this script loads:
 *   { SESSION_ID, STREAM_URL, CSRF_TOKEN, NEW_CHAT_URL, AI_AVATAR, WORD_SPEED }
 */

"use strict";

const { SESSION_ID, STREAM_URL, CSRF_TOKEN, NEW_CHAT_URL, AI_AVATAR, WORD_SPEED } =
  window.VOLCANN;

const DELETE_URL = (id) => `/chat/${id}/delete/`;

const THINKING_PHRASES = [
  "Reading your message", "Thinking it through", "Gathering the details",
  "Connecting the dots", "Summing things up", "Double-checking the answer",
  "Researching that for you", "Working through the steps", "Almost there",
  "Pulling it together", "Just a moment", "Weighing the options",
];
const BAR_WIDTHS = [120, 160, 100, 200, 140, 180, 110, 220];

/* ── Ripple helper ──────────────────────────────────────────── */
function addRipple(btn, e) {
  const r    = btn.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  const x    = (e.clientX - r.left) - size / 2;
  const y    = (e.clientY - r.top)  - size / 2;
  const rip  = document.createElement("span");
  rip.className  = "ripple";
  rip.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  btn.appendChild(rip);
  rip.addEventListener("animationend", () => rip.remove());
}

/* ── Scrollbar "active while scrolling" ─────────────────────── */
let scrollTimer;
function onScroll(el) {
  el.classList.add("is-scrolling");
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => el.classList.remove("is-scrolling"), 800);
}
document.querySelectorAll(".chat-messages, .history-container").forEach((el) =>
  el.addEventListener("scroll", () => onScroll(el), { passive: true })
);

/* ══════════════════════════════════════════════════════════════
   COLOR PANEL
   ══════════════════════════════════════════════════════════════ */
const PRESETS = [
  { h: 138, s: 55, l: 42, label: "Forest"  },
  { h: 211, s: 80, l: 42, label: "Ocean"   },
  { h: 260, s: 65, l: 52, label: "Violet"  },
  { h:   0, s: 72, l: 48, label: "Crimson" },
  { h:  28, s: 80, l: 48, label: "Amber"   },
  { h: 180, s: 60, l: 38, label: "Teal"    },
  { h: 330, s: 65, l: 48, label: "Rose"    },
];

const root = document.documentElement;

function getAccentValues() {
  const cs = getComputedStyle(root);
  return {
    h: parseInt(cs.getPropertyValue("--accent-h")) || 138,
    s: parseInt(cs.getPropertyValue("--accent-s")) || 55,
    l: parseInt(cs.getPropertyValue("--accent-l")) || 42,
  };
}

function applyAccent(h, s, l) {
  root.style.setProperty("--accent-h", h);
  root.style.setProperty("--accent-s", s + "%");
  root.style.setProperty("--accent-l", l + "%");
  localStorage.setItem("volcann-accent", JSON.stringify({ h, s, l }));

  document.getElementById("sliderSat").style.background =
    `linear-gradient(90deg,hsl(${h},10%,50%) 0%,hsl(${h},100%,${l}%) 100%)`;
  document.getElementById("sliderLit").style.background =
    `linear-gradient(90deg,#111 0%,hsl(${h},${s}%,50%) 50%,#fff 100%)`;

  const swatch = document.getElementById("colorSwatch");
  swatch.classList.remove("pulse");
  void swatch.offsetWidth; // force reflow to restart animation
  swatch.classList.add("pulse");

  document.getElementById("sliderHue").value = h;
  document.getElementById("sliderSat").value = s;
  document.getElementById("sliderLit").value = l;
  document.getElementById("valHue").textContent = h + "°";
  document.getElementById("valSat").textContent = s + "%";
  document.getElementById("valLit").textContent = l + "%";

  document.querySelectorAll(".preset-dot").forEach((d) =>
    d.classList.toggle(
      "selected",
      +d.dataset.h === h && +d.dataset.s === s && +d.dataset.l === l
    )
  );
}

// Build preset dots
const presetRow = document.getElementById("presetRow");
PRESETS.forEach((p) => {
  const dot       = document.createElement("button");
  dot.className   = "preset-dot";
  dot.title       = p.label;
  dot.dataset.h   = p.h;
  dot.dataset.s   = p.s;
  dot.dataset.l   = p.l;
  dot.style.background = `hsl(${p.h},${p.s}%,${p.l}%)`;
  dot.addEventListener("click", () => applyAccent(p.h, p.s, p.l));
  presetRow.appendChild(dot);
});

function readSliders() {
  applyAccent(
    +document.getElementById("sliderHue").value,
    +document.getElementById("sliderSat").value,
    +document.getElementById("sliderLit").value
  );
}
["sliderHue", "sliderSat", "sliderLit"].forEach((id) =>
  document.getElementById(id).addEventListener("input", readSliders)
);
document.getElementById("btnResetColor").addEventListener("click", () =>
  applyAccent(138, 55, 42)
);

// Color panel open / close
const panelTrigger = document.getElementById("colorPanelTrigger");
const colorCard    = document.getElementById("colorCard");
panelTrigger.addEventListener("click", () => {
  const open = colorCard.classList.toggle("open");
  panelTrigger.classList.toggle("open", open);
  panelTrigger.setAttribute("aria-expanded", open);
});
document.addEventListener("click", (e) => {
  if (!document.getElementById("colorPanel").contains(e.target)) {
    colorCard.classList.remove("open");
    panelTrigger.classList.remove("open");
    panelTrigger.setAttribute("aria-expanded", "false");
  }
});

// Initialise sliders from current CSS vars (already set by the inline script)
applyAccent(...Object.values(getAccentValues()));

/* ══════════════════════════════════════════════════════════════
   HISTORY TIMELINE + SCROLL REVEAL
   ══════════════════════════════════════════════════════════════ */
const historyContainer = document.getElementById("historyContainer");
const historyLine      = document.getElementById("historyLine");

function updateHistoryLine() {
  if (!historyLine) return;
  const listEl = document.getElementById("historyList");
  if (!listEl) return;

  const containerRect  = historyContainer.getBoundingClientRect();
  const scrollProgress = historyContainer.scrollTop;
  const maxScroll      = historyContainer.scrollHeight - historyContainer.clientHeight;
  const fraction       = maxScroll > 0 ? Math.min(scrollProgress / maxScroll, 1) : 1;
  const lineHeight     = Math.max(8, fraction * listEl.offsetHeight);

  historyLine.style.height = lineHeight + "px";
  historyLine.classList.toggle("active", lineHeight > 10);

  document.querySelectorAll(".history-item").forEach((item) => {
    if (item.getBoundingClientRect().top < containerRect.bottom + 40) {
      const delay = parseInt(item.dataset.index || 0) * 55;
      setTimeout(() => item.classList.add("revealed"), delay);
    }
  });
}

if (historyContainer) {
  historyContainer.addEventListener("scroll", updateHistoryLine, { passive: true });

  setTimeout(() => {
    updateHistoryLine();
    setTimeout(() => {
      const listEl     = document.getElementById("historyList");
      const activeItem = document.querySelector(".history-item.active");
      if (activeItem && historyLine && listEl) {
        const listRect   = listEl.getBoundingClientRect();
        const activeRect = activeItem.getBoundingClientRect();
        const pct = Math.min(
          100,
          ((activeRect.bottom - listRect.top) / listEl.offsetHeight) * 100
        );
        historyLine.style.height = pct + "%";
        historyLine.classList.add("active");
      } else if (historyLine) {
        historyLine.style.height = "60%";
        historyLine.classList.add("active");
      }
    }, 300);
  }, 120);
}

/* ══════════════════════════════════════════════════════════════
   DELETE CHAT
   ══════════════════════════════════════════════════════════════ */
function showDeleteError(item, message) {
  item.classList.remove("deleting");
  const confirmText    = item.querySelector(".delete-confirm-text");
  const confirmActions = item.querySelector(".delete-confirm-actions");
  if (confirmText) confirmText.textContent = message;
  if (confirmActions) {
    confirmActions.innerHTML = '<button class="btn-del-no">OK</button>';
    confirmActions.querySelector(".btn-del-no").addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      item.querySelector(".delete-confirm")?.classList.remove("visible");
    });
  }
}

function initDeleteButtons() {
  // Show confirm overlay
  document.querySelectorAll(".history-delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const item = btn.closest(".history-item");
      item.querySelector(".delete-confirm")?.classList.add("visible");
    });
  });

  // Cancel
  document.querySelectorAll(".btn-del-no").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.closest(".delete-confirm")?.classList.remove("visible");
    });
  });

  // Confirm delete
  document.querySelectorAll(".btn-del-yes").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sessionId = btn.dataset.sessionId;
      const isCurrent = btn.dataset.isCurrent === "1";
      const item      = btn.closest(".history-item");

      item.classList.add("deleting");

      try {
        const res  = await fetch(DELETE_URL(sessionId), {
          method:  "POST",
          headers: { "X-CSRFToken": CSRF_TOKEN, "Content-Type": "application/json" },
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          showDeleteError(item, data.error || `Failed to delete chat (${res.status})`);
          return;
        }

        // Collapse then remove
        setTimeout(() => {
          item.classList.add("collapsed");
          setTimeout(() => {
            item.remove();
            updateHistoryLine();
            if (isCurrent) window.location.href = NEW_CHAT_URL;
          }, 350);
        }, 200);

      } catch (err) {
        showDeleteError(item, "Network error deleting chat");
      }
    });
  });
}

initDeleteButtons();

/* ══════════════════════════════════════════════════════════════
   THEME TOGGLE
   ══════════════════════════════════════════════════════════════ */
document.getElementById("themeToggle").addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("volcann-theme", next);
});

/* ══════════════════════════════════════════════════════════════
   SIDEBAR FOLD
   ══════════════════════════════════════════════════════════════ */
const appLayout = document.getElementById("appLayout");
document.getElementById("foldSidebarBtn")
  ?.addEventListener("click", () => appLayout.classList.add("sidebar-folded"));
document.getElementById("toggleSidebarBtn")
  ?.addEventListener("click", () => appLayout.classList.toggle("sidebar-folded"));

/* ══════════════════════════════════════════════════════════════
   MARKDOWN — render existing AI messages
   ══════════════════════════════════════════════════════════════ */
marked.setOptions({ breaks: true, gfm: true });
document.querySelectorAll(".js-render-md").forEach((el) => {
  el.innerHTML = marked.parse(el.textContent.trim() || "");
});

/* ══════════════════════════════════════════════════════════════
   TOOL POPOVER
   ══════════════════════════════════════════════════════════════ */
const chatInput    = document.getElementById("chatInput");
const toolsPopover = document.getElementById("toolsPopover");
const toolMenuBtn  = document.getElementById("toolMenuTrigger");
const sendBtn      = document.getElementById("sendBtn");
const chatFeed     = document.getElementById("chatFeed");

const allToolOptions = Array.from(document.querySelectorAll(".tool-option[data-tool]"));
let kbdIdx = -1;

function openPopover()  { toolsPopover.classList.add("active");    kbdIdx = -1; }
function closePopover() { toolsPopover.classList.remove("active"); kbdIdx = -1; setKbdFocus(-1); }

function setKbdFocus(idx) {
  const visible = allToolOptions.filter((o) => o.style.display !== "none");
  visible.forEach((o, i) => o.classList.toggle("kbd-focus", i === idx));
  visible[idx]?.scrollIntoView({ block: "nearest" });
}

function filterTools(query) {
  const q = query.toLowerCase();
  let anyVisible = false;
  allToolOptions.forEach((opt) => {
    const name  = opt.dataset.name || "";
    const desc  = opt.querySelector(".tool-option-desc")?.textContent || "";
    const match = !q || name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
    opt.style.display = match ? "" : "none";
    if (match) anyVisible = true;
  });
  return anyVisible;
}

function pickOption(opt) {
  if (!opt) return;
  const cur   = chatInput.value;
  const atIdx = cur.lastIndexOf("@");
  chatInput.value = (atIdx >= 0 ? cur.slice(0, atIdx) : cur) + opt.dataset.tool + " ";
  closePopover();
  filterTools("");
  chatInput.focus();
  autoResize();
}

function autoResize() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
}

toolMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (toolsPopover.classList.contains("active")) {
    closePopover();
  } else {
    filterTools("");
    openPopover();
  }
});

allToolOptions.forEach((opt) => opt.addEventListener("click", () => pickOption(opt)));

chatInput.addEventListener("input", () => {
  const val    = chatInput.value;
  const atIdx  = val.lastIndexOf("@");
  const afterAt = atIdx >= 0 ? val.slice(atIdx + 1) : null;
  const hasSpaceAfterAt = afterAt !== null && afterAt.includes(" ");

  if (atIdx >= 0 && !hasSpaceAfterAt) {
    filterTools(afterAt || "");
    openPopover();
  } else {
    closePopover();
  }
  autoResize();
});

chatInput.addEventListener("keydown", (e) => {
  if (!toolsPopover.classList.contains("active")) return;
  const visible = allToolOptions.filter((o) => o.style.display !== "none");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    kbdIdx = Math.min(kbdIdx + 1, visible.length - 1);
    setKbdFocus(kbdIdx);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    kbdIdx = Math.max(kbdIdx - 1, 0);
    setKbdFocus(kbdIdx);
  } else if ((e.key === "Enter" || e.key === "Tab") && kbdIdx >= 0) {
    e.preventDefault();
    pickOption(visible[kbdIdx]);
  } else if (e.key === "Escape") {
    e.preventDefault();
    closePopover();
  }
});

document.addEventListener("click", (e) => {
  if (!toolsPopover.contains(e.target) && e.target !== toolMenuBtn) closePopover();
});

/* ── Ripples ────────────────────────────────────────────────── */
[sendBtn, document.querySelector(".btn-new-chat")].forEach((btn) => {
  if (btn) btn.addEventListener("click", (e) => addRipple(btn, e));
});

/* ══════════════════════════════════════════════════════════════
   CHAT / STREAMING
   ══════════════════════════════════════════════════════════════ */
const scrollToBottom = () => { chatFeed.scrollTop = chatFeed.scrollHeight; };

function escHtml(s) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toolIndicatorHTML(toolName, state) {
  const ICONS = {
    running: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
    done:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
    error:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
    busy:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  };
  const LABELS = { running: "Running…", done: "Done", error: "Failed", busy: "Queued" };
  const cls = state === "done" ? "done" : state === "error" ? "error" : state === "busy" ? "busy" : "running";
  return `<div class="tool-indicator ${cls}">${ICONS[state] || ICONS.running}
    <code>@${escHtml(toolName)}</code> — ${LABELS[state] || state}</div>`;
}

function buildThinkingHTML() {
  return `
    <div class="ai-thinking" id="thinkingBlock">
      <div class="wave-bars">
        ${Array.from({ length: 7 }, () => `<div class="wave-bar"></div>`).join("")}
      </div>
      <div class="thinking-text-col">
        <span class="thinking-label">
          <span class="thinking-phrase" id="thinkingPhrase">${THINKING_PHRASES[0]}</span><span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
        </span>
        <div class="thinking-bar-wrap" id="thinkingBarWrap">
          <div class="thinking-bar"></div>
        </div>
      </div>
    </div>`;
}

let isStreaming = false;

async function sendMessage(prompt) {
  if (isStreaming || !prompt.trim()) return;
  isStreaming     = true;
  sendBtn.disabled = true;

  // ── User bubble
  const userDiv = document.createElement("div");
  userDiv.className = "message user";
  userDiv.innerHTML = `
    <img class="message-avatar" src="${AI_AVATAR}" alt="You">
    <div class="message-content">${escHtml(prompt).replace(/\n/g, "<br>")}</div>`;
  chatFeed.appendChild(userDiv);
  scrollToBottom();

  // ── AI bubble (thinking state)
  const aiDiv = document.createElement("div");
  aiDiv.className = "message ai";
  aiDiv.innerHTML = `
    <img class="message-avatar" src="${AI_AVATAR}" alt="AI">
    <div class="message-content">${buildThinkingHTML()}</div>`;
  chatFeed.appendChild(aiDiv);
  scrollToBottom();

  const contentEl = aiDiv.querySelector(".message-content");
  let textEl = null, cursorEl = null, rawText = "";
  const toolEls = {};
  let wordQueue = [], wordTimer = null, sseDone = false;
  let phraseIdx = 0, barWidthIdx = 0, phraseTimer = null, barSizeTimer = null;

  function startThinkingAnimators() {
    phraseTimer = setInterval(() => {
      const phraseEl = document.getElementById("thinkingPhrase");
      if (!phraseEl) { clearInterval(phraseTimer); return; }
      phraseEl.style.opacity = "0";
      setTimeout(() => {
        phraseIdx = (phraseIdx + 1) % THINKING_PHRASES.length;
        phraseEl.textContent  = THINKING_PHRASES[phraseIdx];
        phraseEl.style.opacity = "1";
      }, 300);
    }, 2600);

    barSizeTimer = setInterval(() => {
      const barWrap = document.getElementById("thinkingBarWrap");
      if (!barWrap) { clearInterval(barSizeTimer); return; }
      barWidthIdx = (barWidthIdx + 1) % BAR_WIDTHS.length;
      barWrap.style.width = BAR_WIDTHS[barWidthIdx] + "px";
    }, 1800);
  }

  function stopThinkingAnimators() {
    clearInterval(phraseTimer);
    clearInterval(barSizeTimer);
  }

  startThinkingAnimators();

  function finalizeText() {
    if (!textEl) return;
    if (cursorEl) { cursorEl.remove(); cursorEl = null; }
    textEl.innerHTML = rawText ? marked.parse(rawText) : "";
    Object.values(toolEls).forEach((t) => contentEl.appendChild(t));
    scrollToBottom();
  }

  function collapseThinking(callback) {
    const block = document.getElementById("thinkingBlock");
    if (!block) { callback(); return; }
    block.classList.add("collapsing");
    block.addEventListener("transitionend", function handler() {
      block.removeEventListener("transitionend", handler);
      block.remove();
      callback();
    }, { once: true });
    setTimeout(() => { block.remove(); callback(); }, 500);
  }

  function ensureTextEl() {
    if (!textEl) {
      stopThinkingAnimators();
      collapseThinking(() => {});
      contentEl.innerHTML = "";
      textEl    = document.createElement("div");
      cursorEl  = document.createElement("span");
      cursorEl.className = "stream-cursor";
      contentEl.appendChild(textEl);
      contentEl.appendChild(cursorEl);
    }
    return textEl;
  }

  function getToolEl(name) {
    if (!toolEls[name]) {
      toolEls[name] = document.createElement("div");
      contentEl.appendChild(toolEls[name]);
    }
    return toolEls[name];
  }

  function processQueue() {
    if (wordQueue.length === 0) {
      wordTimer = null;
      if (sseDone) finalizeText();
      return;
    }
    rawText += wordQueue.shift();
    const tEl = ensureTextEl();
    tEl.innerHTML = marked.parse(rawText);
    Object.values(toolEls).forEach((t) => contentEl.appendChild(t));
    if (cursorEl) contentEl.appendChild(cursorEl);
    scrollToBottom();
    wordTimer = setTimeout(processQueue, WORD_SPEED);
  }

  function enqueueText(text) {
    text.split(/(\s+)/).forEach((t) => { if (t) wordQueue.push(t); });
    if (!wordTimer) processQueue();
  }

  try {
    const res = await fetch(STREAM_URL, {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRFToken": CSRF_TOKEN,
      },
      body: `prompt=${encodeURIComponent(prompt)}`,
    });

    if (!res.ok) {
      stopThinkingAnimators();
      contentEl.innerHTML =
        `<span style="color:var(--err-text)">Server error ${res.status}: ${res.statusText}</span>`;
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";

      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        let ev;
        try { ev = JSON.parse(part.slice(6)); } catch { continue; }

        switch (ev.type) {
          case "chunk":
            ensureTextEl();
            enqueueText(ev.text);
            break;
          case "tool_start":
            ensureTextEl();
            getToolEl(ev.tool).innerHTML = toolIndicatorHTML(ev.tool, "running");
            scrollToBottom();
            break;
          case "tool_busy":
            ensureTextEl();
            getToolEl(ev.tool).innerHTML = toolIndicatorHTML(ev.tool, "busy");
            break;
          case "tool_done": {
            const el = toolEls[ev.tool];
            if (el) el.innerHTML = toolIndicatorHTML(ev.tool, "done");
            break;
          }
          case "tool_error":
            ensureTextEl();
            getToolEl(ev.tool).innerHTML = toolIndicatorHTML(ev.tool, "error");
            break;
          case "done":
            sseDone = true;
            if (!wordTimer) finalizeText();
            break;
        }
      }
    }

    if (!sseDone) { sseDone = true; if (!wordTimer) finalizeText(); }
    if (!textEl) {
      stopThinkingAnimators();
      contentEl.innerHTML =
        '<span style="color:var(--text-muted);font-size:0.85rem">No response.</span>';
    }

  } catch (err) {
    stopThinkingAnimators();
    contentEl.innerHTML =
      `<span style="color:var(--err-text)">Connection lost: ${escHtml(err.message)}</span>`;
  } finally {
    isStreaming      = false;
    sendBtn.disabled = false;
    scrollToBottom();
  }
}

/* ── Send handlers ──────────────────────────────────────────── */
function handleSend() {
  const text = chatInput.value.trim();
  if (!text || isStreaming) return;
  chatInput.value = "";
  chatInput.style.height = "auto";
  sendMessage(text);
}

sendBtn.addEventListener("click", handleSend);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

/* ── Init ───────────────────────────────────────────────────── */
scrollToBottom();
chatInput.focus();
