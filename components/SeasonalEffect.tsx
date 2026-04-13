"use client";

import { useEffect, useRef, useCallback } from "react";

export type Season = "spring" | "summer" | "autumn" | "winter";

interface Particle {
  x: number;
  y: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color: string;
  t: number;
  swayAmp: number;
  swaySpeed: number;
  pulsePhase: number;
  driftX: number;
  driftY: number;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

const CFG = {
  spring: {
    count: 28,
    colors: ["#ffb7c5", "#ff9eb5", "#ffc0cb", "#f48fb1", "#f8bbd0", "#e91e8c40"],
    minSize: 4, maxSize: 9,
    minSpeed: 0.35, maxSpeed: 1.0,
    swayAmp: 1.8,
  },
  summer: {
    count: 22,
    colors: ["#fffde7", "#fff9c4", "#ffee58", "#fff176", "#ffff8d"],
    minSize: 2, maxSize: 4,
    minSpeed: -0.15, maxSpeed: 0.15,
    swayAmp: 0.4,
  },
  autumn: {
    count: 24,
    colors: ["#d35400", "#e67e22", "#f39c12", "#c0392b", "#a04000", "#e74c3c", "#8B4513"],
    minSize: 6, maxSize: 14,
    minSpeed: 0.55, maxSpeed: 1.5,
    swayAmp: 2.8,
  },
  winter: {
    count: 80,
    colors: ["#ffffff", "#e3f2fd", "#f0f8ff", "#dceefb"],
    minSize: 1.5, maxSize: 4.5,
    minSpeed: 0.4, maxSpeed: 1.8,
    swayAmp: 0.9,
  },
};

function spawn(width: number, height: number, season: Season, initialSpread = false): Particle {
  const c = CFG[season];
  return {
    x: rand(0, width),
    y: initialSpread ? rand(-20, height) : rand(-40, -5),
    vy: rand(c.minSpeed, c.maxSpeed),
    size: rand(c.minSize, c.maxSize),
    rotation: rand(0, Math.PI * 2),
    rotationSpeed: (Math.random() - 0.5) * 0.08,
    opacity: rand(0.35, 0.75),
    color: c.colors[Math.floor(Math.random() * c.colors.length)],
    t: rand(0, Math.PI * 2),
    swayAmp: rand(0.5, c.swayAmp),
    swaySpeed: rand(0.012, 0.028),
    pulsePhase: rand(0, Math.PI * 2),
    driftX: (Math.random() - 0.5) * 0.4,
    driftY: (Math.random() - 0.5) * 0.3,
  };
}

// ── 그리기 함수 ──────────────────────────────────────

function drawSnow(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = p.color;
  ctx.shadowBlur = 4;
  ctx.shadowColor = "#fff";
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.globalAlpha = p.opacity;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  // 꽃잎 모양: 위아래 뾰족한 타원
  ctx.ellipse(0, 0, p.size * 0.5, p.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.globalAlpha = p.opacity;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);

  const s = p.size;
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;

  // 잎 몸통
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.9, -s * 0.4, s * 0.9, s * 0.4, 0, s);
  ctx.bezierCurveTo(-s * 0.9, s * 0.4, -s * 0.9, -s * 0.4, 0, -s);
  ctx.fill();

  // 잎맥
  ctx.globalAlpha = p.opacity * 0.4;
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.8);
  ctx.lineTo(0, s * 0.8);
  ctx.stroke();

  ctx.restore();
}

function drawFirefly(ctx: CanvasRenderingContext2D, p: Particle) {
  const glow = 0.3 + 0.7 * Math.abs(Math.sin(p.pulsePhase));
  const r = p.size * 4;

  const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  grad.addColorStop(0, `rgba(255, 252, 150, ${glow * 0.9})`);
  grad.addColorStop(0.35, `rgba(255, 230, 80, ${glow * 0.4})`);
  grad.addColorStop(1, `rgba(200, 180, 0, 0)`);

  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── 메인 컴포넌트 ──────────────────────────────────

export default function SeasonalEffect({ season }: { season: Season }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{ particles: Particle[]; raf: number; time: number }>({
    particles: [],
    raf: 0,
    time: 0,
  });
  const initParticles = useCallback(
    (w: number, h: number) => {
      const cfg = CFG[season];
      stateRef.current.particles = Array.from({ length: cfg.count }, () =>
        spawn(w, h, season, true)
      );
    },
    [season]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles(canvas.width, canvas.height);
    };
    onResize();
    window.addEventListener("resize", onResize);

    const cfg = CFG[season];

    const tick = () => {
      stateRef.current.time += 0.016;
      const { width, height } = canvas;
      const ps = stateRef.current.particles;

      ctx.clearRect(0, 0, width, height);

      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.t += p.swaySpeed;
        p.pulsePhase += 0.04;

        if (season === "summer") {
          // 반딧불: 둥실둥실 부유
          p.x += Math.sin(p.t * 0.7) * 0.5 + p.driftX;
          p.y += Math.cos(p.t * 0.5) * 0.3 + p.driftY;
          // 화면 안에서 튕기기
          if (p.x < 0) p.driftX = Math.abs(p.driftX);
          if (p.x > width) p.driftX = -Math.abs(p.driftX);
          if (p.y < 0) p.driftY = Math.abs(p.driftY);
          if (p.y > height) p.driftY = -Math.abs(p.driftY);
        } else {
          p.x += Math.sin(p.t) * p.swayAmp * 0.35;
          p.y += p.vy;
          p.rotation += p.rotationSpeed;
        }

        // 그리기
        ctx.save();
        if (season === "winter") drawSnow(ctx, p);
        else if (season === "spring") drawPetal(ctx, p);
        else if (season === "autumn") drawLeaf(ctx, p);
        else drawFirefly(ctx, p);
        ctx.restore();
        ctx.globalAlpha = 1;

        // 화면 밖으로 나가면 리스폰
        const outOfBounds =
          season !== "summer" &&
          (p.y > height + 30 || p.x < -60 || p.x > width + 60);
        if (outOfBounds) {
          ps[i] = spawn(width, height, season);
        }
      }

      // 파티클 수 유지
      while (ps.length < cfg.count) {
        ps.push(spawn(width, height, season));
      }

      stateRef.current.raf = requestAnimationFrame(tick);
    };

    stateRef.current.raf = requestAnimationFrame(tick);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(stateRef.current.raf);
      } else {
        stateRef.current.raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(stateRef.current.raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [season, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
