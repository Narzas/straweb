"use client";

import { useEffect, useRef } from "react";

const S = 3; // pixel scale: 1 logical px = 3×3 screen px
const ATB_H = 60; // ATB panel height at canvas bottom

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
interface SpellAnim {
  memberIdx: number;
  spellType: "fire" | "blizzard" | "thunder";
  frame: number; // 0–60
}

type Pixel = [number, number, string];
function px(x: number, y: number, c: string): Pixel { return [x, y, c]; }

// 다크 아웃라인 자동 생성 — FF6/Octopath 스타일 핵심
function drawSpriteWithOutline(
  ctx: CanvasRenderingContext2D,
  pixels: Pixel[],
  ox: number, oy: number,
  scale = S,
) {
  const occupied = new Set<string>(pixels.map(([x, y]) => `${x},${y}`));
  const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  ctx.fillStyle = "#080810";
  for (const [x, y] of pixels) {
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!occupied.has(`${nx},${ny}`)) {
        ctx.fillRect(ox + nx * scale, oy + ny * scale, scale, scale);
      }
    }
  }
  for (const [x, y, color] of pixels) {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
  }
}

// Sprite size: 16w × 24h — Pixel Remaster style, side profile facing left
// x=0 = front (arm/face direction), x=15 = back (hair flows rightward)
const sk  = "#fde8d0"; // skin highlight
const skM = "#f5c8a0"; // skin mid
const skS = "#c8956a"; // skin shadow
const LIP = "#e07878"; // lip tint (both chars)

// Terra — mint hair (6-tone), crimson outfit (5-tone), gold belt, dark boots
const TGH = "#a7f3d0"; // hair highlight
const TGA = "#4ade80"; // hair bright
const TGB = "#22c55e"; // hair mid
const TGM = "#16a34a"; // hair shadow
const TGS = "#166534"; // hair deep
const TGD = "#14532d"; // hair darkest
const TRH = "#fca5a5"; // outfit highlight
const TRA = "#f87171"; // outfit mid-light
const TRB = "#dc2626"; // outfit mid
const TRM = "#b91c1c"; // outfit shadow
const TRS = "#7f1d1d"; // outfit deep
const TBL = "#d97706"; // belt gold
const TPU = "#9333ea"; // skirt purple trim
const TBT = "#292524"; // boot dark
const TBD = "#1c1917"; // boot deepest

const TERRA: Pixel[] = [
  // ── Head & hair ──
  // y=0  hair crown
  px(3,0,TGA),px(4,0,TGB),px(5,0,TGB),px(6,0,TGM),px(7,0,TGM),px(8,0,TGS),px(9,0,TGS),
  // y=1  hair upper — volume bump
  px(2,1,TGH),px(3,1,TGA),px(4,1,TGA),px(5,1,TGB),px(6,1,TGB),px(7,1,TGM),px(8,1,TGS),px(9,1,TGD),px(10,1,TGD),
  // y=2  bangs (x=2-4) + forehead skin + eyebrow (TGM over eye) + hair stream
  px(2,2,TGA),px(3,2,TGB),px(4,2,TGM),   // bangs / eyebrow shadow
  px(5,2,sk), px(6,2,sk),                  // forehead
  px(7,2,TGA),px(8,2,TGB),px(9,2,TGM),px(10,2,TGS),px(11,2,TGD),
  // y=3  eye row — TGH iris, skS eyelid shadow, skin cheek
  px(2,3,TGS),                             // hair framing temple
  px(3,3,skS),                             // eyelid / brow shadow
  px(4,3,TGH),                             // eye iris (bright mint)
  px(5,3,sk), px(6,3,sk),                  // cheek
  px(7,3,TGA),px(8,3,TGB),px(9,3,TGM),px(10,3,TGS),px(11,3,TGD),
  // y=4  nose bridge + cheek + hair
  px(2,4,skS),                             // nose tip shadow (profile)
  px(3,4,sk), px(4,4,sk), px(5,4,sk), px(6,4,skM),  // cheek / jaw
  px(7,4,TGB),px(8,4,TGM),px(9,4,TGS),px(10,4,TGD),
  // y=5  mouth + chin + collar
  px(3,5,sk),                              // chin
  px(4,5,LIP),                             // lip hint
  px(5,5,sk),                              // chin lower
  px(6,5,TRH),                             // collar
  px(7,5,TGA),px(8,5,TGB),px(9,5,TGM),px(10,5,TGS),px(11,5,TGD),

  // ── Neck, shoulder, upper body ──
  // y=6  neck (skin) + shoulder highlight + hair continues long
  px(4,6,sk), px(5,6,skS),                // neck
  px(6,6,TRH),px(7,6,TRA),px(8,6,TRB),   // shoulder
  px(9,6,TGA),px(10,6,TGB),px(11,6,TGM),px(12,6,TGS),px(13,6,TGD),
  // y=7  upper arm (sleeve) + chest highlight + hair
  px(0,7,TRH),px(1,7,TRA),               // arm sleeve highlight
  px(2,7,skM),                             // arm skin gap
  px(3,7,TRH),px(4,7,TRB),px(5,7,TRM),px(6,7,TRS),  // chest
  px(7,7,TGB),px(8,7,TGM),px(9,7,TGS),px(10,7,TGD),px(11,7,TGD),
  // y=8  forearm (skin) + body + hair
  px(0,8,sk), px(1,8,skS),               // forearm
  px(2,8,TRH),px(3,8,TRA),px(4,8,TRB),px(5,8,TRM),px(6,8,TRS),
  px(7,8,TGB),px(8,8,TGM),px(9,8,TGS),px(10,8,TGD),
  // y=9  wrist + body mid + hair tail
  px(0,9,sk), px(1,9,skS),
  px(2,9,TRH),px(3,9,TRA),px(4,9,TRB),px(5,9,TRM),px(6,9,TRS),
  px(7,9,TGM),px(8,9,TGS),px(9,9,TGD),
  // y=10 hand / closed fist + body
  px(0,10,sk), px(1,10,skS),             // fist top
  px(2,10,TRH),px(3,10,TRA),px(4,10,TRB),px(5,10,TRM),px(6,10,TRS),
  // y=11 finger hint + belly
  px(0,11,skS),                           // finger shadow
  px(2,11,TRH),px(3,11,TRA),px(4,11,TRB),px(5,11,TRM),px(6,11,TRS),

  // ── Belt, hips, skirt ──
  // y=12 gold belt
  px(2,12,TBL),px(3,12,TBL),px(4,12,TBL),px(5,12,TBL),px(6,12,TRM),
  // y=13 hips + purple trim start
  px(1,13,TRH),px(2,13,TRA),px(3,13,TRB),px(4,13,TRM),px(5,13,TRS),px(6,13,TPU),
  // y=14 skirt
  px(1,14,TRH),px(2,14,TRA),px(3,14,TRB),px(4,14,TRM),px(5,14,TPU),
  // y=15 skirt lower (tapers)
  px(2,15,TRH),px(3,15,TRA),px(4,15,TRM),px(5,15,TPU),

  // ── Legs — near leg (lower x, lighter) / far leg (higher x, darker) ──
  // y=16 upper thigh — split legs visible
  px(2,16,sk), px(3,16,sk),              // near leg
  px(4,16,skS),                           // leg gap / inner shadow
  px(5,16,TBT),px(6,16,TBD),             // far leg (boot top)
  // y=17 knee — slight forward knee bend hint
  px(2,17,sk), px(3,17,skM),
  px(4,17,TBT),px(5,17,TBD),
  // y=18 lower leg
  px(2,18,sk), px(3,18,skS),
  px(4,18,TBT),px(5,18,TBD),

  // ── Boots ──
  // y=19 boot cuff line
  px(2,19,TBT),px(3,19,TBT),px(4,19,TBT),px(5,19,TBD),
  // y=20 boot shaft
  px(2,20,TBT),px(3,20,TBT),px(4,20,TBD),
  // y=21 boot wider calf
  px(1,21,TBT),px(2,21,TBT),px(3,21,TBT),px(4,21,TBD),
  // y=22 boot lower
  px(1,22,TBT),px(2,22,TBT),px(3,22,TBD),
  // y=23 sole (flat, wider)
  px(0,23,TBT),px(1,23,TBT),px(2,23,TBT),px(3,23,TBT),px(4,23,TBD),px(5,23,TBD),
];

// Celes — silver hair (6-tone), white+blue armor (5-tone), gold trim, navy boots
const CYH = "#f8fafc"; // hair highlight (almost white)
const CYA = "#e2e8f0"; // hair bright
const CYB = "#94a3b8"; // hair mid
const CYM = "#64748b"; // hair shadow
const CYS = "#475569"; // hair deep
const CYD = "#1e293b"; // hair darkest
const CAH = "#ffffff";  // armor highlight
const CAA = "#dbeafe";  // armor light blue
const CAB = "#bfdbfe";  // armor mid blue
const CAM = "#93c5fd";  // armor mid-shadow
const CAS = "#3b82f6";  // armor shadow
const CEY = "#1d4ed8";  // eye (deep royal blue)
const CGD = "#fbbf24";  // gold trim
const CBT = "#1e3a8a";  // navy boot
const CBM = "#1d4ed8";  // navy boot mid

const CELES: Pixel[] = [
  // ── Head & hair ──
  // y=0  hair crown (tight, neat — Celes is more formal)
  px(4,0,CYA),px(5,0,CYA),px(6,0,CYB),px(7,0,CYB),px(8,0,CYM),px(9,0,CYS),
  // y=1  hair upper — subtle highlight center
  px(3,1,CYH),px(4,1,CYH),px(5,1,CYA),px(6,1,CYA),px(7,1,CYB),px(8,1,CYM),px(9,1,CYS),px(10,1,CYD),
  // y=2  temple / side hair + forehead + eyebrow (CYM = darker silver) + stream
  px(3,2,CYB),px(4,2,CYA),              // temple
  px(5,2,sk), px(6,2,sk),               // forehead
  px(7,2,CYA),px(8,2,CYA),px(9,2,CYB),px(10,2,CYM),px(11,2,CYS),px(12,2,CYD),
  // y=3  eye row — CEY iris at x=5, skS eyelid at x=4
  px(3,3,CYS),                          // hair shadow
  px(4,3,skS),                          // eyelid shadow
  px(5,3,CEY),                          // eye (royal blue)
  px(6,3,sk), px(7,3,sk),               // cheek
  px(8,3,CYB),px(9,3,CYM),px(10,3,CYS),px(11,3,CYD),
  // y=4  nose shadow + cheek + hair
  px(3,4,skS),                          // nose tip
  px(4,4,sk), px(5,4,sk), px(6,4,sk), px(7,4,skM),  // cheek
  px(8,4,CYB),px(9,4,CYM),px(10,4,CYS),px(11,4,CYD),
  // y=5  mouth + chin + armor collar
  px(4,5,sk),                           // chin
  px(5,5,LIP),                          // lip hint
  px(6,5,CAH),px(7,5,CAA),              // collar
  px(8,5,CYH),px(9,5,CYA),px(10,5,CYB),px(11,5,CYM),

  // ── Neck, pauldron, upper body ──
  // y=6  neck + shoulder pauldron (wider) + hair
  px(4,6,sk), px(5,6,skS),             // neck
  px(6,6,CAH),px(7,6,CAA),px(8,6,CAB),// pauldron
  px(9,6,CYH),px(10,6,CYA),px(11,6,CYB),px(12,6,CYM),px(13,6,CYS),px(14,6,CYD),
  // y=7  arm (armored gauntlet) + chest armor + hair stream
  px(0,7,CAH),px(1,7,CAA),px(2,7,CAB),// gauntlet highlight
  px(3,7,CAH),px(4,7,CAB),px(5,7,CAM),px(6,7,CAS),  // chest armor
  px(7,7,CYA),px(8,7,CYB),px(9,7,CYM),px(10,7,CYS),px(11,7,CYD),px(12,7,CYD),
  // y=8  forearm skin + armor + long hair
  px(0,8,sk), px(1,8,skS),
  px(2,8,CAH),px(3,8,CAA),px(4,8,CAB),px(5,8,CAM),px(6,8,CAS),
  px(7,8,CYA),px(8,8,CYB),px(9,8,CYM),px(10,8,CYS),px(11,8,CYD),
  // y=9  wrist + armor body + hair tail
  px(0,9,sk), px(1,9,skS),
  px(2,9,CAH),px(3,9,CAA),px(4,9,CAB),px(5,9,CAM),px(6,9,CAS),
  px(7,9,CYB),px(8,9,CYM),px(9,9,CYS),px(10,9,CYD),
  // y=10 hand / fist + gold accent stripe
  px(0,10,sk), px(1,10,skS),           // fist
  px(2,10,CGD),px(3,10,CGD),           // gold trim accent
  px(4,10,CAA),px(5,10,CAB),px(6,10,CAM),
  // y=11 finger + lower armor
  px(0,11,skS),                         // finger shadow
  px(1,11,CGD),px(2,11,CGD),           // gold row
  px(3,11,CAA),px(4,11,CAB),px(5,11,CAM),px(6,11,CAS),

  // ── Gold belt, hips, armored skirt ──
  // y=12 gold belt
  px(1,12,CGD),px(2,12,CGD),px(3,12,CGD),px(4,12,CGD),px(5,12,CGD),px(6,12,CAM),
  // y=13 hip armor plates
  px(1,13,CAH),px(2,13,CAA),px(3,13,CAB),px(4,13,CAM),px(5,13,CAS),px(6,13,CBT),
  // y=14 armored skirt
  px(1,14,CAA),px(2,14,CAB),px(3,14,CAM),px(4,14,CAS),px(5,14,CBT),
  // y=15 skirt lower (narrower)
  px(2,15,CAB),px(3,15,CAM),px(4,15,CAS),px(5,15,CBT),

  // ── Legs — near (lower x) / far (higher x) ──
  // y=16 upper thigh split
  px(2,16,sk), px(3,16,sk),            // near leg
  px(4,16,skS),                         // shadow gap
  px(5,16,CBT),px(6,16,CBM),           // far leg (boot)
  // y=17 knee
  px(2,17,sk), px(3,17,skM),
  px(4,17,CBT),px(5,17,CBM),
  // y=18 lower leg
  px(2,18,sk), px(3,18,skS),
  px(4,18,CBT),px(5,18,CBM),

  // ── Boots (navy) ──
  // y=19 boot cuff
  px(2,19,CBT),px(3,19,CBT),px(4,19,CBT),px(5,19,CBM),
  // y=20 boot shaft
  px(1,20,CBT),px(2,20,CBT),px(3,20,CBM),
  // y=21 boot
  px(1,21,CBT),px(2,21,CBT),px(3,21,CBM),
  // y=22 boot lower
  px(0,22,CBT),px(1,22,CBT),px(2,22,CBM),
  // y=23 sole
  px(0,23,CBT),px(1,23,CBT),px(2,23,CBT),px(3,23,CBM),px(4,23,CBM),px(5,23,CBT),
];

const PARTY        = [TERRA, CELES];
const PARTY_NAMES  = ["TERRA", "CELES"];
const PARTY_COLORS = ["#22c55e", "#93c5fd"];
const SPRITE_W     = 16 * S;
const SPRITE_H     = 24 * S;
const MEMBER_GAP   = S * 3;
const TOTAL_PARTY_H = PARTY.length * SPRITE_H + (PARTY.length - 1) * MEMBER_GAP;

export default function HeroBattleScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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

    function drawMountainLayer(
      w: number, groundY: number,
      cols: [number, number][],
      color: string,
    ) {
      ctx.fillStyle = color;
      for (let i = 0; i < cols.length - 1; i++) {
        const [ax, ay] = cols[i];
        const [bx]     = cols[i + 1];
        const midX  = Math.floor(((ax + bx) / 2) * w);
        const leftX = Math.floor(ax * w);
        const rightX= Math.floor(bx * w);
        const peakY = Math.floor(ay * groundY);
        for (let y = peakY; y <= groundY; y += S) {
          const p = (y - peakY) / (groundY - peakY);
          const rl = Math.floor(midX + (leftX  - midX) * p);
          const rr = Math.floor(midX + (rightX - midX) * p);
          ctx.fillRect(rl, y, rr - rl, S);
        }
      }
    }

    function drawMountains(w: number, groundY: number) {
      // 원경: 가장 높고 어두움
      drawMountainLayer(w, groundY, [
        [0,0.44],[0.12,0.34],[0.25,0.46],[0.38,0.36],
        [0.51,0.47],[0.64,0.35],[0.77,0.48],[0.90,0.37],[1.0,0.50],
      ], "#090d18");
      // 중경: 기존 산 (약간 밝음)
      drawMountainLayer(w, groundY, [
        [0,0.66],[0.14,0.55],[0.28,0.67],[0.42,0.57],
        [0.56,0.68],[0.70,0.56],[0.84,0.69],[1.0,0.73],
      ], "#0e1624");
      // 중경2: 두 번째 색조로 입체감
      drawMountainLayer(w, groundY, [
        [0,0.70],[0.18,0.62],[0.35,0.71],[0.52,0.63],
        [0.69,0.72],[0.86,0.64],[1.0,0.75],
      ], "#121c30");
      // 근경: 어둡고 낮은 실루엣
      drawMountainLayer(w, groundY, [
        [0,0.82],[0.20,0.76],[0.40,0.83],[0.60,0.77],[0.80,0.84],[1.0,0.79],
      ], "#0b0f1e");
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

    // Sword swing overlay — drawn on top of the attacking character sprite
    function drawWeaponSwing(sx: number, sy: number, memberIdx: number, frame: number) {
      if (frame >= 32) return;

      const blade    = memberIdx === 0 ? "#c0a0ff" : "#7ec8f8"; // Terra purple / Celes blue tint
      const bladeHi  = "#eef4ff";
      const guardCol = memberIdx === 0 ? "#fde68a" : "#7dd3fc";
      const handleCol = "#78350f";

      // Hand anchor: front edge (x=0, character faces left), arm level y=7
      const hx = sx;
      const hy = sy + S * 7;
      const bladeLen = 6;

      // Angle sweeps from −90° (up) → −180° (left) during lunge, stays at −180° at peak
      let angle: number;
      let alpha = 1.0;
      if (frame < 14) {
        angle = -Math.PI / 2 - (frame / 13) * (Math.PI / 2);
      } else if (frame < 23) {
        angle = -Math.PI;
      } else {
        angle = -Math.PI;
        alpha = 1 - (frame - 22) / 10;
      }

      ctx.globalAlpha = alpha;

      // Blade (tip brightest)
      for (let seg = bladeLen; seg >= 1; seg--) {
        const bx = Math.round(hx + Math.cos(angle) * seg * S * 1.5);
        const by = Math.round(hy + Math.sin(angle) * seg * S * 1.5);
        ctx.fillStyle = seg === bladeLen ? bladeHi : blade;
        ctx.fillRect(bx, by, S, S);
      }
      // Guard (perpendicular to blade)
      const perpAngle = angle + Math.PI / 2;
      ctx.fillStyle = guardCol;
      for (let g = -1; g <= 1; g++) {
        const gx = Math.round(hx + Math.cos(perpAngle) * g * S * 1.5);
        const gy = Math.round(hy + Math.sin(perpAngle) * g * S * 1.5);
        ctx.fillRect(gx, gy, S, S);
      }
      // Handle (opposite direction from blade)
      ctx.fillStyle = handleCol;
      for (let h = 0; h < 3; h++) {
        const hbx = Math.round(hx - Math.cos(angle) * h * S);
        const hby = Math.round(hy - Math.sin(angle) * h * S);
        ctx.fillRect(hbx, hby, S, S);
      }
      ctx.globalAlpha = 1;
    }

    // Magic charge aura — orbiting particles while casting wind-up
    function drawMagicCharge(sx: number, sy: number, spellType: "fire" | "blizzard" | "thunder", frame: number) {
      if (frame > 35) return;

      const color = spellType === "fire"     ? "#fb923c"
                  : spellType === "blizzard" ? "#67e8f9"
                  : "#fde047";
      const inner = spellType === "fire"     ? "#fff7ed"
                  : spellType === "blizzard" ? "#e0f9ff"
                  : "#fefce8";

      const cx = sx + SPRITE_W / 2;
      const cy = sy + SPRITE_H * 0.52;

      const fadeIn  = Math.min(1, frame / 12);
      const fadeOut = frame > 25 ? 1 - (frame - 25) / 10 : 1;
      const alpha   = fadeIn * fadeOut;

      // 4 orbiting dots in an ellipse around the character
      for (let p = 0; p < 4; p++) {
        const a = t * 0.12 + p * (Math.PI / 2);
        const r = S * 8;
        const px2 = cx + Math.round(Math.cos(a) * r);
        const py2 = cy + Math.round(Math.sin(a) * r * 0.55); // flattened ellipse
        ctx.globalAlpha = alpha * 0.88;
        ctx.fillStyle = color;
        ctx.fillRect(px2 - S, py2 - S, S * 2, S * 2);
        ctx.fillStyle = inner;
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillRect(px2, py2, S, S);
      }
      // Hand/arm glow (front of character at arm level)
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = color;
      ctx.fillRect(sx, sy + S * 7, S * 4, S * 3);
      ctx.globalAlpha = 1;
    }

    let bahamutGlow = 0; // 0–1, elevated during summon/megaflare

    let attackAnim:    AttackAnim | null = null;
    let slashFx:       SlashFx   | null = null;
    const floatingNums: FloatingNum[]    = [];
    let enemyFlashTtl  = 0;
    let screenFlashAlpha = 0;
    let screenFlashColor = "white";
    let magicCircle:    MagicCircle | null = null;
    let megaFlare:      MegaFlare   | null = null;
    let enemyStaggerTtl = 0;
    let spellAnim:      SpellAnim   | null = null;

    // ATB 시스템 — 둘 다 꽉 차야 행동, 순서대로 실행 후 동시 리셋
    const ATB_PERIODS = [780, 660]; // Terra 13s / Celes 11s
    const atbCounters = [0, 0];
    let actionQueue: number[]  = []; // 행동 대기 멤버 인덱스
    let bothReadyTriggered     = false; // 둘 다 풀 → 한 번만 트리거
    let summonCooldown = 0;
    let megaFlareCountdown = 0;

    let t = 0;
    let raf: number;

    const SLASH_COLORS = ["#c084fc", "#93c5fd"];
    const SPELL_NAMES  = { fire: "FIRE", blizzard: "BLIZZARA", thunder: "THUNDER" };

    function spawnNum(x: number, y: number, amount: number, heal = false) {
      floatingNums.push({
        x, y,
        text: heal ? `+${amount}` : `-${amount}`,
        color: heal ? "#44ff88" : "#ff4444",
        frame: 0, maxFrame: 90,
      });
    }

    function triggerAttack(memberIdx: number): boolean {
      if (attackAnim || spellAnim) return false;
      attackAnim = { memberIdx, frame: 0 };
      return true;
    }

    function triggerSpell(memberIdx: number, spellType: "fire" | "blizzard" | "thunder"): boolean {
      if (attackAnim || spellAnim) return false;
      spellAnim = { memberIdx, spellType, frame: 0 };
      // 주문명 플로팅 텍스트
      const cw = canvas.width;
      const ch = canvas.height;
      const gY = ch - ATB_H - 4;
      const sy = gY - TOTAL_PARTY_H + memberIdx * (SPRITE_H + MEMBER_GAP);
      floatingNums.push({
        x: cw - SPRITE_W - S * 14,
        y: sy,
        text: SPELL_NAMES[spellType],
        color: spellType === "fire" ? "#fb923c"
             : spellType === "blizzard" ? "#67e8f9"
             : "#fde047",
        frame: 0, maxFrame: 70,
      });
      return true;
    }

    function triggerSummonCall() {
      const cw = canvas.width;
      const ch = canvas.height;
      const gY = ch - ATB_H - 4;
      const cx = cw - SPRITE_W - S * 3;
      const cy = gY - TOTAL_PARTY_H + Math.floor(SPRITE_H / 2);
      magicCircle = { cx, cy, frame: 0 };
      bahamutGlow = 0.6;
      floatingNums.push({
        x: Math.floor(cw / 2) - S * 12,
        y: 24,
        text: "BAHAMUT!",
        color: "#c084fc",
        frame: 0,
        maxFrame: 108,
      });
      megaFlareCountdown = 180; // 3초 후 MegaFlare
      setTimeout(() => { bahamutGlow = Math.max(bahamutGlow - 0.1, 0); }, 1600);
    }

    function triggerMegaFlare() {
      megaFlare   = { frame: 0 };
      bahamutGlow = 1.0;
    }

    // ATB 꽉 찼을 때 캐릭터별 행동 결정 — 성공 여부 반환
    function triggerCharacterAction(idx: number): boolean {
      if (attackAnim || spellAnim) return false;
      const roll = Math.random();
      if (idx === 0) {
        // Terra: Fire 40% / 소환 25% (쿨다운 없을 때) / 물리 35%
        if (summonCooldown === 0 && roll < 0.25) {
          triggerSummonCall();
          summonCooldown = 1400;
          return true;
        } else if (roll < 0.65) {
          return triggerSpell(0, "fire");
        } else {
          return triggerAttack(0);
        }
      } else {
        // Celes: Blizzara 60% / 물리 40%
        if (roll < 0.6) return triggerSpell(1, "blizzard");
        else return triggerAttack(1);
      }
    }

    const loop = () => {
      t++;

      // ── ATB 증가 (각자 채움, 풀이 되면 상한에서 대기) ─────────
      for (let i = 0; i < 2; i++) {
        if (atbCounters[i] < ATB_PERIODS[i]) atbCounters[i]++;
      }

      // ── 둘 다 풀 → 행동 큐 구성 (한 번만) ──────────────────────
      const bothFull = atbCounters[0] >= ATB_PERIODS[0] && atbCounters[1] >= ATB_PERIODS[1];
      if (bothFull && !bothReadyTriggered) {
        bothReadyTriggered = true;
        actionQueue = [0, 1]; // Terra 선공, Celes 후공
      }

      // ── 큐 처리 — 애니메이션 없을 때 다음 행동 실행 ────────────
      const isBusy = !!(attackAnim || spellAnim || magicCircle || megaFlare || megaFlareCountdown > 0);
      if (actionQueue.length > 0 && !isBusy) {
        const next  = actionQueue[0];
        const acted = triggerCharacterAction(next);
        if (acted) actionQueue.shift();
      }

      // ── 큐 소진 + 애니 끝 → 두 ATB 동시 리셋 ──────────────────
      if (bothReadyTriggered && actionQueue.length === 0 && !isBusy) {
        atbCounters[0]     = 0;
        atbCounters[1]     = 0;
        bothReadyTriggered = false;
      }

      if (summonCooldown > 0) summonCooldown--;
      if (megaFlareCountdown > 0) {
        megaFlareCountdown--;
        if (megaFlareCountdown === 0) triggerMegaFlare();
      }

      const { width, height } = canvas;
      const groundY  = height - ATB_H - 4;
      const bxCenter = Math.floor(width / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);

      // 하늘 그라디언트 — 상단 칠흑 → 지평선 보라빛
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0,   "#040710");
      skyGrad.addColorStop(0.6, "#090d1c");
      skyGrad.addColorStop(1,   "#0f1430");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, groundY);

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

      // Mountains (3-layer depth)
      drawMountains(width, groundY);

      // Ground glow
      ctx.fillStyle = "rgba(80,60,180,0.10)";
      ctx.fillRect(0, groundY - S * 2, width, S * 2);
      ctx.fillStyle = "rgba(120,100,220,0.22)";
      ctx.fillRect(0, groundY, width, S);
      ctx.fillStyle = "rgba(60,40,140,0.10)";
      ctx.fillRect(0, groundY + S, width, S);

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
        // ATB FULL → pulsing gold border (waiting or about to act)
        if (atbCounters[i] >= ATB_PERIODS[i]) {
          const gPulse = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.18));
          ctx.globalAlpha = gPulse;
          ctx.fillStyle = "#ffd700";
          const gx = partyX + lungeX - S;
          const gy = memberY - S;
          const gw = SPRITE_W + S * 2;
          const gh = SPRITE_H + S * 2;
          ctx.fillRect(gx,          gy,          gw, S);  // top
          ctx.fillRect(gx,          gy + gh - S, gw, S);  // bottom
          ctx.fillRect(gx,          gy,          S,  gh);  // left
          ctx.fillRect(gx + gw - S, gy,          S,  gh);  // right
          ctx.globalAlpha = 1;
        }

        drawSpriteWithOutline(ctx, PARTY[i], partyX + lungeX, memberY);

        // Weapon swing overlay during physical attack
        if (attackAnim && attackAnim.memberIdx === i) {
          drawWeaponSwing(partyX + lungeX, memberY, i, attackAnim.frame);
        }
        // Magic charge aura during spell cast
        if (spellAnim && spellAnim.memberIdx === i) {
          drawMagicCharge(partyX + lungeX, memberY, spellAnim.spellType, spellAnim.frame);
        }
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
        ctx.fillStyle = screenFlashColor;
        ctx.globalAlpha = screenFlashAlpha;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
        screenFlashAlpha = Math.max(0, screenFlashAlpha - 0.022);
      }

      // ── 마법 이펙트 ──────────────────────────────────
      if (spellAnim) {
        const sp      = spellAnim;
        const prog    = sp.frame / 60;
        const memberY = partyTopY + sp.memberIdx * (SPRITE_H + MEMBER_GAP) + SPRITE_H / 2;
        const beamRight = partyX - S * 2;
        const beamLeft  = BOSS_X + BOSS_W / 2;
        const beamLen   = beamRight - beamLeft;

        if (sp.spellType === "fire") {
          // 오렌지/빨간 수평 빔, 오른쪽→왼쪽
          const reach = Math.min(1, prog / 0.4);
          const fade  = prog > 0.7 ? 1 - (prog - 0.7) / 0.3 : 1;
          const drawn = Math.floor(beamRight - beamLen * reach);
          ctx.globalAlpha = fade * 0.9;
          ctx.fillStyle = "#ff6600";
          ctx.fillRect(drawn, memberY - S * 2, beamRight - drawn, S * 4);
          ctx.fillStyle = "#ff4400";
          ctx.fillRect(drawn, memberY - S, beamRight - drawn, S * 2);
          ctx.fillStyle = "#fff0a0";
          ctx.fillRect(drawn, memberY, beamRight - drawn, S);
          ctx.globalAlpha = 1;
          // 충격 파티클 (reach=1 이후)
          if (reach >= 1) {
            for (let p = 0; p < 5; p++) {
              const px2 = beamLeft + Math.round(Math.sin(t * 0.7 + p) * S * 4);
              const py2 = memberY  + Math.round(Math.cos(t * 0.5 + p) * S * 4);
              ctx.globalAlpha = fade * 0.7;
              ctx.fillStyle = "#ff8800";
              ctx.fillRect(px2, py2, S * 2, S * 2);
            }
            ctx.globalAlpha = 1;
          }
          // 충격 프레임
          if (sp.frame === Math.floor(60 * 0.4)) {
            screenFlashAlpha = 0.25;
            screenFlashColor = "#ff6600";
            enemyFlashTtl = 16;
            spawnNum(BOSS_X + S * 2, groundY - BOSS_H, Math.floor(Math.random() * 800 + 400));
          }

        } else if (sp.spellType === "blizzard") {
          // 파란/시안 빔
          const reach = Math.min(1, prog / 0.4);
          const fade  = prog > 0.7 ? 1 - (prog - 0.7) / 0.3 : 1;
          const drawn = Math.floor(beamRight - beamLen * reach);
          ctx.globalAlpha = fade * 0.85;
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(drawn, memberY - S * 2, beamRight - drawn, S * 4);
          ctx.fillStyle = "#0ea5e9";
          ctx.fillRect(drawn, memberY - S, beamRight - drawn, S * 2);
          ctx.fillStyle = "#e0f7ff";
          ctx.fillRect(drawn, memberY, beamRight - drawn, S);
          ctx.globalAlpha = 1;
          // 얼음 파편
          if (reach >= 1) {
            for (let p = 0; p < 4; p++) {
              const angle = t * 0.4 + p * (Math.PI / 2);
              const px2 = beamLeft + Math.round(Math.cos(angle) * S * 5);
              const py2 = memberY  + Math.round(Math.sin(angle) * S * 5);
              ctx.globalAlpha = fade * 0.8;
              ctx.fillStyle = "#bfdbfe";
              ctx.fillRect(px2, py2, S, S * 3);
            }
            ctx.globalAlpha = 1;
          }
          if (sp.frame === Math.floor(60 * 0.4)) {
            screenFlashAlpha = 0.22;
            screenFlashColor = "#67e8f9";
            enemyFlashTtl = 14;
            spawnNum(BOSS_X + S * 2, groundY - BOSS_H, Math.floor(Math.random() * 700 + 300));
          }

        } else if (sp.spellType === "thunder") {
          // 수직 번개 볼트 (하늘 → 보스)
          const boltX   = BOSS_X + Math.floor(BOSS_W / 2);
          const boltTop = 0;
          const boltBot = groundY - Math.floor(BOSS_H * 0.5);
          const boltH   = boltBot - boltTop;
          const reach   = Math.min(1, prog / 0.3);
          const fade    = prog > 0.6 ? 1 - (prog - 0.6) / 0.4 : 1;
          const drawBot = Math.floor(boltTop + boltH * reach);
          // 번개 지그재그
          const segs = 8;
          ctx.globalAlpha = fade;
          for (let seg = 0; seg < segs; seg++) {
            const y1 = Math.floor(boltTop + (boltH * reach * seg) / segs);
            const y2 = Math.floor(boltTop + (boltH * reach * (seg + 1)) / segs);
            if (y2 > drawBot) break;
            const jitter = Math.round(Math.sin(t * 2 + seg * 3) * S * 3);
            ctx.fillStyle = "#fffde7";
            ctx.fillRect(boltX + jitter - S, y1, S * 3, y2 - y1);
            ctx.fillStyle = "#fde047";
            ctx.fillRect(boltX + jitter, y1, S, y2 - y1);
          }
          ctx.globalAlpha = 1;
          if (sp.frame === Math.floor(60 * 0.3)) {
            screenFlashAlpha = 0.3;
            screenFlashColor = "#fef08a";
            enemyFlashTtl = 20;
            enemyStaggerTtl = 25;
            spawnNum(BOSS_X + S * 2, groundY - BOSS_H, Math.floor(Math.random() * 1000 + 500));
          }
        }

        sp.frame++;
        if (sp.frame >= 60) spellAnim = null;
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

      // ── FF6-style ATB panel ─────────────────────────────────────
      const panelY = height - ATB_H;

      // Panel background
      ctx.fillStyle = "#020216";
      ctx.fillRect(0, panelY, width, ATB_H);
      // Top accent
      ctx.fillStyle = "rgba(70,55,200,0.50)";
      ctx.fillRect(0, panelY, width, 2);
      ctx.fillStyle = "#253a72";
      ctx.fillRect(0, panelY + 2, width, 1);

      // Layout constants
      const HP_VALS   = [1760, 1313];
      const HP_FILLS  = [0.88, 0.76];
      const slotW     = Math.floor((width - S * 4) / 2);
      const LBL_W     = 22;  // px reserved for "HP"/"ATB" label
      const NUM_W     = 38;  // px reserved for hp number on the right
      const GAP       = 4;
      const rowBarW   = slotW - LBL_W - NUM_W - GAP * 2; // bar pixel width
      // Vertical centres for each row inside the panel
      const NAME_Y    = panelY + 14; // baseline (11px font → top ≈ panelY+4)
      const HP_CY     = panelY + 29; // bar & label vertically centred here
      const ATB_CY    = panelY + 48; // bar & label vertically centred here
      const HP_BAR_H  = 8;
      const ATB_BAR_H = 10;

      for (let i = 0; i < 2; i++) {
        const sx     = S * 2 + i * slotW;
        const barX   = sx + LBL_W;           // bar left edge
        const numX   = barX + rowBarW + GAP; // number left edge (right-aligned to numX+NUM_W)
        const isFull = atbCounters[i] >= ATB_PERIODS[i];

        // ── Name ────────────────────────────────────────────────
        const nameFlash = isFull && (t % 20 < 10);
        ctx.font         = "bold 11px monospace";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle    = nameFlash ? "#ffffff" : PARTY_COLORS[i];
        ctx.fillText(PARTY_NAMES[i], sx, NAME_Y);

        // ── HP row ──────────────────────────────────────────────
        const hpBarT  = HP_CY - Math.floor(HP_BAR_H / 2);
        const hpFill  = HP_FILLS[i];
        const hpFillW = Math.floor(rowBarW * hpFill);
        const hpColor = hpFill > 0.5 ? "#22c55e" : hpFill > 0.25 ? "#eab308" : "#ef4444";

        // "HP" label — centred on HP_CY
        ctx.font         = "bold 8px monospace";
        ctx.textBaseline = "middle";
        ctx.fillStyle    = "#4ade80";
        ctx.fillText("HP", sx, HP_CY);

        // bar border → bg → fill → shine
        ctx.fillStyle = "#080820";
        ctx.fillRect(barX - 1, hpBarT - 1, rowBarW + 2, HP_BAR_H + 2);
        ctx.fillStyle = "#050512";
        ctx.fillRect(barX, hpBarT, rowBarW, HP_BAR_H);
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, hpBarT, hpFillW, HP_BAR_H);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(barX, hpBarT, hpFillW, 2);

        // HP number — right-aligned, centred on HP_CY
        ctx.font         = "bold 9px monospace";
        ctx.textBaseline = "middle";
        ctx.fillStyle    = "#e2e8f0";
        ctx.textAlign    = "right";
        ctx.fillText(String(HP_VALS[i]), numX + NUM_W, HP_CY);
        ctx.textAlign    = "left";

        // ── ATB row ─────────────────────────────────────────────
        const atbFill  = Math.min(1, atbCounters[i] / ATB_PERIODS[i]);
        const atbBarT  = ATB_CY - Math.floor(ATB_BAR_H / 2);
        const atbFillW = Math.floor(rowBarW * atbFill);
        const atbColor = isFull ? (t % 10 < 5 ? "#ffffff" : "#ffd700") : "#ffd700";

        // "ATB" label — centred on ATB_CY
        ctx.font         = "bold 8px monospace";
        ctx.textBaseline = "middle";
        ctx.fillStyle    = isFull ? (t % 20 < 10 ? "#ffffff" : "#ffd700") : "#fbbf24";
        ctx.fillText("ATB", sx, ATB_CY);

        // bar border → bg → fill → shine
        ctx.fillStyle = "#080820";
        ctx.fillRect(barX - 1, atbBarT - 1, rowBarW + 2, ATB_BAR_H + 2);
        ctx.fillStyle = "#050512";
        ctx.fillRect(barX, atbBarT, rowBarW, ATB_BAR_H);
        ctx.fillStyle = atbColor;
        ctx.fillRect(barX, atbBarT, atbFillW, ATB_BAR_H);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.fillRect(barX, atbBarT, atbFillW, 2);

        // 4-segment dividers
        ctx.fillStyle = "rgba(0,0,18,0.65)";
        for (let seg = 1; seg < 4; seg++) {
          ctx.fillRect(barX + Math.floor(rowBarW * seg / 4), atbBarT, 1, ATB_BAR_H);
        }

        // READY! — same row as ATB bar, right of number column
        if (isFull) {
          ctx.font         = "bold 8px monospace";
          ctx.textBaseline = "middle";
          ctx.fillStyle    = t % 20 < 10 ? "#ffffff" : "#ffd700";
          ctx.textAlign    = "right";
          ctx.fillText("READY!", numX + NUM_W, ATB_CY);
          ctx.textAlign    = "left";
        }

        // Slot divider
        if (i < 1) {
          ctx.fillStyle = "rgba(60,50,150,0.30)";
          ctx.fillRect(sx + slotW - 1, panelY + 5, 1, ATB_H - 10);
        }
      }

      ctx.textBaseline = "alphabetic";

      raf = requestAnimationFrame(loop);
    };

    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (visible) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="FF6 스타일 픽셀 아트 배틀씬 애니메이션"
      className="pixel-canvas pointer-events-none block w-full"
      style={{ height: "252px", opacity: 0.9 }}
    />
  );
}
