# Futures Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "선물 스캐너" section to the crypto page that surfaces the top 10 Binance USDT perpetual futures coins matching: high 4H volume + positive funding rate + increasing OI + low market cap.

**Architecture:** Hourly cron script fetches Binance public API data (no key required), scores coins using a weighted formula, stores top 50 in `editorial.futures_scanner` JSONB field in Supabase. A Client Component reads the stored data and re-ranks client-side using 4 preset tabs. The coin screener universe fix (Task 0) is included because it touches the same files.

**Tech Stack:** Node.js ESM script, Binance Futures public API, Supabase JSONB, Next.js Client Component, TypeScript, Tailwind CSS.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `scripts/generate-crypto-daily.mjs` | Modify | Add `fetchFuturesScanner()`, integrate into `fetchAll()` + `generateEditorial()` |
| `lib/futuresScanner.ts` | Create | FuturesCoin type, preset constants, `getTopFutures()` re-ranking function |
| `lib/cryptoScreener.ts` | Modify | Fix `getTopCandidates` to accept wider coin universe (Task 0) |
| `components/FuturesScannerSection.tsx` | Create | Client Component — preset tabs + TOP 10 coin cards |
| `app/crypto/page.tsx` | Modify | Add `futures_scanner` to Editorial type, dynamic import, section JSX, anchor nav |

---

## Task 0: Fix Coin Screener Universe

The current `getTopCandidates` builds its universe from RSI ∪ SmartMoney sets only (~20-30 coins). It should use the wider `coins` parameter (top 250) as the base universe.

**Files:**
- Modify: `lib/cryptoScreener.ts`
- Modify: `scripts/generate-crypto-daily.mjs` (store top250 in editorial)
- Modify: `app/crypto/page.tsx` (add top250 to Editorial type, pass to CoinScreenerSection)

- [ ] **Step 1: Expand the universe in `getTopCandidates`**

In `lib/cryptoScreener.ts`, the current universe is:
```typescript
const universe = new Set([...rsiMap.keys(), ...flowMap.keys()]);
```

Replace the entire `getTopCandidates` function body from the universe declaration to the return with:

```typescript
export function getTopCandidates(
  rsiAll:   Array<{ symbol: string; rsi_4h: number | null; rsi_1d: number | null; rsi_1w: number | null }> | undefined | null,
  netflows: Array<{ token_symbol: string; net_flow_24h_usd: number }> | undefined | null,
  coins:    Array<{ symbol: string; name: string; price_change_percentage_24h: number; price_change_percentage_7d_in_currency: number }> | undefined | null,
  trendingSymbols: string[],
  weights: Weights,
  n = 5,
): ScoredCoin[] {
  const rsiMap = new Map<string, number | null>();
  for (const r of rsiAll ?? []) {
    rsiMap.set(r.symbol.toUpperCase(), r.rsi_1d);
  }

  const flowMap = new Map<string, number>();
  for (const f of netflows ?? []) {
    flowMap.set(f.token_symbol.toUpperCase(), f.net_flow_24h_usd);
  }

  const coinMap = new Map<string, { name: string; change24h: number; change7d: number }>();
  for (const c of coins ?? []) {
    coinMap.set(c.symbol.toUpperCase(), {
      name:      c.name,
      change24h: c.price_change_percentage_24h,
      change7d:  c.price_change_percentage_7d_in_currency,
    });
  }

  const trendingSet = new Set(trendingSymbols.map(s => s.toUpperCase()));

  // Universe = all coins in the top-250 list (coins param) PLUS any RSI/SmartMoney coins not in top-250
  const universe = new Set([
    ...(coins ?? []).map(c => c.symbol.toUpperCase()),
    ...rsiMap.keys(),
    ...flowMap.keys(),
  ]);

  const scored: ScoredCoin[] = [];
  for (const sym of universe) {
    const coinData = coinMap.get(sym);
    const input: CoinInput = {
      symbol:     sym,
      name:       coinData?.name ?? sym,
      rsi1d:      rsiMap.has(sym) ? rsiMap.get(sym)! : null,
      netFlow24h: flowMap.has(sym) ? flowMap.get(sym)! : null,
      change24h:  coinData?.change24h ?? null,
      change7d:   coinData?.change7d  ?? null,
      isTrending: trendingSet.has(sym),
    };
    scored.push({ ...input, score: scoreCoin(input, weights), tags: getSignalTags(input) });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, n);
}
```

- [ ] **Step 2: Store top250 in editorial via the script**

In `scripts/generate-crypto-daily.mjs`, find the `generateEditorial` function signature:
```javascript
function generateEditorial({ market, trending, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers }) {
```

Change it to:
```javascript
function generateEditorial({ market, trending, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers, marketsTop250, futuresScanner }) {
```

Then find `return {` at the end of `generateEditorial` and add `coins_top250` and `futures_scanner` to the returned object (leave all existing fields as-is, just add two new lines):
```javascript
  return {
    // ... all existing fields unchanged ...
    coins_top250: (marketsTop250 ?? []).map(c => ({
      symbol: (c.symbol ?? "").toUpperCase(),
      name: c.name ?? "",
      price_change_percentage_24h: c.price_change_percentage_24h ?? 0,
      price_change_percentage_7d_in_currency: c.price_change_percentage_7d_in_currency ?? 0,
    })),
    futures_scanner: futuresScanner ?? [],
  };
```

- [ ] **Step 3: Pass `marketsTop250` in `fetchAll()` return**

In `scripts/generate-crypto-daily.mjs`, find the `fetchAll()` return statement (around line 659):
```javascript
  return { market, trending: trendingCoins, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers };
```

Add `marketsTop250` to this return:
```javascript
  return { market, trending: trendingCoins, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers, marketsTop250 };
```

- [ ] **Step 4: Exclude `marketsTop250` from dbPayload in `main()`**

In `scripts/generate-crypto-daily.mjs`, find the destructuring in `main()`:
```javascript
  const { altcoinSeason: _as, longShortRatio: _ls, netflows: _nf, predictionMarkets: _pm, hyperliquidPerps: _hp, coinCategories: _cc, rsiHeatmap: _rsi, gainersLosers: _gl, ...dbPayload } = payload;
```

Change to:
```javascript
  const { altcoinSeason: _as, longShortRatio: _ls, netflows: _nf, predictionMarkets: _pm, hyperliquidPerps: _hp, coinCategories: _cc, rsiHeatmap: _rsi, gainersLosers: _gl, marketsTop250: _m250, futuresScanner: _fs, ...dbPayload } = payload;
```

- [ ] **Step 5: Add `coins_top250` and `futures_scanner` to `Editorial` type in `page.tsx`**

In `app/crypto/page.tsx`, find the `Editorial` type definition and add two fields:
```typescript
type Editorial = {
  // ... all existing fields unchanged ...
  coins_top250?: Array<{
    symbol: string;
    name: string;
    price_change_percentage_24h: number;
    price_change_percentage_7d_in_currency: number;
  }> | null;
  futures_scanner?: FuturesCoinStored[] | null;
};
```

Add the `FuturesCoinStored` type just above `Editorial`:
```typescript
type FuturesCoinStored = {
  symbol: string;
  fundingRate: number;
  oiChangePct: number;
  volume4hUsd: number;
  volume4hRank: number;
  marketCapUsd: number | null;
  score: number;
};
```

- [ ] **Step 6: Pass `coins_top250` to `CoinScreenerSection`**

In `app/crypto/page.tsx`, find the `CoinScreenerSection` usage:
```tsx
<CoinScreenerSection
  rsiAll={
    editorial?.rsi_heatmap?.all ??
    [
      ...(editorial?.rsi_heatmap?.overbought ?? []),
      ...(editorial?.rsi_heatmap?.oversold   ?? []),
    ]
  }
  netflows={editorial?.netflows ?? []}
  coins={market?.coins ?? []}
  trending={trending ?? []}
/>
```

Change `coins={market?.coins ?? []}` to:
```tsx
  coins={editorial?.coins_top250 ?? market?.coins ?? []}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run:
```bash
cd P:/straweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to these files).

- [ ] **Step 8: Commit**

```bash
git add lib/cryptoScreener.ts scripts/generate-crypto-daily.mjs app/crypto/page.tsx
git commit -m "fix: expand coin screener universe to top-250 coins"
```

---

## Task 1: Create `lib/futuresScanner.ts`

Types, preset constants, and the client-side re-ranking function. No API calls here — pure data transformation.

**Files:**
- Create: `lib/futuresScanner.ts`

- [ ] **Step 1: Create the file**

Create `lib/futuresScanner.ts` with the following content:

```typescript
export type FuturesPresetKey = "overall" | "highFunding" | "oiSurge" | "volumeBlast";

export interface FuturesWeights {
  volume: number;
  funding: number;
  oi: number;
}

export const FUTURES_PRESETS: Record<FuturesPresetKey, FuturesWeights> = {
  overall:     { volume: 1.0, funding: 1.0, oi: 1.0 },
  highFunding: { volume: 0.5, funding: 3.0, oi: 0.8 },
  oiSurge:     { volume: 0.5, funding: 0.8, oi: 3.0 },
  volumeBlast: { volume: 3.0, funding: 0.5, oi: 0.5 },
};

export const FUTURES_PRESET_LABELS: Record<FuturesPresetKey, string> = {
  overall:     "종합",
  highFunding: "고펀딩비",
  oiSurge:     "OI 급증",
  volumeBlast: "거래량 폭발",
};

export interface FuturesCoin {
  symbol: string;
  fundingRate: number;
  oiChangePct: number;
  volume4hUsd: number;
  volume4hRank: number;
  marketCapUsd: number | null;
  score: number;
}

function volumeScore(rank: number, total: number): number {
  const pct = rank / total;
  if (pct <= 0.10) return 30;
  if (pct <= 0.25) return 20;
  if (pct <= 0.50) return 10;
  return 0;
}

function fundingScore(rate: number): number {
  if (rate > 0.0001)  return 20;
  if (rate > 0.00005) return 12;
  return 5;
}

function oiScore(changePct: number): number {
  if (changePct > 20) return 30;
  if (changePct > 10) return 20;
  if (changePct > 5)  return 10;
  if (changePct > 0)  return 3;
  return 0;
}

function marketCapBonus(capUsd: number | null): number {
  if (capUsd === null)       return 0;
  if (capUsd < 50_000_000)  return 20;
  if (capUsd < 100_000_000) return 10;
  return 0;
}

export function getTopFutures(
  data: FuturesCoin[],
  weights: FuturesWeights,
  n = 10,
): FuturesCoin[] {
  const total = data.length;
  if (total === 0) return [];
  return data
    .map((coin) => ({
      ...coin,
      score:
        volumeScore(coin.volume4hRank, total) * weights.volume +
        fundingScore(coin.fundingRate) * weights.funding +
        oiScore(coin.oiChangePct) * weights.oi +
        marketCapBonus(coin.marketCapUsd),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd P:/straweb && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors from `lib/futuresScanner.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/futuresScanner.ts
git commit -m "feat: add futuresScanner types and scoring logic"
```

---

## Task 2: Add `fetchFuturesScanner()` to the cron script

Three-step Binance API collection: batch ticker + funding (2 calls) → filter → parallel 4H klines + OI per coin (batches of 10).

**Files:**
- Modify: `scripts/generate-crypto-daily.mjs`

- [ ] **Step 1: Add `fetchFuturesScanner` function**

In `scripts/generate-crypto-daily.mjs`, add the following function just before the `async function fetchAll()` line (around line 533):

```javascript
async function fetchFuturesScanner(marketsTop250) {
  console.log("  [선물 스캐너] 바이낸스 선물 데이터 수집 중...");

  // Step 1: ticker (24h volume) + funding rates — 2 parallel calls
  const [tickerRes, fundingRes] = await Promise.all([
    safeFetch("https://fapi.binance.com/fapi/v1/ticker/24hr"),
    safeFetch("https://fapi.binance.com/fapi/v1/premiumIndex"),
  ]);
  if (!tickerRes || !fundingRes) {
    console.log("  [선물 스캐너] Binance API 응답 없음, 건너뜀");
    return [];
  }

  const tickers = await tickerRes.json();
  const fundings = await fundingRes.json();

  // Build maps
  const fundingMap = new Map();
  for (const f of (Array.isArray(fundings) ? fundings : [])) {
    if (typeof f.symbol === "string" && f.symbol.endsWith("USDT")) {
      fundingMap.set(f.symbol, parseFloat(f.lastFundingRate ?? "0"));
    }
  }

  const capMap = new Map();
  for (const coin of (marketsTop250 ?? [])) {
    if (coin.symbol) capMap.set(coin.symbol.toUpperCase(), coin.market_cap ?? null);
  }

  // Filter: USDT pairs with positive funding rate
  const candidates = (Array.isArray(tickers) ? tickers : [])
    .filter((t) => typeof t.symbol === "string" && t.symbol.endsWith("USDT") && (fundingMap.get(t.symbol) ?? 0) > 0)
    .map((t) => ({
      symbol: t.symbol.replace(/USDT$/, ""),
      binanceSymbol: t.symbol,
      fundingRate: fundingMap.get(t.symbol) ?? 0,
    }));

  if (candidates.length === 0) {
    console.log("  [선물 스캐너] 양수 펀딩비 코인 없음");
    return [];
  }
  console.log(`  [선물 스캐너] 양수 펀딩비 코인 ${candidates.length}개, 4H 데이터 수집 중...`);

  // Step 3: 4H klines + OI per coin in batches of 10
  const BATCH = 10;
  const rawResults = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const batchData = await Promise.all(
      batch.map(async (coin) => {
        try {
          const [klinesRes, oiRes] = await Promise.all([
            safeFetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${coin.binanceSymbol}&interval=4h&limit=1`),
            safeFetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${coin.binanceSymbol}&period=4h&limit=2`),
          ]);
          if (!klinesRes || !oiRes) return null;

          const klines = await klinesRes.json();
          const oiData = await oiRes.json();

          // klines row: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, ...]
          const volume4hUsd = parseFloat(klines?.[0]?.[7] ?? "0");

          let oiChangePct = 0;
          if (Array.isArray(oiData) && oiData.length >= 2) {
            const curr = parseFloat(oiData[1]?.sumOpenInterestValue ?? "0");
            const prev = parseFloat(oiData[0]?.sumOpenInterestValue ?? "0");
            if (prev > 0) oiChangePct = ((curr - prev) / prev) * 100;
          }

          return {
            symbol: coin.symbol,
            fundingRate: coin.fundingRate,
            oiChangePct,
            volume4hUsd,
            marketCapUsd: capMap.get(coin.symbol.toUpperCase()) ?? null,
          };
        } catch {
          return null;
        }
      })
    );
    rawResults.push(...batchData.filter(Boolean));
  }

  // Sort by 4H volume to assign rank, then score
  const sorted = [...rawResults].sort((a, b) => b.volume4hUsd - a.volume4hUsd);
  const total = sorted.length;

  const scored = sorted.map((coin, idx) => {
    const volume4hRank = idx + 1;
    const pct = volume4hRank / total;
    const volumeSc = pct <= 0.10 ? 30 : pct <= 0.25 ? 20 : pct <= 0.50 ? 10 : 0;
    const fundingSc = coin.fundingRate > 0.0001 ? 20 : coin.fundingRate > 0.00005 ? 12 : 5;
    const oiSc = coin.oiChangePct > 20 ? 30 : coin.oiChangePct > 10 ? 20 : coin.oiChangePct > 5 ? 10 : coin.oiChangePct > 0 ? 3 : 0;
    const capBonus = !coin.marketCapUsd ? 0 : coin.marketCapUsd < 50_000_000 ? 20 : coin.marketCapUsd < 100_000_000 ? 10 : 0;
    return {
      ...coin,
      volume4hRank,
      score: volumeSc + fundingSc + oiSc + capBonus,
    };
  });

  const top50 = scored.sort((a, b) => b.score - a.score).slice(0, 50);
  console.log(`  [선물 스캐너] 완료: ${top50.length}개 저장`);
  return top50;
}
```

- [ ] **Step 2: Call `fetchFuturesScanner` inside `fetchAll()`**

In `scripts/generate-crypto-daily.mjs`, find the section in `fetchAll()` after the RSI collection line:
```javascript
  const rsiHeatmap = await fetchRsiHeatmap();
```

Add the following line immediately after:
```javascript
  const futuresScanner = await fetchFuturesScanner(marketsTop250);
```

- [ ] **Step 3: Add `futuresScanner` to the `fetchAll()` return**

The return statement in `fetchAll()` currently ends with `gainersLosers`. Add `futuresScanner` to it:
```javascript
  return { market, trending: trendingCoins, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers, marketsTop250, futuresScanner };
```

- [ ] **Step 4: Add `futures_scanner` to `generateEditorial()` return**

In `scripts/generate-crypto-daily.mjs`, find the end of the `generateEditorial` function's return object. It currently ends with something like `rsi_heatmap: ...`. Add the new fields at the end of the returned object:

```javascript
    coins_top250: (marketsTop250 ?? []).map(c => ({
      symbol: (c.symbol ?? "").toUpperCase(),
      name: c.name ?? "",
      price_change_percentage_24h: c.price_change_percentage_24h ?? 0,
      price_change_percentage_7d_in_currency: c.price_change_percentage_7d_in_currency ?? 0,
    })),
    futures_scanner: futuresScanner ?? [],
```

- [ ] **Step 5: Test the script in dry-run mode**

```bash
cd P:/straweb && node scripts/generate-crypto-daily.mjs --dry-run 2>&1 | tail -20
```

Expected output contains:
```
[선물 스캐너] 바이낸스 선물 데이터 수집 중...
[선물 스캐너] 양수 펀딩비 코인 N개, 4H 데이터 수집 중...
[선물 스캐너] 완료: N개 저장
[dry-run] DB 저장 및 텔레그램 전송 생략
```

If the script exits with "Binance API 응답 없음", check your internet connection and try again. If it errors out completely, read the error message and fix it before proceeding.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-crypto-daily.mjs
git commit -m "feat: add fetchFuturesScanner to crypto cron script"
```

---

## Task 3: Create `components/FuturesScannerSection.tsx`

Client Component with 4 preset tabs and TOP 10 coin cards. Follows the same pattern as `CoinScreenerSection.tsx`.

**Files:**
- Create: `components/FuturesScannerSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/FuturesScannerSection.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import {
  FuturesCoin,
  FuturesPresetKey,
  FUTURES_PRESETS,
  FUTURES_PRESET_LABELS,
  getTopFutures,
} from "@/lib/futuresScanner";

interface Props {
  data: FuturesCoin[];
}

function fmtVol(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000)     return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000)         return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

function fmtCap(usd: number | null): string {
  if (usd === null) return "–";
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000)     return `$${(usd / 1_000_000).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

function ScoreBar({ score }: { score: number }) {
  const MAX = 100;
  const pct = Math.min(100, Math.max(0, (score / MAX) * 100));
  const color =
    pct >= 60 ? "bg-emerald-500" :
    pct >= 35 ? "bg-yellow-400" :
                "bg-red-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function FuturesScannerSection({ data }: Props) {
  const [preset, setPreset] = useState<FuturesPresetKey>("overall");

  const top10 = useMemo(
    () => getTopFutures(data, FUTURES_PRESETS[preset], 10),
    [data, preset],
  );

  return (
    <section className="space-y-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          선물 스캐너
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Binance USDT Perp · 펀딩비 양수 · OI 증가 · 저시총 기준 · TOP 10
        </p>
      </div>

      {/* 프리셋 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(FUTURES_PRESET_LABELS) as FuturesPresetKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              preset === key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
            }`}
          >
            {FUTURES_PRESET_LABELS[key]}
          </button>
        ))}
      </div>

      {/* 카드 목록 */}
      {top10.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4">
          데이터가 충분하지 않습니다. 다음 갱신 시 표시됩니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {top10.map((coin, idx) => (
            <li
              key={coin.symbol}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3 space-y-2"
            >
              {/* 1행: 순위 + 심볼 + 점수 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 shrink-0">
                    {coin.symbol}
                  </span>
                </div>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {Math.round(coin.score)}점
                </span>
              </div>

              {/* 2행: 점수 게이지 바 */}
              <ScoreBar score={coin.score} />

              {/* 3행: 지표 태그 */}
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  펀딩비 +{(coin.fundingRate * 100).toFixed(4)}%
                </span>
                {coin.oiChangePct > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    OI +{coin.oiChangePct.toFixed(1)}% (4H)
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                  4H 거래량 {fmtVol(coin.volume4hUsd)} (상위 {coin.volume4hRank}위)
                </span>
                {coin.marketCapUsd !== null && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    coin.marketCapUsd < 50_000_000
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : coin.marketCapUsd < 100_000_000
                      ? "bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                      : "bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
                  }`}>
                    시총 {fmtCap(coin.marketCapUsd)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 면책 고지 */}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
        * 투자 추천이 아닙니다. Binance 선물 시장의 펀딩비·OI·거래량을 자동 합산한 참고용 점수입니다.
        투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd P:/straweb && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors from `components/FuturesScannerSection.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/FuturesScannerSection.tsx
git commit -m "feat: add FuturesScannerSection client component"
```

---

## Task 4: Integrate into `app/crypto/page.tsx`

Wire the new section into the crypto page with a dynamic import and an anchor nav entry.

**Files:**
- Modify: `app/crypto/page.tsx`

- [ ] **Step 1: Add dynamic import**

In `app/crypto/page.tsx`, add the following import alongside the other `dynamic()` imports (after the `PredictionMarketsSection` dynamic import, around line 20):

```typescript
const FuturesScannerSection = dynamic(() => import("@/components/FuturesScannerSection"), { loading: () => <SectionSkeleton /> });
```

- [ ] **Step 2: Add anchor nav entry**

In `app/crypto/page.tsx`, find the anchor nav array (the one with `"overview"`, `"sentiment"`, etc.) and add a "선물" entry:

```typescript
          {[
            { id: "overview",    label: "시장개요" },
            { id: "sentiment",   label: "심리지표" },
            { id: "futures",     label: "선물" },
            { id: "trending",    label: "트렌딩" },
            { id: "gainers",     label: "급등/락" },
            { id: "rsi",         label: "RSI" },
            { id: "dex",         label: "DEX" },
            { id: "smartmoney",  label: "스마트머니" },
            { id: "prediction",  label: "예측시장" },
          ].map(({ id, label }) => (
```

- [ ] **Step 3: Add the section JSX**

In `app/crypto/page.tsx`, find the `CoinScreenerSection` block:
```tsx
        {/* 매수 후보 스크리너 */}
        <AnimatedSection>
          <CoinScreenerSection
            ...
          />
        </AnimatedSection>
```

Add the `FuturesScannerSection` immediately after that `</AnimatedSection>`:

```tsx
        {/* 선물 스캐너 */}
        {editorial?.futures_scanner && editorial.futures_scanner.length > 0 && (
          <AnimatedSection delay={0.05}>
            <div id="futures" className="scroll-mt-24">
              <FuturesScannerSection data={editorial.futures_scanner as FuturesCoin[]} />
            </div>
          </AnimatedSection>
        )}
```

- [ ] **Step 4: Add `FuturesCoin` import**

In `app/crypto/page.tsx`, add the import at the top of the file (after the existing imports):

```typescript
import type { FuturesCoin } from "@/lib/futuresScanner";
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd P:/straweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Start dev server and check the page**

```bash
cd P:/straweb && npm run dev
```

Open `http://localhost:3000/crypto` in a browser.

Expected:
- "매수 후보 스크리너" section appears (with expanded universe now)
- "선물 스캐너" section appears only once `futures_scanner` data exists in Supabase (it won't appear on first load before the script runs)
- Anchor nav shows "선물" tab
- No console errors

To see the futures scanner immediately without running the full cron script, you can temporarily hardcode test data by changing the condition `editorial?.futures_scanner && editorial.futures_scanner.length > 0` to pass a mock array — but this is optional; the section will appear correctly once the script runs.

- [ ] **Step 7: Run the script with `--no-telegram` to populate Supabase**

```bash
cd P:/straweb && node scripts/generate-crypto-daily.mjs --no-telegram 2>&1 | tail -10
```

Expected:
```
[선물 스캐너] 완료: N개 저장
✓ 저장 완료: 2026-04-23
```

Then refresh `http://localhost:3000/crypto` (may need to wait ~60s for ISR cache or use `?date=2026-04-23` to force).

Expected: the "선물 스캐너" section appears with TOP 10 coin cards and 4 preset tabs.

- [ ] **Step 8: Commit**

```bash
git add app/crypto/page.tsx
git commit -m "feat: integrate FuturesScannerSection into crypto page"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Binance USDT Perp API calls: ticker/24hr + premiumIndex (Task 2 Step 1)
- [x] 4H klines per coin (Task 2 Step 1, klines endpoint)
- [x] OI history per coin (Task 2 Step 1, openInterestHist endpoint)
- [x] Batch processing 10 coins at a time (BATCH = 10 in Task 2)
- [x] CoinGecko Top 250 market cap matching (capMap from marketsTop250 in Task 2)
- [x] Scoring: volumeScore 0-30, fundingScore 0-20, oiScore 0-30, marketCapBonus 0-20 (Task 1)
- [x] Store top 50 in editorial.futures_scanner (Task 2 Step 4)
- [x] FuturesCoin type: symbol, fundingRate, oiChangePct, volume4hUsd, volume4hRank, marketCapUsd, score (Task 1)
- [x] 4 presets with correct multipliers (Task 1 FUTURES_PRESETS)
- [x] TOP 10 card display (Task 3)
- [x] Disclaimer text (Task 3)
- [x] Anchor nav entry (Task 4)
- [x] Coin screener universe fix (Task 0)

**Placeholder scan:** None found.

**Type consistency:**
- `FuturesCoin` defined in Task 1, imported in Task 3 and Task 4 — consistent.
- `FuturesPresetKey`, `FuturesWeights`, `FUTURES_PRESETS`, `FUTURES_PRESET_LABELS`, `getTopFutures` all defined in Task 1 and imported in Task 3 — consistent.
- `FuturesCoinStored` in page.tsx (Task 0) matches `FuturesCoin` shape exactly — consistent.
- `marketsTop250` added to `fetchAll()` return (Task 0 Step 3) and consumed in Task 2 — consistent.
- `futuresScanner` excluded from `dbPayload` (Task 0 Step 4) — consistent with other editorial-only fields.
