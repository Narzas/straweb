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

interface AttackAnim {
  memberIdx: number;
  frame: number; // 0–45
}
interface SlashFx {
  x: number; y: number;
  frame: number; // 0–33
  color: string;
}
interface FloatingNum {
  x: number; y: number;
  text: string; color: string;
  frame: number; maxFrame: number;
}
interface MagicCircle { cx: number; cy: number; frame: number; }
interface MegaFlare   { frame: number; }

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
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
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

    function drawMountains(w: number, groundY: number, ctx: CanvasRenderingContext2D) {
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

    function drawBahamut(cx: number, cy: number, glow: number) {
      const s = S;
      // wings
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#4c1d95";
      for (let row = 0; row < 8; row++) {
        const w = (8 - row) * s * 3;
        ctx.fillRect(cx - s * 8 - w, cy + row * s, w, s);
        ctx.fillRect(cx + s * 8,     cy + row * s, w, s);
      }
      ctx.globalAlpha = 1;
      // body
      ctx.fillStyle = "#6d28d9";
      ctx.fillRect(cx - s * 6, cy + s * 3, s * 12, s * 14);
      // belly
      ctx.fillStyle = "#7c3aed";
      ctx.globalAlpha = 0.35;
      ctx.fillRect(cx - s * 3, cy + s * 6, s * 6, s * 9);
      ctx.globalAlpha = 1;
      // scale rows
      ctx.fillStyle = "#4c1d95";
      ctx.fillRect(cx - s * 5, cy + s * 5, s * 10, s);
      ctx.fillRect(cx - s * 5, cy + s * 8, s * 10, s);
      ctx.fillRect(cx - s * 5, cy + s * 11,s * 10, s);
      // neck
      ctx.fillStyle = "#6d28d9";
      ctx.fillRect(cx - s * 3, cy, s * 6, s * 5);
      // head
      ctx.fillStyle = "#5b21b6";
      ctx.fillRect(cx - s * 5, cy - s * 6, s * 10, s * 7);
      // snout
      ctx.fillStyle = "#6d28d9";
      ctx.fillRect(cx - s * 3, cy - s * 9, s * 6, s * 4);
      // eyes
      ctx.fillStyle = glow > 0.3 ? "#ff8800" : "#ea580c";
      ctx.fillRect(cx - s * 4, cy - s * 4, s * 2, s * 2);
      ctx.fillRect(cx + s * 2, cy - s * 4, s * 2, s * 2);
      ctx.fillStyle = "#7f1d1d";
      ctx.fillRect(cx - s * 3, cy - s * 3, s, s);
      ctx.fillRect(cx + s * 2, cy - s * 3, s, s);
      // horns
      ctx.fillStyle = "#c4b5fd";
      ctx.fillRect(cx - s * 5, cy - s * 10, s * 2, s * 4);
      ctx.fillRect(cx - s * 6, cy - s * 13, s * 2, s * 3);
      ctx.fillRect(cx + s * 3, cy - s * 10, s * 2, s * 4);
      ctx.fillRect(cx + s * 4, cy - s * 13, s * 2, s * 3);
      // tail
      ctx.fillStyle = "#7c3aed";
      ctx.fillRect(cx + s * 5, cy + s * 16, s * 5, s * 2);
      ctx.fillRect(cx + s * 8, cy + s * 18, s * 4, s * 2);
      ctx.fillRect(cx + s * 10,cy + s * 19, s * 3, s * 2);
      // glow overlay
      if (glow > 0) {
        ctx.fillStyle = "#c084fc";
        ctx.globalAlpha = glow * 0.22;
        ctx.fillRect(cx - s * 8, cy - s * 9, s * 16, s * 28);
        ctx.globalAlpha = 1;
      }
    }

    let bahamutGlow = 0; // 0–1, elevated during summon/megaflare

    let attackAnim:    AttackAnim | null = null;
    let slashFx:       SlashFx   | null = null;
    const floatingNums: FloatingNum[]    = [];
    let enemyFlashTtl  = 0;  // frames remaining for enemy white flash
    let screenFlashAlpha = 0; // 0–1 screen-wide flash
    let magicCircle:    MagicCircle | null = null;
    let megaFlare:      MegaFlare   | null = null;
    let enemyStaggerTtl = 0; // frames of stagger after Mega Flare

    const STEP_FRAMES = 150; // ~2.5 s at 60 fps — gap between events
    let seqStep = 0;

    let t = 0;
    let raf: number;

    const SLASH_COLORS = ["#c084fc", "#e2e8f0", "#fbbf24", "#4ade80"];

    function spawnNum(x: number, y: number, amount: number, heal = false) {
      floatingNums.push({
        x, y,
        text: heal ? `+${amount}` : `-${amount}`,
        color: heal ? "#44ff88" : "#ff4444",
        frame: 0, maxFrame: 90,
      });
    }

    function triggerAttack(memberIdx: number) {
      attackAnim = { memberIdx, frame: 0 };
    }

    function triggerSummonCall() {
      // Magic circle appears near Terra (top member of party column)
      const cw = canvas.width;
      const ch = canvas.height;
      const gY = ch - ATB_H - 4;
      const cx = cw - SPRITE_W - S * 3;
      const cy = gY - TOTAL_PARTY_H + Math.floor(SPRITE_H / 2);
      magicCircle = { cx, cy, frame: 0 };
      bahamutGlow = 0.6;
      // "BAHAMUT!" float above the scene
      floatingNums.push({
        x: Math.floor(cw / 2) - S * 12,
        y: 24,
        text: "BAHAMUT!",
        color: "#c084fc",
        frame: 0,
        maxFrame: 108,
      });
      setTimeout(() => { bahamutGlow = 0; }, 1600);
    }

    function triggerMegaFlare() {
      megaFlare   = { frame: 0 };
      bahamutGlow = 1.0;
    }

    const loop = () => {
      t++;

      // Combat sequence — one event every STEP_FRAMES frames
      const STEPS: Array<() => void> = [
        () => triggerAttack(2),        // Locke attacks
        () => triggerAttack(1),        // Celes attacks
        () => triggerAttack(3),        // Edgar attacks
        () => triggerAttack(2),        // Locke attacks again
        () => triggerSummonCall(),     // Terra summons Bahamut
        () => triggerMegaFlare(),      // MEGA FLARE
        () => triggerAttack(0),        // Terra attacks
        () => triggerAttack(1),        // Celes attacks
      ];

      if (t % STEP_FRAMES === 1) {
        STEPS[seqStep % STEPS.length]();
        seqStep++;
      }

      const { width, height } = canvas;
      const groundY  = height - ATB_H - 4;
      const bxCenter = Math.floor(width / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);

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
      drawMountains(width, groundY, ctx);

      // Ground line
      ctx.fillStyle = "rgba(160,140,220,0.15)";
      ctx.fillRect(0, groundY, width, S);

      // Bahamut (center top, floating)
      const bahamutFloat = Math.round(Math.sin(t * 0.035) * S * 3);
      const bahamutCY   = 20 + bahamutFloat;
      drawBahamut(bxCenter, bahamutCY, bahamutGlow);

      // "BAHAMUT" label
      const namePulse = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.04));
      ctx.globalAlpha = namePulse;
      ctx.fillStyle = "#ffd700";
      ctx.font = `bold ${S * 4}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("BAHAMUT", bxCenter, bahamutCY - S * 16);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";

      // Enemy layout constants (also used by animation tasks)
      const BOSS_W  = 14 * S;
      const BOSS_H  = 28 * S; // includes horns/head above body
      const BOSS_X  = S * 8;
      const WY_H    = 13 * S;
      const WY1_X   = BOSS_X + BOSS_W + S * 14;
      const WY2_X   = WY1_X + 7 * S + S * 10;

      const bossBob = Math.round(Math.sin(t * 0.04) * S * 1.5);
      const bossY   = groundY - BOSS_H + bossBob;

      const staggerX  = enemyStaggerTtl > 0
        ? Math.round(Math.sin(enemyStaggerTtl * 0.9) * S * 2)
        : 0;
      if (enemyStaggerTtl > 0) enemyStaggerTtl--;

      const wy1Bob = Math.round(Math.sin(t * 0.05 + 1.2) * S * 1.5);
      const wy2Bob = Math.round(Math.sin(t * 0.05 + 2.5) * S * 1.5);

      drawDragonBoss(BOSS_X + staggerX, bossY);
      drawWyvern(WY1_X + staggerX, groundY - WY_H + wy1Bob);
      drawWyvern(WY2_X + staggerX, groundY - WY_H + wy2Bob);

      // Layout constants used by multiple draw sections
      const partyX    = width - SPRITE_W - S * 6;
      const partyTopY = groundY - TOTAL_PARTY_H;

      // Party — vertical column with lunge offset for attacking member
      for (let i = 0; i < PARTY.length; i++) {
        const bobY    = Math.round(Math.sin(t * 0.055 + i * 0.7) * S);
        const memberY = partyTopY + i * (SPRITE_H + MEMBER_GAP) + bobY;
        let lungeX    = 0;
        if (attackAnim && attackAnim.memberIdx === i) {
          const f = attackAnim.frame;
          // 0–13: slide left; 13–22: hold at peak; 22–45: return
          if      (f < 14) lungeX = -Math.floor((f / 13) * S * 18);
          else if (f < 23) lungeX = -S * 18;
          else             lungeX = -Math.floor(((45 - f) / 22) * S * 18);
        }
        drawSprite(ctx, PARTY[i], partyX + lungeX, memberY);
      }

      // Advance attack anim — trigger slash/flash at peak frame
      if (attackAnim) {
        if (attackAnim.frame === 13) {
          // peak of lunge: slash appears at boss position
          slashFx = {
            x: BOSS_X + Math.floor(BOSS_W / 2),
            y: groundY - Math.floor(BOSS_H * 0.6),
            frame: 0,
            color: SLASH_COLORS[attackAnim.memberIdx],
          };
          enemyFlashTtl  = 18;
          screenFlashAlpha = 0.16;
          spawnNum(
            BOSS_X + S * 2 + Math.floor(Math.random() * 12),
            groundY - BOSS_H + Math.floor(Math.random() * 10),
            Math.floor(Math.random() * 900 + 200),
          );
        }
        attackAnim.frame++;
        if (attackAnim.frame >= 45) attackAnim = null;
      }

      // Slash effect
      if (slashFx) {
        const progress = slashFx.frame / 33;
        const alpha    = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        const size     = Math.floor(S * 7 * (0.4 + progress * 0.8));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = slashFx.color;
        for (let i = -size; i <= size; i += S) {
          ctx.fillRect(slashFx.x + i, slashFx.y + i, S, S);
          ctx.fillRect(slashFx.x + i, slashFx.y - i, S, S);
        }
        ctx.globalAlpha = 1;
        slashFx.frame++;
        if (slashFx.frame >= 33) slashFx = null;
      }

      // Enemy flash overlay (white rect over boss area)
      if (enemyFlashTtl > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(enemyFlashTtl / 18) * 0.55})`;
        ctx.fillRect(BOSS_X - S * 5, bossY, BOSS_W + S * 10, BOSS_H);
        enemyFlashTtl--;
      }

      // Screen flash (decays each frame)
      if (screenFlashAlpha > 0) {
        ctx.fillStyle = "white";
        ctx.globalAlpha = screenFlashAlpha;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
        screenFlashAlpha = Math.max(0, screenFlashAlpha - 0.022);
      }

      // Floating damage/heal numbers
      for (let i = floatingNums.length - 1; i >= 0; i--) {
        const fn = floatingNums[i];
        const p  = fn.frame / fn.maxFrame;
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle   = fn.color;
        ctx.font        = `bold ${S * 4}px monospace`;
        ctx.fillText(fn.text, fn.x, fn.y - Math.floor(p * S * 16));
        ctx.globalAlpha = 1;
        fn.frame++;
        if (fn.frame >= fn.maxFrame) floatingNums.splice(i, 1);
      }

      // Magic circle (summon call)
      if (magicCircle) {
        const mc       = magicCircle;
        const progress = mc.frame / 108;
        const maxR     = S * 11;
        const radius   = Math.floor(
          maxR * (progress < 0.4 ? progress / 0.4 : 1 + (progress - 0.4) * 0.6),
        );
        const alpha    = progress < 0.4
          ? progress / 0.4
          : 1 - (progress - 0.4) / 0.6;
        ctx.globalAlpha  = alpha * 0.85;
        ctx.strokeStyle  = "#a855f7";
        ctx.lineWidth    = S;
        ctx.beginPath();
        ctx.arc(mc.cx, mc.cy, Math.max(1, radius), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          mc.cx, mc.cy,
          Math.max(1, Math.floor(radius * 0.55)),
          -mc.frame * 0.08,
          Math.PI * 2 - mc.frame * 0.08,
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
        mc.frame++;
        if (mc.frame >= 108) magicCircle = null;
      }

      // Mega Flare beam
      if (megaFlare) {
        const mf       = megaFlare;
        const progress = mf.frame / 84;
        // Beam fires from Bahamut (center) leftward toward enemies
        const beamRight = bxCenter;
        const beamLeft  = BOSS_X - S * 4;
        const beamLen   = beamRight - beamLeft;
        const beamY     = Math.floor(height * 0.38);
        const beamH     = S * 4;

        let pct: number, alpha: number;
        if      (progress < 0.25) { pct = progress / 0.25; alpha = 1; }
        else if (progress < 0.70) { pct = 1;               alpha = 1; }
        else                      { pct = 1;                alpha = 1 - (progress - 0.70) / 0.30; }

        const drawnLeft = Math.floor(beamRight - beamLen * pct);
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle   = "#ff6600";
        ctx.fillRect(drawnLeft, beamY - beamH, beamRight - drawnLeft, beamH * 3);
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = "#ffd700";
        ctx.fillRect(drawnLeft, beamY - beamH / 2, beamRight - drawnLeft, beamH * 2);
        ctx.fillStyle   = "#ffffff";
        ctx.fillRect(drawnLeft, beamY, beamRight - drawnLeft, beamH);
        ctx.globalAlpha = 1;

        // Impact at frame 21 (beam fully reaches enemies)
        if (mf.frame === 21) {
          screenFlashAlpha = 0.65;
          enemyFlashTtl    = 30;
          enemyStaggerTtl  = 40;
          spawnNum(BOSS_X + S * 2, groundY - BOSS_H,     5240);
          spawnNum(WY1_X + S,      groundY - WY_H - S * 4, 3870);
          spawnNum(WY2_X + S,      groundY - WY_H,       3120);
        }

        mf.frame++;
        if (mf.frame >= 84) { megaFlare = null; bahamutGlow = 0; }
      }

      // ATB panel
      const panelY  = height - ATB_H;
      ctx.fillStyle = "rgba(2,2,22,0.94)";
      ctx.fillRect(0, panelY, width, ATB_H);
      ctx.fillStyle = "rgba(120,100,220,0.28)";
      ctx.fillRect(0, panelY, width, 1);

      const slotW    = Math.floor((width - S * 4) / 4);
      const barW     = Math.floor(slotW * 0.72);
      const barH     = 4;
      const HP_FILLS = [0.88, 0.76, 0.93, 0.61];
      const ATB_PERIODS = [192, 163, 138, 228]; // frames per ATB cycle

      for (let i = 0; i < 4; i++) {
        const sx    = S * 2 + i * slotW;
        const nameY = panelY + 13;
        const hpY   = panelY + 22;
        const atbY  = panelY + 32;

        ctx.fillStyle = PARTY_COLORS[i];
        ctx.font      = `bold ${S * 2}px monospace`;
        ctx.fillText(PARTY_NAMES[i], sx, nameY);

        // HP bar
        ctx.fillStyle = "#0f0f1a";
        ctx.fillRect(sx, hpY, barW, barH);
        ctx.fillStyle = PARTY_COLORS[i];
        ctx.fillRect(sx, hpY, Math.floor(barW * HP_FILLS[i]), barH);

        // ATB bar
        ctx.fillStyle = "#0f0f1a";
        ctx.fillRect(sx, atbY, barW, barH);
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(sx, atbY, Math.floor(barW * ((t % ATB_PERIODS[i]) / ATB_PERIODS[i])), barH);

        // Slot divider
        if (i < 3) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(sx + slotW - 1, panelY + 8, 1, ATB_H - 16);
        }
      }

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
