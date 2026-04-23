# 코인 매수 후보 스크리너 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 crypto_daily 데이터만으로 코인별 매수 신호 점수를 계산해 TOP 5 후보를 프리셋 탭과 함께 크립토 페이지 상단에 표시한다.

**Architecture:** `lib/cryptoScreener.ts`에 순수 함수로 점수 로직을 격리하고, `CoinScreenerSection.tsx`(Client Component)가 프리셋 상태를 관리하며 재계산한다. `app/crypto/page.tsx`는 기존 `cryptoData`를 새 컴포넌트에 추가 전달만 한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, Supabase (기존 데이터만 사용)

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `lib/cryptoScreener.ts` | 타입 정의 + 점수 계산 순수 함수 + 프리셋 상수 |
| `components/CoinScreenerSection.tsx` | 프리셋 탭 상태 + 카드 렌더링 (Client Component) |
| `app/crypto/page.tsx` | CoinScreenerSection import 및 cryptoData 전달 (소규모 수정) |

---

## Task 1: 점수 계산 라이브러리 (`lib/cryptoScreener.ts`)

**Files:**
- Create: `lib/cryptoScreener.ts`

### 데이터 필드 매핑 (page.tsx 실제 타입 기준)

```
RSI       → editorial.rsi_heatmap.all[] | [...overbought, ...oversold]
             각 항목: { symbol, rsi_4h, rsi_1d, rsi_1w }
SmartMoney → editorial.netflows[]
             각 항목: { token_symbol, net_flow_24h_usd, ... }
Price      → market.coins[]
             각 항목: { symbol, price_change_percentage_24h,
                        price_change_percentage_7d_in_currency }
Trending   → trending[]
             각 항목: { symbol, ... }
```

- [ ] **Step 1: 파일 생성 — 타입 정의**

```typescript
// lib/cryptoScreener.ts

export type PresetKey = "overall" | "rsi" | "smartmoney" | "momentum";

export interface Weights {
  rsi: number;
  smartMoney: number;
  momentum: number;
}

export const PRESETS: Record<PresetKey, Weights> = {
  overall:     { rsi: 1.0, smartMoney: 1.0, momentum: 1.0 },
  rsi:         { rsi: 2.0, smartMoney: 0.5, momentum: 0.8 },
  smartmoney:  { rsi: 0.5, smartMoney: 2.5, momentum: 0.8 },
  momentum:    { rsi: 0.8, smartMoney: 0.8, momentum: 2.0 },
};

export type TagColor = "green" | "yellow" | "red";

export interface SignalTag {
  label: string;
  color: TagColor;
  detail: string;
}

/** 점수 계산에 필요한 코인 단위 데이터 */
export interface CoinInput {
  symbol: string;           // 대문자 심볼 (BTC, ETH …)
  name: string;
  rsi1d: number | null;     // RSI 1d, 없으면 null
  netFlow24h: number | null; // 스마트머니 순유입(USD), 없으면 null
  change24h: number | null;  // 24h 가격변동 %
  change7d: number | null;   // 7d 가격변동 %
  isTrending: boolean;
}

export interface ScoredCoin extends CoinInput {
  score: number;
  tags: SignalTag[];
}
```

- [ ] **Step 2: RSI 점수 함수 추가**

```typescript
/** RSI 1d 기반 점수 (-20 ~ 40) */
function rsiScore(rsi: number | null): number {
  if (rsi === null) return 0;
  if (rsi < 30)  return 40;
  if (rsi < 40)  return 25;
  if (rsi < 50)  return 10;
  if (rsi < 70)  return 0;
  return -20; // 과매수
}
```

- [ ] **Step 3: 스마트머니 점수 함수 추가**

```typescript
/** 24h 순유입(USD) 기반 점수 (-15 ~ 35) */
function smartMoneyScore(flow: number | null): number {
  if (flow === null)       return 0;
  if (flow > 1_000_000)   return 35;
  if (flow > 100_000)     return 20;
  if (flow > 0)           return 10;
  return -15; // 유출
}
```

- [ ] **Step 4: 모멘텀 점수 함수 추가**

```typescript
/** 24h/7d 가격 변동 기반 점수 (0 ~ 25) */
function momentumScore(change24h: number | null, change7d: number | null): number {
  const d = change24h ?? 0;
  const w = change7d  ?? 0;
  if (d < 0 && w > 0) return 25; // 눌림목 (7d 상승 중 24h 조정)
  if (d > 0 && w > 0) return 15; // 추세 지속
  if (d > 0 && w < 0) return 5;  // 단기 반등
  return 0;                       // 24h/7d 모두 하락
}
```

- [ ] **Step 5: 신호 태그 함수 추가**

```typescript
/** 코인 데이터를 보고 사람이 읽을 신호 태그 목록 반환 */
export function getSignalTags(coin: CoinInput): SignalTag[] {
  const tags: SignalTag[] = [];

  // RSI 태그
  if (coin.rsi1d !== null) {
    if (coin.rsi1d < 30) {
      tags.push({ label: "RSI 과매도", color: "green",  detail: `RSI ${coin.rsi1d.toFixed(0)}` });
    } else if (coin.rsi1d < 40) {
      tags.push({ label: "RSI 저점권", color: "yellow", detail: `RSI ${coin.rsi1d.toFixed(0)}` });
    } else if (coin.rsi1d >= 70) {
      tags.push({ label: "RSI 과매수", color: "red",    detail: `RSI ${coin.rsi1d.toFixed(0)}` });
    }
  }

  // 스마트머니 태그
  if (coin.netFlow24h !== null) {
    const m = coin.netFlow24h / 1_000_000;
    if (coin.netFlow24h > 1_000_000) {
      tags.push({ label: "고래 대량 유입", color: "green",  detail: `+$${m.toFixed(1)}M` });
    } else if (coin.netFlow24h > 100_000) {
      tags.push({ label: "고래 유입",     color: "green",  detail: `+$${(coin.netFlow24h / 1000).toFixed(0)}K` });
    } else if (coin.netFlow24h > 0) {
      tags.push({ label: "소폭 유입",     color: "yellow", detail: `+$${(coin.netFlow24h / 1000).toFixed(0)}K` });
    } else {
      tags.push({ label: "고래 유출",     color: "red",    detail: `$${m.toFixed(1)}M` });
    }
  }

  // 모멘텀 태그
  const d = coin.change24h, w = coin.change7d;
  if (d !== null && w !== null) {
    if (d < 0 && w > 0) {
      tags.push({ label: "눌림목", color: "green",
        detail: `${d.toFixed(1)}% / +${w.toFixed(1)}%` });
    } else if (d > 0 && w > 0) {
      tags.push({ label: "상승 추세", color: "yellow",
        detail: `+${d.toFixed(1)}% / +${w.toFixed(1)}%` });
    }
  }

  // 트렌딩
  if (coin.isTrending) {
    tags.push({ label: "트렌딩", color: "yellow", detail: "CoinGecko" });
  }

  return tags;
}
```

- [ ] **Step 6: 단일 코인 점수 계산 함수 추가**

```typescript
/** 가중치를 적용한 총점 계산 */
export function scoreCoin(coin: CoinInput, weights: Weights): number {
  const r = rsiScore(coin.rsi1d)                              * weights.rsi;
  const s = smartMoneyScore(coin.netFlow24h)                  * weights.smartMoney;
  const m = momentumScore(coin.change24h, coin.change7d)      * weights.momentum;
  const t = coin.isTrending ? 10 : 0; // 트렌딩 보너스는 가중치 무관
  return r + s + m + t;
}
```

- [ ] **Step 7: 데이터 병합 + TOP N 반환 함수 추가**

```typescript
/**
 * crypto_daily editorial + market + trending 로부터
 * CoinInput 유니버스를 구성하고 상위 n개를 반환한다.
 */
export function getTopCandidates(
  rsiAll: Array<{ symbol: string; rsi_4h: number | null; rsi_1d: number | null; rsi_1w: number | null }> | undefined | null,
  netflows: Array<{ token_symbol: string; net_flow_24h_usd: number }> | undefined | null,
  coins: Array<{ symbol: string; name: string; price_change_percentage_24h: number; price_change_percentage_7d_in_currency: number }> | undefined | null,
  trendingSymbols: string[],
  weights: Weights,
  n = 5,
): ScoredCoin[] {
  // symbol → 데이터 맵 구성
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
      name: c.name,
      change24h: c.price_change_percentage_24h,
      change7d:  c.price_change_percentage_7d_in_currency,
    });
  }

  const trendingSet = new Set(trendingSymbols.map(s => s.toUpperCase()));

  // 유니버스 = RSI 등장 심볼 ∪ SmartMoney 등장 심볼
  const universe = new Set([...rsiMap.keys(), ...flowMap.keys()]);

  const scored: ScoredCoin[] = [];
  for (const sym of universe) {
    const coinData = coinMap.get(sym);
    const input: CoinInput = {
      symbol:      sym,
      name:        coinData?.name ?? sym,
      rsi1d:       rsiMap.get(sym) ?? null,
      netFlow24h:  flowMap.has(sym) ? flowMap.get(sym)! : null,
      change24h:   coinData?.change24h ?? null,
      change7d:    coinData?.change7d  ?? null,
      isTrending:  trendingSet.has(sym),
    };
    scored.push({
      ...input,
      score: scoreCoin(input, weights),
      tags:  getSignalTags(input),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
```

- [ ] **Step 8: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

에러 없으면 OK.

- [ ] **Step 9: 커밋**

```bash
git add lib/cryptoScreener.ts
git commit -m "feat: 코인 스크리너 점수 계산 라이브러리 추가"
```

---

## Task 2: UI 컴포넌트 (`components/CoinScreenerSection.tsx`)

**Files:**
- Create: `components/CoinScreenerSection.tsx`

- [ ] **Step 1: 컴포넌트 스캐폴딩 + props 타입**

```typescript
"use client";

import { useState, useMemo } from "react";
import {
  PRESETS,
  PresetKey,
  ScoredCoin,
  getTopCandidates,
} from "@/lib/cryptoScreener";

// page.tsx 의 타입과 동일한 최소 구조만 선언
interface RsiItem  { symbol: string; rsi_4h: number | null; rsi_1d: number | null; rsi_1w: number | null; }
interface NetflowItem { token_symbol: string; net_flow_24h_usd: number; }
interface CoinItem {
  symbol: string; name: string;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
}
interface TrendingItem { symbol: string; }

interface Props {
  rsiAll:    RsiItem[]    | null | undefined;
  netflows:  NetflowItem[] | null | undefined;
  coins:     CoinItem[]   | null | undefined;
  trending:  TrendingItem[];
}

const PRESET_LABELS: Record<PresetKey, string> = {
  overall:    "종합",
  rsi:        "RSI 기술적",
  smartmoney: "스마트머니",
  momentum:   "모멘텀",
};
```

- [ ] **Step 2: 점수 계산 + 프리셋 상태 로직**

```typescript
export default function CoinScreenerSection({ rsiAll, netflows, coins, trending }: Props) {
  const [preset, setPreset] = useState<PresetKey>("overall");

  const trendingSymbols = trending.map(t => t.symbol);

  const top5: ScoredCoin[] = useMemo(() => {
    return getTopCandidates(rsiAll, netflows, coins, trendingSymbols, PRESETS[preset], 5);
  }, [rsiAll, netflows, coins, trendingSymbols, preset]);
```

- [ ] **Step 3: 프리셋 탭 렌더링**

```typescript
  return (
    <section className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            매수 후보 스크리너
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            RSI · 스마트머니 · 모멘텀 종합 점수 기준 TOP 5
          </p>
        </div>
      </div>

      {/* 프리셋 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(PRESET_LABELS) as PresetKey[]).map(key => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              preset === key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
            }`}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>
```

- [ ] **Step 4: 코인 카드 렌더링**

```typescript
      {/* 카드 목록 */}
      {top5.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4">
          데이터가 충분하지 않습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {top5.map((coin, idx) => (
            <li
              key={coin.symbol}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3 space-y-2"
            >
              {/* 1행: 순위 + 심볼 + 점수 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-5">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {coin.symbol}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {coin.name}
                  </span>
                </div>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {Math.round(coin.score)}점
                </span>
              </div>

              {/* 2행: 점수 게이지 바 */}
              <ScoreBar score={coin.score} />

              {/* 3행: 신호 태그 */}
              <div className="flex flex-wrap gap-1.5">
                {coin.tags.map((tag, ti) => (
                  <TagBadge key={ti} tag={tag} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 면책 고지 */}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
        * 투자 추천이 아닙니다. RSI·스마트머니·모멘텀 지표를 자동 합산한 참고용 점수입니다.
        투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
      </p>
    </section>
  );
}
```

- [ ] **Step 5: ScoreBar + TagBadge 헬퍼 컴포넌트 추가 (파일 하단)**

```typescript
/** 0–110점 범위 게이지 바 */
function ScoreBar({ score }: { score: number }) {
  const MAX = 110;
  const pct = Math.min(100, Math.max(0, (score / MAX) * 100));
  const color =
    pct >= 60 ? "bg-green-500" :
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

import type { SignalTag } from "@/lib/cryptoScreener";

/** 신호 태그 뱃지 */
function TagBadge({ tag }: { tag: SignalTag }) {
  const cls =
    tag.color === "green"  ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
    tag.color === "red"    ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                             "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {tag.label}
      <span className="opacity-70">{tag.detail}</span>
    </span>
  );
}
```

- [ ] **Step 6: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

에러 없으면 OK.

- [ ] **Step 7: 커밋**

```bash
git add components/CoinScreenerSection.tsx
git commit -m "feat: CoinScreenerSection UI 컴포넌트 추가"
```

---

## Task 3: 크립토 페이지에 연결 (`app/crypto/page.tsx`)

**Files:**
- Modify: `app/crypto/page.tsx`

- [ ] **Step 1: import 추가**

`app/crypto/page.tsx` 상단 import 목록에 추가:

```typescript
import CoinScreenerSection from "@/components/CoinScreenerSection";
```

동적 import가 아닌 일반 import 사용 — 서버 컴포넌트에서 client component를 직접 임포트해도 Next.js가 자동으로 클라이언트 경계를 처리한다.

- [ ] **Step 2: 섹션 최상단에 추가**

기존 시장 개요 렌더링 블록 **바로 위**에 삽입. `app/crypto/page.tsx` 에서 `{/* 시장 개요 */}` 또는 첫 번째 섹션 `<section>` 태그 직전에 추가:

```tsx
{/* 매수 후보 스크리너 */}
<CoinScreenerSection
  rsiAll={
    cryptoData.editorial?.rsi_heatmap?.all ??
    [
      ...(cryptoData.editorial?.rsi_heatmap?.overbought ?? []),
      ...(cryptoData.editorial?.rsi_heatmap?.oversold   ?? []),
    ]
  }
  netflows={cryptoData.editorial?.netflows ?? []}
  coins={cryptoData.market?.coins ?? []}
  trending={cryptoData.trending ?? []}
/>
```

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

에러 없으면 OK.

- [ ] **Step 4: 로컬 개발 서버에서 시각 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/crypto` 접속 후 확인:
- [ ] 스크리너 섹션이 페이지 최상단에 표시되는가
- [ ] 코인 카드 5개가 점수순으로 나열되는가
- [ ] 프리셋 탭 클릭 시 순위가 바뀌는가
- [ ] 신호 태그 색상이 올바른가 (초록/노랑/빨강)
- [ ] 데이터가 없는 경우 "데이터가 충분하지 않습니다." 메시지가 나오는가
- [ ] 다크모드에서 색상이 잘 보이는가
- [ ] 모바일(375px) 레이아웃이 깨지지 않는가

- [ ] **Step 5: 최종 커밋**

```bash
git add app/crypto/page.tsx
git commit -m "feat: 크립토 페이지에 코인 매수 후보 스크리너 섹션 추가"
```

---

## 자체 검토

**스펙 커버리지:**
- [x] RSI 점수 알고리즘 (0~40, 과매수 패널티) — Task 1 Step 2
- [x] 스마트머니 점수 (-15~35) — Task 1 Step 3
- [x] 모멘텀 점수 (눌림목/추세/반등) — Task 1 Step 4
- [x] 트렌딩 보너스 (+10) — Task 1 Step 6
- [x] 4개 프리셋 가중치 — Task 1 Step 1 (PRESETS 상수)
- [x] TOP 5 카드 UI (심볼, 점수, 게이지, 태그) — Task 2
- [x] 면책 고지 — Task 2 Step 4
- [x] 페이지 최상단 배치 — Task 3 Step 2
- [x] 추가 API 비용 없음 — 기존 cryptoData만 전달

**타입 일관성:**
- `CoinInput.rsi1d`, `CoinInput.netFlow24h` — Task 1에서 정의, Task 1 Step 7 `getTopCandidates`에서 일관 사용
- `ScoredCoin extends CoinInput` — `getTopCandidates` 반환 타입과 UI props 타입 일치
- `RsiItem.rsi_1d`, `NetflowItem.net_flow_24h_usd` — page.tsx 실제 타입(탐색 결과)과 일치
