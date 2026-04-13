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

    // Dragon boss: 14w × 28h logical body, drawn at bossX/bossY
    function drawDragonBoss(bx: number, by: number) {
      const s = S;
      // wings (dark navy triangles, one row at a time)
      ctx.fillStyle = "#172554";
      for (let row = 0; row < 10; row++) {
        const span = row * 2;
        ctx.fillRect(bx - span * s - s * 4, by + row * s, span * s + s * 3, s);
        ctx.fillRect(bx + s * 14,            by + row * s, span * s + s * 3, s);
      }
      // tail (left, lower body)
      ctx.fillStyle = "#1e3a8a";
      ctx.fillRect(bx - s * 8, by + s * 14, s * 6, s * 2);
      ctx.fillRect(bx - s * 12,by + s * 16, s * 5, s * 2);
      ctx.fillRect(bx - s * 14,by + s * 18, s * 3, s * 2);
      // body
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(bx, by + s * 6, s * 14, s * 18);
      // belly
      ctx.fillStyle = "#3b82f6";
      ctx.globalAlpha = 0.28;
      ctx.fillRect(bx + s * 3, by + s * 9, s * 8, s * 12);
      ctx.globalAlpha = 1;
      // scale rows
      ctx.fillStyle = "#172554";
      for (let row = 0; row < 5; row++) {
        ctx.fillRect(bx + s, by + s * 7 + row * s * 3, s * 12, s);
      }
      // neck
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(bx + s * 4, by + s * 2, s * 6, s * 5);
      // head
      ctx.fillStyle = "#1e3a8a";
      ctx.fillRect(bx + s * 2, by, s * 10, s * 6);
      // snout
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(bx + s * 3, by - s * 2, s * 8, s * 3);
      // teeth
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(bx + s * 4,  by + s * 4, s * 2, s * 3);
      ctx.fillRect(bx + s * 7,  by + s * 5, s * 2, s * 2);
      ctx.fillRect(bx + s * 10, by + s * 4, s * 2, s * 3);
      // eyes
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(bx + s * 3, by + s, s * 3, s * 3);
      ctx.fillRect(bx + s * 8, by + s, s * 3, s * 3);
      // slit pupils
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(bx + s * 4, by + s * 2, s, s * 2);
      ctx.fillRect(bx + s * 9, by + s * 2, s, s * 2);
      // horns
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(bx + s * 3, by - s * 5, s * 2, s * 4);
      ctx.fillRect(bx + s * 9, by - s * 5, s * 2, s * 4);
      // arms / claws
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(bx - s * 3, by + s * 14, s * 4, s * 4);
      ctx.fillRect(bx + s * 13,by + s * 14, s * 4, s * 4);
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(bx - s * 4, by + s * 17, s * 2, s);
      ctx.fillRect(bx - s * 5, by + s * 18, s * 2, s);
      ctx.fillRect(bx + s * 16,by + s * 17, s * 2, s);
      ctx.fillRect(bx + s * 17,by + s * 18, s * 2, s);
      // legs
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(bx + s * 2, by + s * 23, s * 4, s * 5);
      ctx.fillRect(bx + s * 8, by + s * 23, s * 4, s * 5);
      // toes
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(bx,         by + s * 27, s * 5, s);
      ctx.fillRect(bx + s * 8, by + s * 27, s * 5, s);
    }

    // Wyvern: 7w × 13h logical body
    function drawWyvern(wx: number, wy: number) {
      const s = S;
      // wings
      ctx.fillStyle = "#172554";
      for (let row = 0; row < 5; row++) {
        const span = row * 2;
        ctx.fillRect(wx - span * s - s * 2, wy + row * s, span * s + s * 2, s);
        ctx.fillRect(wx + s * 7,             wy + row * s, span * s + s * 2, s);
      }
      // body
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(wx, wy + s * 4, s * 7, s * 7);
      // head
      ctx.fillStyle = "#1e3a8a";
      ctx.fillRect(wx + s, wy + s, s * 6, s * 5);
      // snout
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(wx + s * 2, wy - s, s * 4, s * 3);
      // teeth
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(wx + s * 2, wy + s * 4, s, s * 2);
      ctx.fillRect(wx + s * 5, wy + s * 4, s, s * 2);
      // eyes
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(wx + s * 2, wy + s * 2, s * 2, s * 2);
      ctx.fillRect(wx + s * 5, wy + s * 2, s * 2, s * 2);
      // tail
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(wx + s,     wy + s * 10, s * 4, s * 2);
      ctx.fillRect(wx + s * 3, wy + s * 12, s * 3, s);
      // claws
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(wx - s,     wy + s * 9, s * 3, s);
      ctx.fillRect(wx + s * 5, wy + s * 9, s * 3, s);
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

      // Enemy layout constants (also used by animation tasks)
      const BOSS_W  = 14 * S;
      const BOSS_H  = 28 * S; // includes horns/head above body
      const BOSS_X  = S * 8;
      const WY_H    = 13 * S;
      const WY1_X   = BOSS_X + BOSS_W + S * 14;
      const WY2_X   = WY1_X + 7 * S + S * 10;

      const bossBob = Math.round(Math.sin(t * 0.04) * S * 1.5);
      const bossY   = groundY - BOSS_H + bossBob;
      drawDragonBoss(BOSS_X, bossY);

      const wy1Bob = Math.round(Math.sin(t * 0.05 + 1.2) * S * 1.5);
      drawWyvern(WY1_X, groundY - WY_H + wy1Bob);

      const wy2Bob = Math.round(Math.sin(t * 0.05 + 2.5) * S * 1.5);
      drawWyvern(WY2_X, groundY - WY_H + wy2Bob);

      // Layout constants used by multiple draw sections
      const partyX    = width - SPRITE_W - S * 6;
      const partyTopY = groundY - TOTAL_PARTY_H;

      // Party — vertical column, right side, idle bob
      for (let i = 0; i < PARTY.length; i++) {
        const bobY   = Math.round(Math.sin(t * 0.055 + i * 0.7) * S);
        const memberY = partyTopY + i * (SPRITE_H + MEMBER_GAP) + bobY;
        drawSprite(ctx, PARTY[i], partyX, memberY);
      }

      // TODO Bahamut + ATB
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
