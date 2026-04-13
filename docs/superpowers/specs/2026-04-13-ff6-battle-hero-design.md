# FF6 Battle Scene Hero Section — Design Spec

**Date:** 2026-04-13  
**Status:** Approved by user  
**Replaces:** `components/HeroDotGrid.tsx` (canvas walking pixel character)

---

## Overview

Replace the hero section's walking pixel character with a Final Fantasy 6–style battle scene rendered on an HTML5 canvas using pixel art. The scene plays as a looping, self-contained animation — no user interaction required.

---

## Scene Layout

```
┌─────────────────────────────────────────────────────────┐
│  ★  ★     ★        [BAHAMUT]         ★       ★        │  ← sky / stars
│                    (floating dragon)                     │
│  [Dragon Boss]   [wyvern][wyvern]        [Terra  ]      │  ← battle ground
│                                          [Celes  ]      │
│                                          [Locke  ]      │
│                                          [Edgar  ]      │
├── mountain silhouette ───────────────────────────────────┤  ← ground line
│ TERRA ████░ ▓▓▓░  CELES ████░ ▓▓░  LOCKE ████ ▓▓▓▓  EDGAR ███░ ▓░  -5240 │
└─────────────────────────────────────────────────────────┘  ← ATB panel
```

**Left side — Enemies:**
- 1 large dragon boss (blue/dark, wings, scales, glowing red eyes, teeth, claws)
- 2 small wyverns (same color family, smaller)

**Center-top — Summon:**
- "BAHAMUT" text (gold, glowing pulse)
- Bahamut dragon sprite floating/rotating

**Right side — Party (vertical column, top→bottom):**
1. Terra — female mage, green ponytail, purple robe, staff
2. Celes — female knight, blonde, silver armor, blue cape, sword
3. Locke — male thief, brown hair, white bandana, blue jacket, dagger
4. Edgar — male, gold crown, green armor

**Bottom — ATB panel:**
- Dark near-black background, thin purple border-top
- Per character: name (colored), HP bar (character color), ATB bar (gold, fills over time)
- Right side: last damage number display

---

## Pixel Art Rendering

- **Renderer:** HTML5 Canvas 2D API, `requestAnimationFrame` loop
- **Pixel scale:** 3px per logical pixel (all sprites drawn at 1x, scaled up 3x via `ctx.scale` or manual rect drawing)
- **Canvas size:** matches parent element width × fixed height (same as current HeroDotGrid)
- **Image smoothing:** disabled (`ctx.imageSmoothingEnabled = false`)
- **Sprites:** drawn programmatically with `ctx.fillRect()` calls — no external image files

Each sprite is defined as a JS object with a `draw(ctx, x, y, scale)` method that issues fillRect calls for each pixel block.

---

## Sprites (logical pixel dimensions, drawn at scale 3)

| Sprite | Logical size | Notes |
|---|---|---|
| Dragon Boss | 26×32px | large, dominant left side |
| Wyvern | 12×16px | two instances |
| Bahamut | 36×28px | center, prominent |
| Terra | 7×10px | green hair, robe visible |
| Celes | 7×10px | blonde, armor glint |
| Locke | 7×10px | bandana detail |
| Edgar | 7×10px | crown visible |
| Mountain silhouette | full width × 18px | dark polygon shapes |
| Star | 1×1px | scattered, twinkling |

---

## Animation System

All animation state is tracked in a single `battleState` object updated each frame. No external animation library.

### Idle animations (continuous loop)
- **Stars:** per-star alpha oscillates with individual phase/speed
- **Dragon boss:** translateY sine wave, period ~1.5s
- **Wyverns:** translateY + slight rotation, staggered phase
- **Bahamut:** translateY + slight tilt, period ~3s; name text alpha pulses
- **Party members:** subtle translateY bob, staggered offsets

### Combat sequence (timed, repeating ~20s cycle)

| t (s) | Event |
|---|---|
| 0.9 | Locke attacks → lunge left → slash FX at boss → boss flashes |
| 3.4 | Celes attacks → sword slash FX |
| 5.9 | Edgar attacks → slash FX |
| 8.4 | Locke attacks + heal number spawns on party |
| 10.9 | Terra casts → glow → magic ring circles appear → "BAHAMUT!" float |
| 13.4 | Mega Flare → Bahamut mouth glow → beam shoots left → screen flash → all enemies stagger + damage numbers |
| 15.9 | Terra attacks (magic bolt slash) |
| 18.4 | Celes sword again |
| 20.9 | cycle repeats |

### Attack lunge
Member slides left ~18px over 230ms, pauses briefly, returns over 300ms.

### Slash effect
An X-shaped or arc-shaped mark drawn at enemy position for ~500ms, fading out. Color varies per character (purple for Terra, white for Celes, gold for Locke, green for Edgar).

### Mega Flare beam
A horizontal gradient rectangle from Bahamut's mouth position (center-top) extending left to the enemy group. Starts width=0, expands to full width over ~350ms, holds briefly, fades. A bright white core line overlays the beam center.

### Magic circle
Two concentric circles that expand + rotate outward from Terra's position over ~1.8s, then fade.

### Damage / heal numbers
Floating text that rises ~50px and fades over 1.5s. Spawned at enemy position for damage (red/orange), at party position for heals (green).

### Screen flash
Canvas-wide white/orange rectangle at near-full opacity, decays to 0 in ~150ms. Triggered on summon and Mega Flare impact.

---

## ATB Panel

Drawn on canvas (not HTML overlay) in the bottom 48px of the canvas. Redrawn each frame.

- Background: `rgba(2, 2, 22, 0.94)` filled rect
- Top border: 1px line in `rgba(120, 100, 220, 0.3)`
- Per character slot (4 total, equal width):
  - Name text (7px, character color)
  - HP bar: filled rect, character color, static width representing current HP %
  - ATB bar: filled rect, gold (`#ffd700`), width = `(elapsed % period) / period * maxWidth`, loops continuously

---

## Component Interface

```tsx
// components/HeroBattleScene.tsx  (replaces HeroDotGrid.tsx)
export default function HeroBattleScene() { ... }
```

- Uses `useRef<HTMLCanvasElement>` + `useEffect` for the animation loop
- `useEffect` cleanup cancels `requestAnimationFrame` on unmount
- Canvas sized via `canvas.width = canvas.offsetWidth * devicePixelRatio` on mount + resize observer
- No props needed — fully self-contained

---

## File Changes

| File | Action |
|---|---|
| `components/HeroBattleScene.tsx` | **Create** — new component |
| `components/HeroDotGrid.tsx` | **Delete** |
| Any file importing `HeroDotGrid` | Update import to `HeroBattleScene` |

---

## Out of Scope

- Sound/music
- User interaction (clicking characters, etc.)
- Mobile-specific layout changes (canvas scales naturally)
- Loading external sprite sheets or images
