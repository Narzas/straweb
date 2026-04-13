"use client";

import { useEffect, useRef } from "react";

const S = 3; // pixel scale: 1 logical px = 3×3 screen px
const ATB_H = 48; // ATB panel height at canvas bottom

interface Star {
  xFrac: number;
  yFrac: number;
  phase: number;
  speed: number;
  size: number;
}

export default function HeroBattleScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth || 600;
      canvas.height = canvas.offsetHeight || 200;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const stars: Star[] = Array.from({ length: 40 }, () => ({
      xFrac: Math.random(),
      yFrac: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.018 + Math.random() * 0.025,
      size: Math.random() < 0.2 ? 2 : 1,
    }));

    function drawMountains(w: number, groundY: number) {
      const cols: [number, number][] = [
        [0,    0.73], [0.14, 0.61], [0.28, 0.74], [0.42, 0.63],
        [0.56, 0.75], [0.70, 0.62], [0.84, 0.76], [1.0,  0.80],
      ];
      const palette = ["#0f1520", "#131a28"];
      for (let i = 0; i < cols.length - 1; i++) {
        const [ax, ay] = cols[i];
        const [bx]     = cols[i + 1];
        const midX  = Math.floor(((ax + bx) / 2) * w);
        const leftX = Math.floor(ax * w);
        const rightX= Math.floor(bx * w);
        const peakY = Math.floor(ay * groundY);
        ctx.fillStyle = palette[i % 2];
        for (let y = peakY; y <= groundY; y += S) {
          const p = (y - peakY) / (groundY - peakY);
          const rl = Math.floor(midX + (leftX  - midX) * p);
          const rr = Math.floor(midX + (rightX - midX) * p);
          ctx.fillRect(rl, y, rr - rl, S);
        }
      }
    }

    let t = 0;
    let raf: number;

    const loop = () => {
      t++;
      const { width, height } = canvas;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);

      const groundY = height - ATB_H - 4;

      // Stars
      for (const star of stars) {
        const alpha = 0.15 + 0.55 * Math.abs(Math.sin(star.phase + t * star.speed));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
          Math.floor(star.xFrac * width),
          Math.floor(star.yFrac * (groundY - 20)),
          star.size * S,
          star.size * S,
        );
      }
      ctx.globalAlpha = 1;

      // Mountains
      drawMountains(width, groundY);

      // Ground line
      ctx.fillStyle = "rgba(160,140,220,0.15)";
      ctx.fillRect(0, groundY, width, S);

      // TODO next tasks
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: 0.82, imageRendering: "pixelated" }}
    />
  );
}
