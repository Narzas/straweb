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

type Pixel = [number, number, string];
function px(x: number, y: number, c: string): Pixel { return [x, y, c]; }

function drawSprite(
  ctx: CanvasRenderingContext2D,
  pixels: Pixel[],
  ox: number, oy: number,
  scale = S,
) {
  for (const [x, y, color] of pixels) {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
  }
}

// Sprite size: 6w × 8h logical pixels
const sk = "#fde8d0"; // skin
const ey = "#1a1a1a"; // eye dark

// Terra — green hair, purple robe, female
const TERRA: Pixel[] = [
  px(1,0,"#16a34a"), px(2,0,"#16a34a"), px(3,0,"#16a34a"),
  px(0,1,"#16a34a"), px(1,1,"#16a34a"), px(2,1,"#16a34a"), px(3,1,"#16a34a"), px(4,1,"#16a34a"),
  px(1,2,sk), px(2,2,sk), px(3,2,sk), px(4,2,sk),
  px(1,3,sk), px(2,3,ey), px(3,3,sk), px(4,3,ey), px(5,3,sk),
  px(1,4,sk), px(2,4,sk), px(3,4,sk), px(4,4,sk),
  px(1,5,"#7e22ce"), px(2,5,"#7e22ce"), px(3,5,"#7e22ce"), px(4,5,"#7e22ce"), px(5,5,"#7e22ce"),
  px(0,6,"#7e22ce"), px(1,6,"#7e22ce"), px(2,6,"#7e22ce"), px(3,6,"#7e22ce"), px(4,6,"#7e22ce"), px(5,6,"#7e22ce"),
  px(1,7,"#6b21a8"), px(2,7,"#6b21a8"), px(4,7,"#6b21a8"), px(5,7,"#6b21a8"),
];

// Celes — blonde hair, blue eyes, silver armor, female
const CELES: Pixel[] = [
  px(1,0,"#fbbf24"), px(2,0,"#fbbf24"), px(3,0,"#fbbf24"), px(4,0,"#fbbf24"),
  px(0,1,"#fbbf24"), px(1,1,"#fbbf24"), px(2,1,"#fbbf24"), px(3,1,"#fbbf24"), px(4,1,"#fbbf24"),
  px(1,2,sk), px(2,2,sk), px(3,2,sk), px(4,2,sk),
  px(1,3,sk), px(2,3,"#1d4ed8"), px(3,3,sk), px(4,3,"#1d4ed8"), px(5,3,sk),
  px(1,4,sk), px(2,4,sk), px(3,4,sk), px(4,4,sk),
  px(1,5,"#cbd5e1"), px(2,5,"#cbd5e1"), px(3,5,"#cbd5e1"), px(4,5,"#cbd5e1"), px(5,5,"#cbd5e1"),
  px(0,6,"#94a3b8"), px(1,6,"#cbd5e1"), px(2,6,"#cbd5e1"), px(3,6,"#cbd5e1"), px(4,6,"#cbd5e1"), px(5,6,"#94a3b8"),
  px(1,7,"#64748b"), px(2,7,"#64748b"), px(4,7,"#64748b"), px(5,7,"#64748b"),
];

// Locke — brown hair, white bandana, blue jacket
const LOCKE: Pixel[] = [
  px(1,0,"#92400e"), px(2,0,"#92400e"), px(3,0,"#92400e"),
  px(0,1,"#f8fafc"), px(1,1,"#f8fafc"), px(2,1,"#f8fafc"), px(3,1,"#f8fafc"), px(4,1,"#f8fafc"),
  px(1,2,sk), px(2,2,sk), px(3,2,sk), px(4,2,sk),
  px(1,3,sk), px(2,3,ey), px(3,3,sk), px(4,3,ey), px(5,3,sk),
  px(1,4,sk), px(2,4,sk), px(3,4,sk), px(4,4,sk),
  px(1,5,"#1d4ed8"), px(2,5,"#1d4ed8"), px(3,5,"#1d4ed8"), px(4,5,"#1d4ed8"), px(5,5,"#1d4ed8"),
  px(0,6,"#1d4ed8"), px(1,6,"#1d4ed8"), px(2,6,"#1d4ed8"), px(3,6,"#1d4ed8"), px(4,6,"#1d4ed8"), px(5,6,"#1d4ed8"),
  px(1,7,"#1e3a8a"), px(2,7,"#1e3a8a"), px(4,7,"#1e3a8a"), px(5,7,"#1e3a8a"),
];

// Edgar — gold crown, green armor
const EDGAR: Pixel[] = [
  px(1,0,"#fbbf24"), px(3,0,"#fbbf24"), px(5,0,"#fbbf24"),
  px(0,1,"#f59e0b"), px(1,1,"#f59e0b"), px(2,1,"#f59e0b"), px(3,1,"#f59e0b"), px(4,1,"#f59e0b"),
  px(1,2,sk), px(2,2,sk), px(3,2,sk), px(4,2,sk),
  px(1,3,sk), px(2,3,ey), px(3,3,sk), px(4,3,ey), px(5,3,sk),
  px(1,4,sk), px(2,4,sk), px(3,4,sk), px(4,4,sk),
  px(1,5,"#166534"), px(2,5,"#166534"), px(3,5,"#166534"), px(4,5,"#166534"), px(5,5,"#166534"),
  px(0,6,"#166534"), px(1,6,"#166534"), px(2,6,"#166534"), px(3,6,"#166534"), px(4,6,"#166534"), px(5,6,"#166534"),
  px(1,7,"#14532d"), px(2,7,"#14532d"), px(4,7,"#14532d"), px(5,7,"#14532d"),
];

const PARTY        = [TERRA, CELES, LOCKE, EDGAR];
const PARTY_NAMES  = ["TERRA", "CELES", "LOCKE", "EDGAR"];
const PARTY_COLORS = ["#22c55e", "#93c5fd", "#fbbf24", "#4ade80"];
const SPRITE_W     = 6 * S;
const SPRITE_H     = 8 * S;
const MEMBER_GAP   = S * 2;
const TOTAL_PARTY_H = PARTY.length * SPRITE_H + (PARTY.length - 1) * MEMBER_GAP;

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

      // Layout constants used by multiple draw sections
      const partyX    = width - SPRITE_W - S * 6;
      const partyTopY = groundY - TOTAL_PARTY_H;

      // Party — vertical column, right side, idle bob
      for (let i = 0; i < PARTY.length; i++) {
        const bobY   = Math.round(Math.sin(t * 0.055 + i * 0.7) * S);
        const memberY = partyTopY + i * (SPRITE_H + MEMBER_GAP) + bobY;
        drawSprite(ctx, PARTY[i], partyX, memberY);
      }

      // TODO enemies + Bahamut + ATB
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
