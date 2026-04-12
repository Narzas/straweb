"use client";

import { useEffect, useRef } from "react";

const S = 3; // pixel scale — each "dot" = 3×3 real pixels

type Pixel = [number, number, string];

// colour shorthand
const C = {
  sk: "#f5c5a3", // skin
  ha: "#3d2b1f", // hair
  sh: "#4a90d9", // shirt
  pa: "#2c3e50", // pants
  so: "#1a1a1a", // shoe
  ey: "#1a1a1a", // eye
  mo: "#c0725a", // mouth
};

function px(x: number, y: number, c: string): Pixel {
  return [x, y, c];
}

const { sk, ha, sh, pa, so, ey, mo } = C;

const FRAME_W = 12;
const FRAME_H = 16;

// 4 frames of a walking pixel character
const FRAMES: Pixel[][] = [
  // ── Frame 0: neutral ────────────────────────────────
  [
    px(4,0,ha), px(5,0,ha), px(6,0,ha), px(7,0,ha),
    px(3,1,ha), px(4,1,sk), px(5,1,sk), px(6,1,sk), px(7,1,sk), px(8,1,ha),
    px(3,2,sk), px(4,2,ey), px(5,2,sk), px(6,2,sk), px(7,2,ey), px(8,2,sk),
    px(3,3,sk), px(4,3,sk), px(5,3,mo), px(6,3,mo), px(7,3,sk), px(8,3,sk),
    px(3,4,ha), px(4,4,ha), px(5,4,ha), px(6,4,ha), px(7,4,ha), px(8,4,ha),
    px(3,5,sh), px(4,5,sh), px(5,5,sh), px(6,5,sh), px(7,5,sh), px(8,5,sh),
    px(2,6,sh), px(3,6,sh), px(4,6,sh), px(5,6,sh), px(6,6,sh), px(7,6,sh), px(8,6,sh), px(9,6,sh),
    px(2,7,sh), px(3,7,sh), px(4,7,sh), px(5,7,sh), px(6,7,sh), px(7,7,sh), px(8,7,sh), px(9,7,sh),
    px(3,8,sh), px(4,8,sh), px(5,8,sh), px(6,8,sh), px(7,8,sh), px(8,8,sh),
    px(4,9,pa),  px(5,9,pa),  px(6,9,pa),  px(7,9,pa),
    px(4,10,pa), px(5,10,pa), px(6,10,pa), px(7,10,pa),
    px(4,11,pa), px(5,11,pa), px(6,11,pa), px(7,11,pa),
    px(4,12,pa), px(5,12,pa), px(6,12,pa), px(7,12,pa),
    px(4,13,so), px(5,13,so), px(6,13,so), px(7,13,so),
    px(3,14,so), px(4,14,so), px(5,14,so), px(6,14,so), px(7,14,so), px(8,14,so),
  ],
  // ── Frame 1: right leg forward ───────────────────────
  [
    px(4,0,ha), px(5,0,ha), px(6,0,ha), px(7,0,ha),
    px(3,1,ha), px(4,1,sk), px(5,1,sk), px(6,1,sk), px(7,1,sk), px(8,1,ha),
    px(3,2,sk), px(4,2,ey), px(5,2,sk), px(6,2,sk), px(7,2,ey), px(8,2,sk),
    px(3,3,sk), px(4,3,sk), px(5,3,mo), px(6,3,mo), px(7,3,sk), px(8,3,sk),
    px(3,4,ha), px(4,4,ha), px(5,4,ha), px(6,4,ha), px(7,4,ha), px(8,4,ha),
    px(3,5,sh), px(4,5,sh), px(5,5,sh), px(6,5,sh), px(7,5,sh), px(8,5,sh),
    px(2,6,sh), px(3,6,sh), px(4,6,sh), px(5,6,sh), px(6,6,sh), px(7,6,sh), px(8,6,sh), px(9,6,sh),
    px(2,7,sh), px(3,7,sh), px(4,7,sh), px(5,7,sh), px(6,7,sh), px(7,7,sh), px(8,7,sh), px(9,7,sh),
    px(3,8,sh), px(4,8,sh), px(5,8,sh), px(6,8,sh), px(7,8,sh), px(8,8,sh),
    // legs: right fwd (right side of body)
    px(5,9,pa),  px(6,9,pa),
    px(6,10,pa), px(7,10,pa),
    px(3,11,pa), px(4,11,pa), px(6,11,pa), px(7,11,pa),
    px(3,12,pa), px(4,12,pa), px(7,12,pa),
    px(3,13,so), px(7,13,so), px(8,13,so),
    px(2,14,so), px(3,14,so), px(4,14,so), px(6,14,so), px(7,14,so), px(8,14,so), px(9,14,so),
  ],
  // ── Frame 2: neutral (slight bob up 1px) ─────────────
  [
    px(4,0,ha), px(5,0,ha), px(6,0,ha), px(7,0,ha),
    px(3,1,ha), px(4,1,sk), px(5,1,sk), px(6,1,sk), px(7,1,sk), px(8,1,ha),
    px(3,2,sk), px(4,2,ey), px(5,2,sk), px(6,2,sk), px(7,2,ey), px(8,2,sk),
    px(3,3,sk), px(4,3,sk), px(5,3,mo), px(6,3,mo), px(7,3,sk), px(8,3,sk),
    px(3,4,ha), px(4,4,ha), px(5,4,ha), px(6,4,ha), px(7,4,ha), px(8,4,ha),
    px(3,5,sh), px(4,5,sh), px(5,5,sh), px(6,5,sh), px(7,5,sh), px(8,5,sh),
    px(2,6,sh), px(3,6,sh), px(4,6,sh), px(5,6,sh), px(6,6,sh), px(7,6,sh), px(8,6,sh), px(9,6,sh),
    px(2,7,sh), px(3,7,sh), px(4,7,sh), px(5,7,sh), px(6,7,sh), px(7,7,sh), px(8,7,sh), px(9,7,sh),
    px(3,8,sh), px(4,8,sh), px(5,8,sh), px(6,8,sh), px(7,8,sh), px(8,8,sh),
    px(4,9,pa),  px(5,9,pa),  px(6,9,pa),  px(7,9,pa),
    px(4,10,pa), px(5,10,pa), px(6,10,pa), px(7,10,pa),
    px(4,11,pa), px(5,11,pa), px(6,11,pa), px(7,11,pa),
    px(4,12,pa), px(5,12,pa), px(6,12,pa), px(7,12,pa),
    px(4,13,so), px(5,13,so), px(6,13,so), px(7,13,so),
    px(3,14,so), px(4,14,so), px(5,14,so), px(6,14,so), px(7,14,so), px(8,14,so),
  ],
  // ── Frame 3: left leg forward ────────────────────────
  [
    px(4,0,ha), px(5,0,ha), px(6,0,ha), px(7,0,ha),
    px(3,1,ha), px(4,1,sk), px(5,1,sk), px(6,1,sk), px(7,1,sk), px(8,1,ha),
    px(3,2,sk), px(4,2,ey), px(5,2,sk), px(6,2,sk), px(7,2,ey), px(8,2,sk),
    px(3,3,sk), px(4,3,sk), px(5,3,mo), px(6,3,mo), px(7,3,sk), px(8,3,sk),
    px(3,4,ha), px(4,4,ha), px(5,4,ha), px(6,4,ha), px(7,4,ha), px(8,4,ha),
    px(3,5,sh), px(4,5,sh), px(5,5,sh), px(6,5,sh), px(7,5,sh), px(8,5,sh),
    px(2,6,sh), px(3,6,sh), px(4,6,sh), px(5,6,sh), px(6,6,sh), px(7,6,sh), px(8,6,sh), px(9,6,sh),
    px(2,7,sh), px(3,7,sh), px(4,7,sh), px(5,7,sh), px(6,7,sh), px(7,7,sh), px(8,7,sh), px(9,7,sh),
    px(3,8,sh), px(4,8,sh), px(5,8,sh), px(6,8,sh), px(7,8,sh), px(8,8,sh),
    // legs: left fwd (left side of body)
    px(5,9,pa),  px(6,9,pa),
    px(4,10,pa), px(5,10,pa),
    px(3,11,pa), px(4,11,pa), px(7,11,pa), px(8,11,pa),
    px(3,12,pa), px(8,12,pa), px(9,12,pa),
    px(2,13,so), px(3,13,so), px(8,13,so),
    px(1,14,so), px(2,14,so), px(3,14,so), px(4,14,so), px(8,14,so), px(9,14,so),
  ],
];

interface Star {
  xFrac: number;
  yFrac: number;
  phase: number;
  speed: number;
  size: number;
}

export default function HeroDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth || 400;
      canvas.height = canvas.offsetHeight || 160;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Twinkling stars
    const stars: Star[] = Array.from({ length: 45 }, () => ({
      xFrac: Math.random(),
      yFrac: Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
      size: Math.random() < 0.25 ? 2 : 1,
    }));

    // Walking character state
    let charX = -FRAME_W * S * 2;
    const WALK_SPEED = 1.0;
    let frameIdx = 0;
    let frameTick = 0;
    const FRAME_RATE = 8;

    let raf: number;
    let t = 0;

    const drawChar = (frame: Pixel[], cx: number, cy: number): void => {
      for (const [px_, py_, color] of frame) {
        ctx.fillStyle = color;
        ctx.fillRect(cx + px_ * S, cy + py_ * S, S, S);
      }
    };

    const loop = () => {
      t++;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Stars
      for (const star of stars) {
        const alpha = 0.25 + 0.55 * Math.abs(Math.sin(star.phase + t * star.speed));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
          Math.floor(star.xFrac * width),
          Math.floor(star.yFrac * height),
          star.size * S,
          star.size * S,
        );
      }
      ctx.globalAlpha = 1;

      // Ground line
      const groundY = Math.floor(height * 0.8);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(0, groundY, width, S);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, groundY + S, width, S);

      // Advance character
      charX += WALK_SPEED;
      if (charX > width + FRAME_W * S) charX = -FRAME_W * S * 2;

      frameTick++;
      if (frameTick >= FRAME_RATE) {
        frameTick = 0;
        frameIdx = (frameIdx + 1) % FRAMES.length;
      }

      // Shadow ellipse
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(
        charX + (FRAME_W * S) / 2,
        groundY + S * 2,
        FRAME_W * S * 0.42,
        S * 1.4,
        0, 0, Math.PI * 2,
      );
      ctx.fill();
      ctx.globalAlpha = 1;

      // Character (ground-anchored)
      const charY = groundY - FRAME_H * S;
      drawChar(FRAMES[frameIdx], Math.floor(charX), Math.floor(charY));

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
      style={{ opacity: 0.55, imageRendering: "pixelated" }}
    />
  );
}
