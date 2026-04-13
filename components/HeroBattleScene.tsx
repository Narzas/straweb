"use client";

import { useEffect, useRef } from "react";

const S = 3; // pixel scale: 1 logical px = 3×3 screen px
const ATB_H = 48; // ATB panel height at canvas bottom

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

    let t = 0;
    let raf: number;

    const loop = () => {
      t++;
      const { width, height } = canvas;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);
      // drawing goes here in later tasks
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
