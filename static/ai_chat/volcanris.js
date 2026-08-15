/**
 * volcanris.js — VOLCANRIS AI System UI Controller & Real-Time Gemini Streaming Engine
 */

"use strict";

/* ═══════════════════════════════════════
   HYPER-OPTIMIZED VOLCANRIS CONTROLLER & SHADER
   ═══════════════════════════════════════ */
(function() {
  'use strict';

  // 1. Cached DOM Map (Zero DOM queries inside render loops)
  const dom = {
    root: document.documentElement,
    bgC: document.getElementById('bgCanvas'),
    sc: document.getElementById('sphereCanvas'),
    sphereWrap: document.getElementById('sphereWrap'),
    colorPanel: document.getElementById('colorPanel'),
    colorCard: document.getElementById('colorCard'),
    panelTrigger: document.getElementById('colorPanelTrigger'),
    colorSwatch: document.getElementById('colorSwatch'),
    sliderHue: document.getElementById('sliderHue'),
    sliderSat: document.getElementById('sliderSat'),
    sliderLit: document.getElementById('sliderLit'),
    valHue: document.getElementById('valHue'),
    valSat: document.getElementById('valSat'),
    valLit: document.getElementById('valLit'),
    btnReset: document.getElementById('btnResetColor'),
    btnSaveDefault: document.getElementById('btnSaveDefault'),
    presetRow: document.getElementById('presetRow'),
    themeToggle: document.getElementById('themeToggle'),
    uptime: document.getElementById('uptime'),
    respTime: document.getElementById('respTime'),
    conns: document.getElementById('conns'),
    neuralLoad: document.getElementById('neuralLoad'),
    halo: document.querySelector('.sphere-halo')
  };

  // 2. High-Performance Accent Cache
  let accent = { h: 138, s: 55, l: 42 };
  let hslStr = 'hsl(138, 55%, 42%)';
  let hslaStr = 'hsla(138, 55%, 42%';

  const PRESETS = [
    { h: 138, s: 55, l: 42, label: "Forest"  },
    { h: 211, s: 80, l: 42, label: "Ocean"   },
    { h: 260, s: 65, l: 52, label: "Violet"  },
    { h:   0, s: 72, l: 48, label: "Crimson" },
    { h:  28, s: 80, l: 48, label: "Amber"   },
    { h: 180, s: 60, l: 38, label: "Teal"    },
    { h: 330, s: 65, l: 48, label: "Rose"    }
  ];

  function applyAccent(h, s, l) {
    accent.h = +h; accent.s = +s; accent.l = +l;
    hslStr = `hsl(${h}, ${s}%, ${l}%)`;
    hslaStr = `hsla(${h}, ${s}%, ${l}%`;

    dom.root.style.setProperty("--accent-h", h);
    dom.root.style.setProperty("--accent-s", s + "%");
    dom.root.style.setProperty("--accent-l", l + "%");
    localStorage.setItem("volcann-accent", JSON.stringify({ h, s, l }));
    if (typeof window.saveBackendTheme === "function") {
      window.saveBackendTheme({ primary_color: hslStr, accent_h: +h, accent_s: +s, accent_l: +l });
    }

    if (dom.sliderSat) dom.sliderSat.style.background = `linear-gradient(90deg,hsl(${h},10%,50%) 0%,hsl(${h},100%,${l}%) 100%)`;
    if (dom.sliderLit) dom.sliderLit.style.background = `linear-gradient(90deg,#111 0%,hsl(${h},${s}%,50%) 50%,#fff 100%)`;

    if (dom.colorSwatch) {
      dom.colorSwatch.classList.remove("pulse");
      void dom.colorSwatch.offsetWidth;
      dom.colorSwatch.classList.add("pulse");
    }

    if (dom.sliderHue) dom.sliderHue.value = h;
    if (dom.sliderSat) dom.sliderSat.value = s;
    if (dom.sliderLit) dom.sliderLit.value = l;
    if (dom.valHue) dom.valHue.textContent = h + "°";
    if (dom.valSat) dom.valSat.textContent = s + "%";
    if (dom.valLit) dom.valLit.textContent = l + "%";

    const dots = dom.presetRow ? dom.presetRow.querySelectorAll(".preset-dot") : [];
    dots.forEach((d) =>
      d.classList.toggle("selected", +d.dataset.h === h && +d.dataset.s === s && +d.dataset.l === l)
    );
  }

  // Build Presets
  if (dom.presetRow) {
    const frag = document.createDocumentFragment();
    PRESETS.forEach((p) => {
      const dot = document.createElement("button");
      dot.className = "preset-dot";
      dot.title = p.label;
      dot.dataset.h = p.h;
      dot.dataset.s = p.s;
      dot.dataset.l = p.l;
      dot.style.background = `hsl(${p.h},${p.s}%,${p.l}%)`;
      dot.addEventListener("click", () => applyAccent(p.h, p.s, p.l), { passive: true });
      frag.appendChild(dot);
    });
    dom.presetRow.appendChild(frag);
  }

  function readSliders() {
    if (!dom.sliderHue) return;
    applyAccent(+dom.sliderHue.value, +dom.sliderSat.value, +dom.sliderLit.value);
  }

  [dom.sliderHue, dom.sliderSat, dom.sliderLit].forEach(el => {
    if (el) el.addEventListener('input', readSliders, { passive: true });
  });

  if (dom.btnSaveDefault) {
    dom.btnSaveDefault.addEventListener('click', () => {
      const h = accent.h; const s = accent.s; const l = accent.l;
      const theme = dom.root.getAttribute('data-theme') || 'dark';
      if (typeof window.saveBackendTheme === 'function') {
        window.saveBackendTheme({
          theme: theme,
          primary_color: `hsl(${h}, ${s}%, ${l}%)`,
          accent_h: h,
          accent_s: s,
          accent_l: l,
        });
      }
      const orig = dom.btnSaveDefault.textContent;
      dom.btnSaveDefault.textContent = 'Saved! ✓';
      setTimeout(() => { dom.btnSaveDefault.textContent = orig; }, 1800);
    });
  }

  if (dom.btnReset) {
    dom.btnReset.addEventListener('click', () => {
      applyAccent(138, 55, 42);
      const theme = 'dark';
      dom.root.setAttribute('data-theme', theme);
      localStorage.setItem('volcann-theme', theme);
      if (typeof window.saveBackendTheme === 'function') {
        window.saveBackendTheme({
          theme: theme,
          primary_color: 'hsl(138, 55%, 42%)',
          accent_h: 138,
          accent_s: 55,
          accent_l: 42,
        });
      }
      const orig = dom.btnReset.textContent;
      dom.btnReset.textContent = 'Reset! ✓';
      setTimeout(() => { dom.btnReset.textContent = orig; }, 1800);
    });
  }

  // Color Panel Toggle
  if (dom.panelTrigger && dom.colorCard) {
    dom.panelTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dom.colorCard.classList.toggle('open');
      dom.panelTrigger.classList.toggle('open', open);
      dom.panelTrigger.setAttribute('aria-expanded', open);
    });

    document.addEventListener('click', (e) => {
      if (dom.colorPanel && !dom.colorPanel.contains(e.target)) {
        dom.colorCard.classList.remove('open');
        dom.panelTrigger.classList.remove('open');
        dom.panelTrigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Theme Toggle
  if (dom.themeToggle) {
    dom.themeToggle.addEventListener('click', () => {
      const next = dom.root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      dom.root.setAttribute('data-theme', next);
      localStorage.setItem('volcann-theme', next);
      if (typeof window.saveBackendTheme === 'function') {
        window.saveBackendTheme({ theme: next });
      }
    });
  }

  // Initial Accent Read
  (function initAccent() {
    const cs = getComputedStyle(dom.root);
    const h = parseInt(cs.getPropertyValue("--accent-h")) || 138;
    const s = parseInt(cs.getPropertyValue("--accent-s")) || 55;
    const l = parseInt(cs.getPropertyValue("--accent-l")) || 42;
    applyAccent(h, s, l);
  })();

  // 3. Canvas Context Setup
  const bgX = dom.bgC ? dom.bgC.getContext('2d', { alpha: true }) : null;
  const sx = dom.sc ? dom.sc.getContext('2d', { alpha: true }) : null;

  let W = 0, H = 0;
  let resizePending = false;
  function resizeBg() {
    if (!dom.bgC) return;
    W = dom.bgC.width = window.innerWidth;
    H = dom.bgC.height = window.innerHeight;
    resizePending = false;
  }
  resizeBg();

  window.addEventListener('resize', () => {
    if (!resizePending) {
      resizePending = true;
      requestAnimationFrame(resizeBg);
    }
  }, { passive: true });

  // Pre-allocated Particle & Star Pools
  const STARS = Array.from({ length: 150 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 0.85 + 0.15,
    a: Math.random() * 0.45 + 0.05,
    sp: Math.random() * 0.015 + 0.003,
    ph: Math.random() * Math.PI * 2
  }));

  function createParticle() {
    return {
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00028,
      vy: (Math.random() - 0.5) * 0.00028,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random() * 0.28 + 0.04,
      life: Math.random() * 500 + 200,
      age: Math.floor(Math.random() * 400)
    };
  }
  const PARTS = Array.from({ length: 45 }, createParticle);

  // Sphere Nodes & Tendrils
  const SW = 300, SH = 300, CX = 150, CY = 150, RADIUS = 120;

  const RIM_NODES = Array.from({ length: 20 }, (_, i) => ({
    angle: (i / 20) * Math.PI * 2,
    speed: (Math.random() * 0.008 + 0.004) * (i % 2 === 0 ? 1 : -1),
    size: Math.random() * 2.0 + 1.2,
    distOffset: (Math.random() - 0.5) * 6,
    alpha: Math.random() * 0.55 + 0.35
  }));

  const TENDILS = Array.from({ length: 10 }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: (Math.random() * 0.014 + 0.006) * (Math.random() < 0.5 ? 1 : -1),
    length: Math.random() * 0.7 + 0.3,
    radiusOffset: (Math.random() - 0.5) * 10,
    width: Math.random() * 1.8 + 1.0
  }));

  // ── Spider Web geometry (always visible, brighter while listening)
  const WEB_SPOKES   = 12;   // radial spokes
  const WEB_RINGS    = 5;    // concentric web rings
  const WEB_INNER_R  = RADIUS + 18;  // innermost web ring radius
  const WEB_OUTER_R  = RADIUS + 82;  // outermost web ring radius
  let webRotation    = 0;    // continuously increments
  let webRotation2   = 0;    // second layer, counter-rotate

  // 4. Batched Rendering Pipelines
  function renderBackground(t) {
    if (!bgX) return;
    bgX.clearRect(0, 0, W, H);

    const { h, s, l } = accent;
    const lGlow = Math.min(90, l + 30);

    // Batched Stars (Single Path + Fill)
    bgX.beginPath();
    for (let i = 0; i < STARS.length; i++) {
      const st = STARS[i];
      const stAlpha = st.a * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
      if (stAlpha > 0.02) {
        const sxPos = st.x * W, syPos = st.y * H;
        bgX.moveTo(sxPos + st.r, syPos);
        bgX.arc(sxPos, syPos, st.r, 0, Math.PI * 2);
      }
    }
    bgX.fillStyle = `hsla(${h}, ${s}%, ${lGlow}%, 0.35)`;
    bgX.fill();

    // Concentric Pulse Rings
    const halfW = W * 0.5, halfH = H * 0.5;
    for (let i = 1; i <= 4; i++) {
      const r = i * 130;
      const p = 0.02 * (0.5 + 0.5 * Math.sin(t * 0.007 + i * 1.1));
      bgX.beginPath();
      bgX.arc(halfW, halfH, r, 0, Math.PI * 2);
      bgX.strokeStyle = `${hslaStr}, ${p})`;
      bgX.lineWidth = 0.6;
      bgX.stroke();
    }

    // Slow Expanding Center Pulse
    const pulse = (t * 0.4) % 400;
    const pAlpha = Math.max(0, 0.12 * (1 - pulse / 400));
    bgX.beginPath();
    bgX.arc(halfW, halfH, pulse * 0.6, 0, Math.PI * 2);
    bgX.strokeStyle = `${hslaStr}, ${pAlpha})`;
    bgX.lineWidth = 1.4;
    bgX.stroke();

    // Particles + Batched Distance Connections
    bgX.beginPath();
    for (let i = 0; i < PARTS.length; i++) {
      const p = PARTS[i];
      p.age++;
      if (p.age > p.life) {
        Object.assign(p, createParticle());
        continue;
      }
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
        p.x = Math.random(); p.y = Math.random();
      }
      const pxPos = p.x * W, pyPos = p.y * H;
      bgX.moveTo(pxPos + p.r, pyPos);
      bgX.arc(pxPos, pyPos, p.r, 0, Math.PI * 2);
    }
    bgX.fillStyle = `${hslaStr}, 0.25)`;
    bgX.fill();

    // Batched Connection Lines (1 stroke call)
    const maxDistSq = 110 * 110;
    bgX.beginPath();
    let drawLines = false;
    for (let i = 0; i < PARTS.length; i++) {
      const p1 = PARTS[i];
      const p1x = p1.x * W, p1y = p1.y * H;
      for (let j = i + 1; j < PARTS.length; j++) {
        const p2 = PARTS[j];
        const dx = p1x - p2.x * W;
        const dy = p1y - p2.y * H;
        const dSq = dx * dx + dy * dy;
        if (dSq < maxDistSq) {
          bgX.moveTo(p1x, p1y);
          bgX.lineTo(p2.x * W, p2.y * H);
          drawLines = true;
        }
      }
    }
    if (drawLines) {
      bgX.strokeStyle = `${hslaStr}, 0.06)`;
      bgX.lineWidth = 0.4;
      bgX.stroke();
    }
  }

  function renderHollowSphere(t) {
    if (!sx) return;
    sx.clearRect(0, 0, SW, SH);

    const { h, s, l } = accent;

    // 1. Hollow Interior Edge Atmosphere
    const innerGlow = sx.createRadialGradient(CX, CY, RADIUS * 0.4, CX, CY, RADIUS);
    innerGlow.addColorStop(0, 'rgba(0,0,0,0)');
    innerGlow.addColorStop(0.65, `${hslaStr}, 0.02)`);
    innerGlow.addColorStop(0.88, `${hslaStr}, 0.12)`);
    innerGlow.addColorStop(1, `hsla(${h}, ${s}%, ${Math.min(95, l + 25)}%, 0.35)`);

    sx.beginPath();
    sx.arc(CX, CY, RADIUS, 0, Math.PI * 2);
    sx.fillStyle = innerGlow;
    sx.fill();

    // 2. Refraction Depth Ring
    const pulseR = RADIUS * 0.84 + Math.sin(t * 0.03) * 2.5;
    sx.beginPath();
    sx.arc(CX, CY, pulseR, 0, Math.PI * 2);
    sx.strokeStyle = `${hslaStr}, ${0.16 + 0.05 * Math.sin(t * 0.04)})`;
    sx.lineWidth = 1.2;
    sx.stroke();

    // 3. Rotating Rim Tendrils
    for (let i = 0; i < TENDILS.length; i++) {
      const td = TENDILS[i];
      td.angle += td.speed;
      const r = RADIUS + td.radiusOffset + Math.sin(t * 0.02 + td.angle) * 3;
      const startA = td.angle;
      const endA = startA + td.length;

      sx.beginPath();
      sx.arc(CX, CY, r, startA, endA);
      sx.strokeStyle = `hsla(${h}, ${s}%, ${Math.min(95, l + 25)}%, 0.5)`;
      sx.lineWidth = td.width;
      sx.lineCap = 'round';
      sx.stroke();
    }

    // 4. Outer Glass Neon Rim
    sx.beginPath();
    sx.arc(CX, CY, RADIUS, 0, Math.PI * 2);
    sx.strokeStyle = `hsla(${h}, ${s}%, ${Math.min(95, l + 20)}%, 0.7)`;
    sx.lineWidth = 2;
    sx.stroke();

    // 5. Orbiting Energy Nodes
    for (let i = 0; i < RIM_NODES.length; i++) {
      const nd = RIM_NODES[i];
      nd.angle += nd.speed;
      const nr = RADIUS + nd.distOffset + Math.sin(t * 0.05 + nd.angle * 2) * 2;
      const nx = CX + Math.cos(nd.angle) * nr;
      const ny = CY + Math.sin(nd.angle) * nr;
      const pulseA = nd.alpha * (0.6 + 0.4 * Math.sin(t * 0.08 + nd.angle));

      sx.beginPath();
      sx.arc(nx, ny, nd.size, 0, Math.PI * 2);
      sx.fillStyle = `hsla(${h}, ${s}%, ${Math.min(95, l + 30)}%, ${pulseA})`;
      sx.fill();
    }

    // 6. Holographic Arc Sweeps
    for (let i = 0; i < 3; i++) {
      const sweepSpeed = 0.012 * (i + 1) * (i % 2 === 0 ? 1 : -1);
      const angleStart = t * sweepSpeed + (i * Math.PI * 2) / 3;
      const arcLen = Math.PI * 0.35;
      sx.beginPath();
      sx.arc(CX, CY, RADIUS - 5 + i * 4, angleStart, angleStart + arcLen);
      sx.strokeStyle = `hsla(${h}, ${s}%, ${Math.min(95, l + 35)}%, ${0.35 - i * 0.08})`;
      sx.lineWidth = 1.5;
      sx.stroke();
    }

    // 7. Specular Sheen Reflection Arc
    const sheenGrad = sx.createLinearGradient(CX - RADIUS, CY - RADIUS, CX, CY);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    sheenGrad.addColorStop(0.3, `hsla(${h}, ${s}%, 90%, 0.15)`);
    sheenGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0)');

    sx.beginPath();
    sx.arc(CX, CY, RADIUS - 1.5, -Math.PI * 0.85, -Math.PI * 0.15);
    sx.strokeStyle = sheenGrad;
    sx.lineWidth = 3;
    sx.stroke();

  }

  // ── Spider Web Renderer — drawn on the sphere canvas every frame
  function renderSpiderWeb(t) {
    if (!sx) return;
    const { h, s, l } = accent;
    const isL = !!window.__volcanrisIsListening;

    // Spin speeds: listening = fast + dramatic, idle = slow & subtle
    webRotation  += isL ? 0.018 : 0.004;
    webRotation2 += isL ? -0.011 : -0.002;

    const baseAlpha   = isL ? 0.82 : 0.28;
    const strandAlpha = isL ? 0.55 : 0.13;
    const nodeSize    = isL ? 3.5  : 1.8;
    const lineW       = isL ? 1.4  : 0.7;
    const lBright     = Math.min(95, l + (isL ? 45 : 18));

    // ── Layer 1: Primary web (rotates forward)
    sx.save();
    sx.translate(CX, CY);
    sx.rotate(webRotation);

    // Concentric web rings
    for (let r = 0; r < WEB_RINGS; r++) {
      const t01 = r / (WEB_RINGS - 1);
      const ringR = WEB_INNER_R + t01 * (WEB_OUTER_R - WEB_INNER_R);
      const ringAlpha = baseAlpha * (1 - t01 * 0.45);

      // Pulse breathing per ring
      const breathe = isL ? Math.sin(t * 0.08 + r * 1.1) * 4 : Math.sin(t * 0.025 + r * 0.9) * 1.5;
      const rFinal = ringR + breathe;

      sx.beginPath();
      sx.arc(0, 0, rFinal, 0, Math.PI * 2);
      sx.strokeStyle = `hsla(${h}, ${s}%, ${lBright}%, ${ringAlpha})`;
      sx.lineWidth = isL ? (1.8 - t01 * 0.7) : (0.8 - t01 * 0.3);
      sx.stroke();
    }

    // Radial spokes from inner to outer ring
    for (let s2 = 0; s2 < WEB_SPOKES; s2++) {
      const angle = (s2 / WEB_SPOKES) * Math.PI * 2;
      const spokeAlpha = baseAlpha * (0.7 + 0.3 * Math.sin(t * 0.06 + s2 * 0.55));

      sx.beginPath();
      sx.moveTo(
        Math.cos(angle) * WEB_INNER_R,
        Math.sin(angle) * WEB_INNER_R
      );
      sx.lineTo(
        Math.cos(angle) * WEB_OUTER_R,
        Math.sin(angle) * WEB_OUTER_R
      );
      sx.strokeStyle = `hsla(${h}, ${s}%, ${lBright}%, ${spokeAlpha})`;
      sx.lineWidth = lineW;
      sx.stroke();
    }

    // Cross-strand silk threads between adjacent spokes (the web "silk")
    for (let r = 0; r < WEB_RINGS - 1; r++) {
      const t01  = r / (WEB_RINGS - 1);
      const t01b = (r + 1) / (WEB_RINGS - 1);
      const rA   = WEB_INNER_R + t01  * (WEB_OUTER_R - WEB_INNER_R);
      const rB   = WEB_INNER_R + t01b * (WEB_OUTER_R - WEB_INNER_R);

      for (let s2 = 0; s2 < WEB_SPOKES; s2++) {
        const a1 = (s2 / WEB_SPOKES) * Math.PI * 2;
        const a2 = ((s2 + 1) / WEB_SPOKES) * Math.PI * 2;

        // Zigzag silk: inner-left → outer-right cross-thread
        const x1a = Math.cos(a1) * rA, y1a = Math.sin(a1) * rA;
        const x2b = Math.cos(a2) * rB, y2b = Math.sin(a2) * rB;

        sx.beginPath();
        sx.moveTo(x1a, y1a);
        sx.lineTo(x2b, y2b);
        sx.strokeStyle = `hsla(${h}, ${s}%, ${lBright}%, ${strandAlpha})`;
        sx.lineWidth = lineW * 0.6;
        sx.stroke();
      }
    }

    // Intersection node glows at each spoke × ring crossover
    for (let r = 0; r < WEB_RINGS; r++) {
      const t01  = r / (WEB_RINGS - 1);
      const ringR = WEB_INNER_R + t01 * (WEB_OUTER_R - WEB_INNER_R);
      const breathe = isL ? Math.sin(t * 0.08 + r * 1.1) * 4 : Math.sin(t * 0.025 + r * 0.9) * 1.5;
      const rFinal = ringR + breathe;

      for (let s2 = 0; s2 < WEB_SPOKES; s2++) {
        const angle = (s2 / WEB_SPOKES) * Math.PI * 2;
        const nx = Math.cos(angle) * rFinal;
        const ny = Math.sin(angle) * rFinal;
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.12 + s2 * 0.8 + r * 1.3);
        const nAlpha = baseAlpha * pulse;

        sx.beginPath();
        sx.arc(nx, ny, nodeSize * pulse, 0, Math.PI * 2);
        sx.fillStyle = `hsla(${h}, ${s}%, ${lBright}%, ${nAlpha})`;
        sx.shadowBlur = isL ? 12 : 5;
        sx.shadowColor = `hsla(${h}, ${s}%, ${lBright}%, 0.9)`;
        sx.fill();
        sx.shadowBlur = 0;
      }
    }

    sx.restore();

    // ── Layer 2: Counter-rotating offset web (larger, more translucent)
    sx.save();
    sx.translate(CX, CY);
    sx.rotate(webRotation2);

    const SPOKES2  = 8;
    const RINGS2   = 3;
    const INNER2   = WEB_INNER_R + 12;
    const OUTER2   = WEB_OUTER_R + 14;
    const alpha2   = baseAlpha * 0.45;

    for (let r = 0; r < RINGS2; r++) {
      const t01  = r / (RINGS2 - 1);
      const ringR = INNER2 + t01 * (OUTER2 - INNER2);
      sx.beginPath();
      sx.arc(0, 0, ringR, 0, Math.PI * 2);
      sx.strokeStyle = `hsla(${h}, ${s}%, ${lBright}%, ${alpha2 * (1 - t01 * 0.5)})`;
      sx.lineWidth = lineW * 0.55;
      sx.stroke();
    }

    for (let s2 = 0; s2 < SPOKES2; s2++) {
      const angle = (s2 / SPOKES2) * Math.PI * 2;
      sx.beginPath();
      sx.moveTo(Math.cos(angle) * INNER2, Math.sin(angle) * INNER2);
      sx.lineTo(Math.cos(angle) * OUTER2, Math.sin(angle) * OUTER2);
      sx.strokeStyle = `hsla(${h}, ${s}%, ${lBright}%, ${alpha2 * 0.7})`;
      sx.lineWidth = lineW * 0.5;
      sx.stroke();
    }

    // Silk threads on layer 2
    for (let r = 0; r < RINGS2 - 1; r++) {
      const t01 = r / (RINGS2 - 1), t01b = (r + 1) / (RINGS2 - 1);
      const rA = INNER2 + t01 * (OUTER2 - INNER2);
      const rB = INNER2 + t01b * (OUTER2 - INNER2);
      for (let s2 = 0; s2 < SPOKES2; s2++) {
        const a1 = (s2 / SPOKES2) * Math.PI * 2;
        const a2 = ((s2 + 1) / SPOKES2) * Math.PI * 2;
        sx.beginPath();
        sx.moveTo(Math.cos(a1) * rA, Math.sin(a1) * rA);
        sx.lineTo(Math.cos(a2) * rB, Math.sin(a2) * rB);
        sx.strokeStyle = `hsla(${h}, ${s}%, ${lBright}%, ${alpha2 * 0.5})`;
        sx.lineWidth = lineW * 0.4;
        sx.stroke();
      }
    }

    sx.restore();
  }

  // 5. Unified Main Animation Loop with Visibility Pause
  let frameTicks = 0;
  let isPageVisible = !document.hidden;

  document.addEventListener('visibilitychange', () => {
    const wasVisible = isPageVisible;
    isPageVisible = !document.hidden;
    if (!wasVisible && isPageVisible) {
      requestAnimationFrame(mainLoop);
    }
  }, { passive: true });

  function mainLoop() {
    if (!isPageVisible) return;
    frameTicks++;

    renderBackground(frameTicks);
    renderHollowSphere(frameTicks);
    renderSpiderWeb(frameTicks);

    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);

  // 6. Interactive Sphere Ripple
  if (dom.sphereWrap) {
    dom.sphereWrap.addEventListener('click', function() {
      this.style.transition = 'transform 0.15s ease';
      this.style.transform = 'scale(0.93)';
      setTimeout(() => {
        this.style.transform = 'scale(1.1)';
        setTimeout(() => {
          this.style.transition = 'transform 0.4s cubic-bezier(0.16,1,0.3,1)';
          this.style.transform = '';
        }, 150);
      }, 150);

      if (dom.halo) {
        dom.halo.style.transition = 'box-shadow 0.2s ease';
        dom.halo.style.boxShadow = '0 0 100px 50px var(--gh-green-glow),0 0 200px 100px var(--gh-green-glow)';
        setTimeout(() => {
          if (dom.halo) {
            dom.halo.style.transition = 'box-shadow 0.8s ease';
            dom.halo.style.boxShadow = '';
          }
        }, 250);
      }
    }, { passive: true });
  }

  // 7. Efficient Live Status Counter Updates (Every 1s)
  const startTime = Date.now();
  const pad2 = n => String(n).padStart(2, '0');
  setInterval(() => {
    const e = Math.floor((Date.now() - startTime) / 1000);
    if (dom.uptime) dom.uptime.textContent = `${pad2(Math.floor(e / 3600))}:${pad2(Math.floor((e % 3600) / 60))}:${pad2(e % 60)}`;
    if (dom.respTime) dom.respTime.textContent = (2.4 + Math.random() * 1.4).toFixed(1) + ' ms';
    if (dom.conns) dom.conns.textContent = (4800 + Math.floor(Math.random() * 120)).toLocaleString();
    if (dom.neuralLoad) dom.neuralLoad.textContent = (84 + Math.random() * 6).toFixed(1) + '%';
  }, 1000);

  // 8. Profile Modal Handler
  const pModal = document.getElementById('profileModal');
  const pBackdrop = document.getElementById('profileModalBackdrop');
  const pCloseBtn = document.getElementById('closeProfileModal');
  const pOpenBtn = document.getElementById('openProfileBtnVolcanris');

  function openProfileModal() {
    if (pModal) {
      pModal.classList.add('active');
      pModal.setAttribute('aria-hidden', 'false');
    }
  }
  function closeProfileModal() {
    if (pModal) {
      pModal.classList.remove('active');
      pModal.setAttribute('aria-hidden', 'true');
    }
  }

  if (pOpenBtn) pOpenBtn.addEventListener('click', openProfileModal);
  if (pCloseBtn) pCloseBtn.addEventListener('click', closeProfileModal);
  if (pBackdrop) pBackdrop.addEventListener('click', closeProfileModal);

})();

/* ═══════════════════════════════════════════
   REAL-TIME VOLCANRIS GEMINI STREAMING ENGINE
   SSE fetch + ReadableStream · Zero delay
   ═══════════════════════════════════════════ */
(function() {
  'use strict';

  /* ── DOM refs ── */
  const chatLog         = document.getElementById('volcanrisChatLog');
  const statusLabel     = document.getElementById('volcanrisStatusLabel');
  const streamStatus    = document.getElementById('streamingStatus');
  const sessionSelect   = document.getElementById('sessionSelect');
  const volcanrisWave      = document.getElementById('volcanrisWave');
  const sphereWrap      = document.getElementById('sphereWrap');
  const tapHint         = document.getElementById('tapHint');
  const thinkingBubble  = document.getElementById('volcanrisThinking');
  const thinkRing1      = document.getElementById('sphereThinkRing1');
  const thinkRing2      = document.getElementById('sphereThinkRing2');
  const listenPulse     = document.getElementById('sphereListenPulse');
  const listenPulse2    = document.getElementById('sphereListenPulse2');
  const listenRadar     = document.getElementById('sphereListenRadar');
  const listenRing1     = document.getElementById('sphereListenRing1');
  const listenRing2     = document.getElementById('sphereListenRing2');
  const orbitSystem     = document.getElementById('orbitSystem');

  function setListeningState(active) {
    window.__volcanrisIsListening = !!active;
    if (listenPulse) listenPulse.classList.toggle('active', active);
    if (listenPulse2) listenPulse2.classList.toggle('active', active);
    if (listenRadar) listenRadar.classList.toggle('active', active);
    if (listenRing1) listenRing1.classList.toggle('active', active);
    if (listenRing2) listenRing2.classList.toggle('active', active);
    if (orbitSystem) orbitSystem.classList.toggle('is-listening', active);
    if (sphereWrap) sphereWrap.classList.toggle('listening', active);
  }

  const config          = window.VOLCANRIS_CONFIG || {};

  /* ── Session id from Django data attribute ── */
  let currentSessionId = sessionSelect ? sessionSelect.value : (document.body.dataset.sessionId || '');

  /* ── Session switch: reload with ?session_id=... ── */
  if (sessionSelect) {
    sessionSelect.addEventListener('change', () => {
      window.location.href = '?session_id=' + sessionSelect.value;
    });
  }

  /* ── Helper: render Markdown ── */
  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  function renderMarkdown(text) {
    if (!text) return '';
    if (window.marked) {
      try {
        return marked.parse(text);
      } catch (e) {
        console.warn('Markdown parsing error:', e);
      }
    }
    return text;
  }

  /* ── Helper: append bubble to chat log ── */
  function appendBubble(role, content) {
    const placeholder = chatLog.querySelector('[data-placeholder]');
    if (placeholder) placeholder.remove();

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${role === 'user' ? 'msg-user' : 'msg-volcanris'}`;

    if (role === 'user') {
      const author = document.createElement('div');
      author.className = 'msg-user-author';
      author.textContent = 'YOU';
      bubble.appendChild(author);
    } else {
      const author = document.createElement('div');
      author.className = 'msg-volcanris-author';
      author.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg> VOLCANRIS`;
      bubble.appendChild(author);
    }

    const text = document.createElement('div');
    text.className = 'msg-text';
    if (role === 'user') {
      text.textContent = content || '';
    } else {
      text.innerHTML = renderMarkdown(content || '');
    }
    bubble.appendChild(text);

    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return text;
  }

  /* ── Set HUD status ── */
  function setStatus(label, statusText) {
    if (statusLabel) statusLabel.textContent = label;
    if (streamStatus) streamStatus.textContent = statusText;
  }

  /* ── Wave animation: active when streaming ── */
  function setWaveActive(active) {
    if (volcanrisWave) volcanrisWave.style.opacity = active ? '1' : '';
  }

  /* ── Thinking animation: show while waiting for first token ── */
  function setThinking(active) {
    if (thinkingBubble) {
      if (active) {
        chatLog.appendChild(thinkingBubble);
      }
      thinkingBubble.classList.toggle('active', active);
      if (active) chatLog.scrollTop = chatLog.scrollHeight;
    }
    if (thinkRing1) thinkRing1.classList.toggle('active', active);
    if (thinkRing2) thinkRing2.classList.toggle('active', active);
  }

  class VolcanrisAudioStreamer {
    constructor() {
      this.queue = [];
      this.isPlaying = false;
      this.currentAudio = null;
      this.sentenceBuffer = '';
      this.charsSinceLastFlush = 0;
      this.unlocked = false;
      this.audioCtx = null;
      this.streamingDone = false;
    }

    unlockAudio() {
      if (this.unlocked) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          if (!this.audioCtx) this.audioCtx = new AudioContext();
          if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        }
        const dummy = new Audio();
        dummy.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        dummy.play().catch(() => {});
        this.unlocked = true;
      } catch (e) {}
    }

    reset() {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      this.queue = [];
      this.isPlaying = false;
      this.sentenceBuffer = '';
      this.charsSinceLastFlush = 0;
      this.streamingDone = false;
    }

    pushToken(token) {
      this.sentenceBuffer += token;
      this.charsSinceLastFlush += token.length;

      const hardBoundary = /([^.!?\n]+[.!?\n]+)/g;
      const softBoundary = /([^,;:\n]{25,}[,;:])/g;

      let match;
      let lastIndex = 0;

      hardBoundary.lastIndex = 0;
      while ((match = hardBoundary.exec(this.sentenceBuffer)) !== null) {
        const sentence = match[1].trim();
        if (sentence.length > 1) {
          this.fetchAndQueueSentence(sentence);
        }
        lastIndex = hardBoundary.lastIndex;
      }

      if (lastIndex > 0) {
        this.sentenceBuffer = this.sentenceBuffer.slice(lastIndex);
        this.charsSinceLastFlush = this.sentenceBuffer.length;
        lastIndex = 0;
      }

      if (this.sentenceBuffer.length >= 25) {
        softBoundary.lastIndex = 0;
        while ((match = softBoundary.exec(this.sentenceBuffer)) !== null) {
          const clause = match[1].trim();
          if (clause.length > 1) {
            this.fetchAndQueueSentence(clause);
          }
          lastIndex = softBoundary.lastIndex;
        }
        if (lastIndex > 0) {
          this.sentenceBuffer = this.sentenceBuffer.slice(lastIndex);
          this.charsSinceLastFlush = this.sentenceBuffer.length;
        }
      }

      if (this.charsSinceLastFlush >= 40) {
        const chunk = this.sentenceBuffer.trim();
        if (chunk.length > 1) {
          this.fetchAndQueueSentence(chunk);
          this.sentenceBuffer = '';
          this.charsSinceLastFlush = 0;
        }
      }
    }

    flush() {
      const sentence = this.sentenceBuffer.trim();
      if (sentence.length > 0) {
        this.fetchAndQueueSentence(sentence);
        this.sentenceBuffer = '';
        this.charsSinceLastFlush = 0;
      }
      this.streamingDone = true;
    }

    fetchAndQueueSentence(text, onEnd) {
      const cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*_#~>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();

      if (!cleanText || cleanText.length < 2) {
        if (onEnd) onEnd();
        return;
      }

      if ('speechSynthesis' in window) {
        this.queue.push({ text: cleanText, onEnd });
        this.processQueue();
      } else if (onEnd) {
        onEnd();
      }
    }

    processQueue() {
      if (this.isPlaying) return;

      while (this.queue.length > 0 && this.queue[0] == null) {
        this.queue.shift();
      }

      if (this.queue.length === 0) {
        if (this.streamingDone) {
          setWaveActive(false);
          setStatus('Online · Ready', '');
        }
        return;
      }

      const item = this.queue.shift();
      if (!item) return;

      this.isPlaying = true;

      if (!('speechSynthesis' in window)) {
        this.isPlaying = false;
        if (item.onEnd) item.onEnd();
        this.processQueue();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(item.text);
      const voices = window.speechSynthesis.getVoices();

      const maleKeywords = ['male', 'david', 'daniel', 'george', 'guy', 'alex', 'james', 'richard', 'john', 'oliver', 'ryan', 'stephen', 'thomas', 'brian', 'arthur', 'adam'];
      const femaleKeywords = ['female', 'zira', 'hazel', 'susan', 'victoria', 'caren', 'samantha', 'karen', 'fiona', 'veena', 'moira', 'jenny', 'aria', 'natasha'];

      const preferVoice = voices.find(v => v.lang.startsWith('en') && maleKeywords.some(k => v.name.toLowerCase().includes(k)))
        || voices.find(v => v.lang.startsWith('en') && !femaleKeywords.some(k => v.name.toLowerCase().includes(k)))
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];

      if (preferVoice) utterance.voice = preferVoice;
      utterance.rate = 1.0;
      utterance.pitch = 0.92;

      utterance.onstart = () => {
        setWaveActive(true);
        setStatus('VOLCANRIS Speaking…', 'Live');
      };
      utterance.onend = () => {
        this.isPlaying = false;
        if (item.onEnd) item.onEnd();
        this.processQueue();
      };
      utterance.onerror = (e) => {
        console.warn('WebSpeech error:', e);
        this.isPlaying = false;
        if (item.onEnd) item.onEnd();
        this.processQueue();
      };

      window.speechSynthesis.speak(utterance);
    }
  }

  const audioStreamer = new VolcanrisAudioStreamer();

  function speakText(text, onEnd) {
    audioStreamer.reset();
    audioStreamer.fetchAndQueueSentence(text, onEnd);
  }

  /* ── CSRF token ── */
  function getCsrf() {
    const el = document.querySelector('[name=csrfmiddlewaretoken]');
    return el ? el.value : '';
  }

  /* ── Tool call indicator in the chat log ── */
  function appendToolIndicator(toolName, done) {
    let indicator = chatLog.querySelector(`[data-tool="${toolName}"]`);
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.dataset.tool = toolName;
      indicator.style.cssText = 'font-family:Orbitron,monospace;font-size:9px;letter-spacing:0.12em;color:var(--gh-green);padding:4px 8px;opacity:0.8;display:flex;align-items:center;gap:6px;';
      chatLog.appendChild(indicator);
    }
    indicator.innerHTML = done
      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> TOOL: ${toolName} ✓`
      : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Running: ${toolName}…`;

    if (thinkingBubble && thinkingBubble.classList.contains('active')) {
      chatLog.appendChild(thinkingBubble);
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  /* ══════════════════════════════════════════
     CORE: Send prompt → stream SSE response
     ══════════════════════════════════════════ */
  let isBusy = false;
  async function sendMessage(prompt) {
    if (!prompt || !currentSessionId || isBusy) return;
    isBusy = true;

    audioStreamer.reset();
    setStatus('Thinking…', '⚙');
    setWaveActive(true);

    appendBubble('user', prompt);
    setThinking(true);

    let volcanrisTextNode = null;
    let fullResponse = '';
    let firstChunk = true;

    try {
      const pattern = config.streamUrlPattern || '/chat/api/stream/00000000-0000-0000-0000-000000000000/';
      const streamUrl = pattern.replace('00000000-0000-0000-0000-000000000000', currentSessionId);

      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('csrfmiddlewaretoken', getCsrf());

      const response = await fetch(streamUrl, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'text/event-stream' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'chunk') {
              if (firstChunk) {
                firstChunk = false;
                setThinking(false);
                volcanrisTextNode = appendBubble('volcanris', '');
              }
              fullResponse += event.text;
              volcanrisTextNode.innerHTML = renderMarkdown(fullResponse);
              chatLog.scrollTop = chatLog.scrollHeight;
              setStatus('VOLCANRIS Speaking…', 'Live');

              audioStreamer.pushToken(event.text);

            } else if (event.type === 'tool_start') {
              appendToolIndicator(event.tool, false);
              setStatus(`Tool: ${event.tool}`, 'Running');

            } else if (event.type === 'tool_done') {
              appendToolIndicator(event.tool, true);
              setStatus('Thinking…', '⚙');

            } else if (event.type === 'tool_error') {
              appendToolIndicator(event.tool, true);

            } else if (event.type === 'done') {
              setThinking(false);
              audioStreamer.flush(); // marks streamingDone = true; status reset deferred to queue drain
              break;
            }
          } catch (e) { /* skip */ }
        }
      }
    } catch (err) {
      setThinking(false);
      if (firstChunk) {
        volcanrisTextNode = appendBubble('volcanris', '');
      }
      if (volcanrisTextNode) volcanrisTextNode.textContent = `⚠ Connection error: ${err.message}`;
      setStatus('Error · Reconnecting', '');
      setWaveActive(false);
    } finally {
      isBusy = false;
    }
  }

  /* ══════════════════════════════════════════
     SPHERE TAP → GREET → LISTEN → RESPOND
     ══════════════════════════════════════════ */
  let recognition = null;
  let isListening = false;
  let greetedOnce = false;

  function startListening() {
    if (!recognition) return;
    if (isListening) return;
    isListening = true;
    setListeningState(true);
    setStatus('Listening…', '🎙');
    if (tapHint) tapHint.textContent = '🎙 Listening… tap orb to cancel';
    recognition.start();
  }

  function stopListening() {
    if (!recognition || !isListening) return;
    recognition.stop();
    isListening = false;
    setListeningState(false);
  }

  function greetAndListen() {
    if (isListening) { stopListening(); return; }
    if (!greetedOnce) {
      greetedOnce = true;
      speakText('Hi Volcani, how can I help you?', () => startListening());
    } else {
      startListening();
    }
  }

  /* ── 1-Time Auto Greeting on Page Load ── */
  let autoGreeted = false;
  (function autoGreetOnFirstOpen() {
    const storageKey = 'volcanris_auto_greeted_' + (currentSessionId || 'default');
    if (!sessionStorage.getItem(storageKey)) {
      const triggerGreeting = () => {
        if (autoGreeted) return;
        autoGreeted = true;
        sessionStorage.setItem(storageKey, 'true');
        greetedOnce = true;
        audioStreamer.unlockAudio();
        speakText('Hi Volcani, how can I help you?');
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(triggerGreeting, 400);
      } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(triggerGreeting, 400));
      }

      const userGestureHandler = () => {
        if (!autoGreeted) {
          triggerGreeting();
        }
        window.removeEventListener('click', userGestureHandler);
        window.removeEventListener('keydown', userGestureHandler);
        window.removeEventListener('touchstart', userGestureHandler);
      };
      window.addEventListener('click', userGestureHandler, { passive: true });
      window.addEventListener('keydown', userGestureHandler, { passive: true });
      window.addEventListener('touchstart', userGestureHandler, { passive: true });
    }
  })();

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let silenceTimer = null;
    const SILENCE_MS = 2000;

    function submitTranscript(text) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
      recognition.stop();
      isListening = false;
      setListeningState(false);
      setStatus('Processing…', '⚡');
      if (tapHint) tapHint.textContent = '▲ Tap the orb to speak';
      const prompt = text.trim();
      if (prompt) sendMessage(prompt);
    }

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
        .trim();

      setStatus('Heard: ' + transcript, '🎙');
      if (tapHint) tapHint.textContent = '🎙 Listening… (keep speaking)';

      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (transcript) submitTranscript(transcript);
      }, SILENCE_MS);
    };

    recognition.onerror = (ev) => {
      clearTimeout(silenceTimer);
      silenceTimer = null;
      isListening = false;
      setListeningState(false);
      setStatus('Online · Ready', '');
      if (tapHint) tapHint.textContent = '▲ Tap the orb to speak';
    };

    recognition.onend = () => {
      clearTimeout(silenceTimer);
      silenceTimer = null;
      if (isListening) {
        isListening = false;
        setListeningState(false);
        setStatus('Online · Ready', '');
        if (tapHint) tapHint.textContent = '▲ Tap the orb to speak';
      }
    };

    if (sphereWrap) {
      sphereWrap.addEventListener('click', () => {
        audioStreamer.unlockAudio();
        greetAndListen();
      });
    }

    if (tapHint) tapHint.style.cursor = 'pointer';
    if (tapHint) {
      tapHint.addEventListener('click', () => {
        audioStreamer.unlockAudio();
        greetAndListen();
      });
    }

    window.addEventListener('click', () => audioStreamer.unlockAudio(), { passive: true });
    window.addEventListener('keydown', () => audioStreamer.unlockAudio(), { passive: true });

  } else {
    if (tapHint) tapHint.textContent = 'Voice not supported — use a modern browser';
  }

  /* ── Auto-scroll to bottom and parse history markdown on load ── */
  document.querySelectorAll('.msg-volcanris .msg-text').forEach(el => {
    el.innerHTML = renderMarkdown(el.textContent.trim());
  });
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;

  /* ── Pre-load TTS voices ── */
  if (window.speechSynthesis) window.speechSynthesis.getVoices();

})();
