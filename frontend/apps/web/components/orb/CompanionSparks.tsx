"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export interface CompanionSparksHandle {
  burst: (x?: number, y?: number, count?: number) => void;
  burstAtElement: (element: HTMLElement, count?: number) => void;
}

interface CompanionSparksProps {
  className?: string;
  enableAmbient?: boolean;
}

class SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  gravity: number;

  constructor(x: number, y: number, vx: number, vy: number, color: string, size: number, decay: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.alpha = 1;
    this.decay = decay;
    this.gravity = 0.12;
  }

  update(): void {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.98;
    this.alpha -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

interface Mote {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  color: string;
  baseAlpha: number;
  phase: number;
}

const SPARK_COLORS = ["#c4b5fd", "#e879f9", "#38bdf8", "#fef08a", "#ffffff"];

export const CompanionSparks = forwardRef<CompanionSparksHandle, CompanionSparksProps>(
  function CompanionSparks({ className, enableAmbient = true }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sparkCanvasRef = useRef<HTMLCanvasElement>(null);
    const ambientCanvasRef = useRef<HTMLCanvasElement>(null);

    const sparksRef = useRef<SparkParticle[]>([]);
    const motesRef = useRef<Mote[]>([]);
    const sparkRafRef = useRef<number | null>(null);
    const ambientRafRef = useRef<number | null>(null);

    const burst = (x?: number, y?: number, count = 22) => {
      const canvas = sparkCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const targetX = x !== undefined ? x : rect.width / 2;
      const targetY = y !== undefined ? y : 80;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.6 + Math.random() * 4.2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 1.2;
        const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
        const size = 1.2 + Math.random() * 2.2;
        const decay = 0.016 + Math.random() * 0.022;
        sparksRef.current.push(
          new SparkParticle(targetX, targetY, vx, vy, color, size, decay)
        );
      }
    };

    const burstAtElement = (element: HTMLElement, count = 22) => {
      const canvas = sparkCanvasRef.current;
      if (!canvas || !element) return;
      const cRect = canvas.getBoundingClientRect();
      const eRect = element.getBoundingClientRect();
      const x = eRect.left - cRect.left + eRect.width / 2;
      const y = eRect.top - cRect.top + eRect.height / 2;
      burst(x, y, count);
    };

    useImperativeHandle(ref, () => ({
      burst,
      burstAtElement,
    }));

    // Resize handler
    useEffect(() => {
      const resize = () => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (sparkCanvasRef.current) {
          sparkCanvasRef.current.width = rect.width;
          sparkCanvasRef.current.height = rect.height;
        }
        if (ambientCanvasRef.current) {
          ambientCanvasRef.current.width = rect.width;
          ambientCanvasRef.current.height = rect.height;
        }
      };

      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, []);

    // Ambient floating motes animation loop
    useEffect(() => {
      if (!enableAmbient) return;
      const canvas = ambientCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width || 360;
      const h = canvas.height || 552;
      const motes: Mote[] = [];
      const count = 24;

      for (let i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 0.8 + Math.random() * 1.5,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.18 - Math.random() * 0.3,
          color: Math.random() > 0.5 ? "#a78bfa" : "#38bdf8",
          baseAlpha: 0.18 + Math.random() * 0.4,
          phase: Math.random() * Math.PI * 2,
        });
      }
      motesRef.current = motes;

      let running = true;
      const loop = () => {
        if (!running) return;
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        for (const m of motesRef.current) {
          m.x += m.vx;
          m.y += m.vy;
          m.phase += 0.025;
          if (m.y < -10) m.y = height + 10;
          if (m.x < -10) m.x = width + 10;
          if (m.x > width + 10) m.x = -10;

          const alpha = m.baseAlpha * (0.6 + 0.4 * Math.sin(m.phase));
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.fillStyle = m.color;
          ctx.shadowColor = m.color;
          ctx.shadowBlur = 5;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ambientRafRef.current = requestAnimationFrame(loop);
      };

      ambientRafRef.current = requestAnimationFrame(loop);
      return () => {
        running = false;
        if (ambientRafRef.current) cancelAnimationFrame(ambientRafRef.current);
      };
    }, [enableAmbient]);

    // Active sparks animation loop
    useEffect(() => {
      const canvas = sparkCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let running = true;
      const loop = () => {
        if (!running) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const list = sparksRef.current;
        for (let i = list.length - 1; i >= 0; i--) {
          const s = list[i];
          s.update();
          s.draw(ctx);
          if (s.alpha <= 0) {
            list.splice(i, 1);
          }
        }

        sparkRafRef.current = requestAnimationFrame(loop);
      };

      sparkRafRef.current = requestAnimationFrame(loop);
      return () => {
        running = false;
        if (sparkRafRef.current) cancelAnimationFrame(sparkRafRef.current);
      };
    }, []);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          borderRadius: "inherit",
          zIndex: 35,
        }}
        aria-hidden="true"
      >
        <canvas
          ref={ambientCanvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            opacity: 0.65,
          }}
        />
        <canvas
          ref={sparkCanvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }
);
