import { FRAGMENT_SHADER, VERTEX_SHADER } from "./orb-shaders";
import { audioEnvelope, clamp, damp, type OrbSignal, type OrbState } from "./orb-model";

export interface OrbRenderOptions {
  state: OrbState;
  theme: number;
  signal?: { readonly current: OrbSignal };
}
export interface OrbRenderer {
  update: (options: OrbRenderOptions) => void;
  dispose: () => void;
}

/** Owns one GPU program and one frame loop per mounted canvas. */
export function createOrbRenderer(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  initial: OrbRenderOptions,
  bars?: HTMLElement | null,
): OrbRenderer {
  let options = initial;
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  const shaders: WebGLShader[] = [];
  let uniforms: Record<string, WebGLUniformLocation | null> = {};
  let disposed = false;
  let lost = false;
  let visible = true;
  let frame = 0;
  let lastTime = 0;
  let time = 0;
  let audio = 0;
  let word = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let rotX = 0;
  let rotY = 0;
  let velX = 0;
  let velY = 0;
  let hasPointer = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastMoveTime = 0;
  const activity = [0, 0, 0];
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches;
  const barNodes = bars ? Array.from(bars.children) as HTMLElement[] : [];

  const fallback = () => { host.dataset.renderer = "fallback"; };
  const release = () => {
    if (gl) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach((shader) => gl?.deleteShader(shader));
    }
    buffer = null;
    program = null;
    shaders.length = 0;
    uniforms = {};
  };
  const resize = () => {
    // getBoundingClientRect runs only on resize, never in the animation loop.
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, Math.min(640, Math.round(rect.width * ratio)));
    const height = Math.max(1, Math.min(640, Math.round(rect.height * ratio)));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl?.viewport(0, 0, width, height);
    schedule();
  };
  function initialize() {
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      });
      if (!gl) { fallback(); return; }
      release();
      for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Unable to allocate an orb shader.");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || "Unable to compile the orb shader.");
        }
      }
      program = gl.createProgram();
      buffer = gl.createBuffer();
      if (!program || !buffer) throw new Error("Unable to allocate orb graphics resources.");
      shaders.forEach((shader) => gl?.attachShader(program!, shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Unable to link the orb shader.");
      }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      for (const name of ["resolution", "time", "audio", "mouse", "state", "shockwave", "voice_sync", "word_vibe", "theme", "rotation"]) {
        uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
      }
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      host.dataset.renderer = "webgl";
      resize();
    } catch (error) {
      // Failure is visible as a CSS sphere, never a blank or broken interaction.
      console.warn("Orb renderer is using its CSS fallback.", error);
      release();
      fallback();
    }
  }
  function schedule() {
    if (disposed || lost || frame || !visible || document.hidden || !program) return;
    frame = requestAnimationFrame(draw);
  }
  function draw(now: number) {
    frame = 0;
    if (disposed || lost || !gl || !program || !visible || document.hidden) return;
    const dt = lastTime ? clamp((now - lastTime) / 1000, 0, 0.05) : 1 / 60;
    lastTime = now;
    const targetAudio = options.state === 1 ? audioEnvelope(options.signal?.current.audio ?? 0) : 0;
    const impulse = options.state === 3 ? clamp((options.signal?.current.word ?? 0) * Math.exp(-Math.max(0, Date.now() - (options.signal?.current.wordAt ?? 0)) / 150)) : 0;

    audio = damp(audio, targetAudio, targetAudio > audio ? 17 : 6, dt);
    word = Math.max(impulse, word * Math.exp(-9 * dt));
    for (let i = 0; i < 3; i++) activity[i] = damp(activity[i], options.state === i + 1 ? 1 : 0, 5, dt);
    pointerX = damp(pointerX, targetX, 5, dt);
    pointerY = damp(pointerY, targetY, 5, dt);

    // Apply user rotational momentum & inertia
    rotY += velY * dt;
    rotX += velX * dt;

    // Exponential friction slows down user-driven spin smoothly ("spins a little and settles")
    const friction = Math.exp(-3.5 * dt);
    velY *= friction;
    velX *= friction;
    if (Math.abs(velY) < 0.0005) velY = 0;
    if (Math.abs(velX) < 0.0005) velX = 0;

    // If cursor is stationary over the orb, damp velocity faster so it stops under your hand
    const nowTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (hasPointer && lastMoveTime > 0 && nowTime - lastMoveTime > 75) {
      const settleFriction = Math.exp(-8 * dt);
      velY *= settleFriction;
      velX *= settleFriction;
    }

    // Gentle ambient idle drift when user is not actively spinning it:
    // In idle state (0), slow subtle organic breathing drift instead of frantic spinning.
    // In active states (thinking 2, listening 1, speaking 3), more animated.
    const idleYaw = options.state === 2 ? 0.35 : (options.state === 1 ? 0.16 : (options.state === 3 ? 0.20 : 0.05));
    const idlePitch = options.state === 2 ? 0.12 : (options.state === 3 ? 0.08 : 0.02);
    if (!reduced) {
      rotY += idleYaw * dt;
      rotX += idlePitch * dt;
    }

    // Keep rotation angles within [0, 2π) to prevent floating-point loss over time
    const twoPi = Math.PI * 2;
    rotY = ((rotY % twoPi) + twoPi) % twoPi;
    rotX = ((rotX % twoPi) + twoPi) % twoPi;

    if (!reduced) time += dt;
    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, reduced ? 1.25 : time);
    gl.uniform1f(uniforms.audio, reduced ? 0 : audio);
    gl.uniform2f(uniforms.rotation, reduced ? 0 : rotX, reduced ? 0 : rotY);
    // Native speech boundary events provide real timing; the subtle carrier is
    // animation only, not a claim to be measured speaker audio.
    const voice = options.state === 3 ? 0.12 + word * 0.72 : 0;
    gl.uniform2f(uniforms.mouse, reduced ? 0 : pointerX, reduced ? 0 : pointerY);
    gl.uniform1i(uniforms.state, reduced ? 0 : options.state);
    gl.uniform1f(uniforms.voice_sync, reduced ? 0 : voice);
    gl.uniform1f(uniforms.word_vibe, reduced ? 0 : word * 0.65);
    gl.uniform1f(uniforms.shockwave, reduced ? 0 : audio * 0.24);
    // Small, measured voice-reactive shiver. Silence never fabricates input.
    const energy = options.state === 1 ? audio : voice;
    const dx = reduced ? 0 : Math.sin(time * 66) * energy * 1.35;
    const dy = reduced ? 0 : Math.cos(time * 57) * energy * 0.8;
    host.style.setProperty("--orb-vibration-x", `${dx.toFixed(3)}px`);
    host.style.setProperty("--orb-vibration-y", `${dy.toFixed(3)}px`);
    host.style.setProperty("--orb-breathe", reduced ? "1" : `${(1 + Math.sin(time * 1.45) * 0.008 + energy * 0.016).toFixed(4)}`);
    host.dataset.audioLevel = audio.toFixed(3);
    gl.uniform1i(uniforms.theme, options.theme);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 0; i < barNodes.length; i++) {
      const distance = Math.abs((i + 0.5) / barNodes.length * 2 - 1);
      // Speech boundaries are timing feedback, not claimed to be output audio analysis.
      const speaking = options.state === 3 ? 0.12 + word * 0.55 : 0;
      const level = reduced ? 0.09 : 0.08 + (audio + speaking) * (1 - distance * 0.75) * (0.65 + 0.35 * Math.sin(time * 6 + i * 0.75) ** 2);
      barNodes[i].style.transform = `scaleY(${clamp(level, 0.08, 1).toFixed(3)})`;
    }
    if (!reduced) schedule();
  }
  const onPointer = (event: PointerEvent) => {
    if (reduced) return;
    const rect = host.getBoundingClientRect();
    const currentX = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
    const currentY = -clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
    targetX = currentX;
    targetY = currentY;

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (hasPointer && lastMoveTime > 0) {
      const dtPointer = clamp((now - lastMoveTime) / 1000, 0.005, 0.1);
      const dx = currentX - lastPointerX;
      const dy = currentY - lastPointerY;

      // 1:1 direct tactile response:
      // Moving right (dx > 0) rolls right (+rotY)
      // Moving up (dy > 0) rolls up (+rotX)
      rotY += dx * 1.6;
      rotX += dy * 1.6;

      // Impart rotational momentum
      const instVelY = (dx / dtPointer) * 0.4;
      const instVelX = (dy / dtPointer) * 0.4;
      velY = damp(velY, clamp(instVelY, -14, 14), 16, dtPointer);
      velX = damp(velX, clamp(instVelX, -14, 14), 16, dtPointer);
    }
    lastPointerX = currentX;
    lastPointerY = currentY;
    lastMoveTime = now;
    hasPointer = true;
    schedule();
  };
  const onLeave = () => {
    hasPointer = false;
    lastMoveTime = 0;
    targetX = 0;
    targetY = 0;
  };
  const onOrbSpin = (event: Event) => {
    const custom = event as CustomEvent<{ dx: number; dy: number }>;
    if (!custom.detail || reduced) return;
    const { dx, dy } = custom.detail;
    rotY += dx * 0.04;
    rotX -= dy * 0.04;
    velY = clamp(velY + dx * 0.35, -15, 15);
    velX = clamp(velX - dy * 0.35, -15, 15);
    schedule();
  };
  const pause = () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; };
  const onVisibility = () => { if (document.hidden) pause(); else schedule(); };
  const onMotion = () => { reduced = media.matches; pause(); schedule(); };
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    pause();
    // Lost contexts invalidate their objects. Forget them before restoration.
    release();
    fallback();
  };
  const onRestored = () => { if (disposed) return; lost = false; initialize(); schedule(); };
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  const intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) schedule(); else pause();
  });
  observer?.observe(canvas);
  intersection?.observe(host);
  host.addEventListener("pointermove", onPointer);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("orb:spin", onOrbSpin);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", resize);
  media.addEventListener("change", onMotion);
  initialize();
  schedule();
  return {
    update(next) { options = next; schedule(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      observer?.disconnect();
      intersection?.disconnect();
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("orb:spin", onOrbSpin);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      media.removeEventListener("change", onMotion);
      release();
      gl = null;
    },
  };
}
