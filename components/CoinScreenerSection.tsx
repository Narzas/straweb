"use client";

import { useState, useMemo } from "react";
import {
  PRESETS,
  PresetKey,
  ScoredCoin,
  SignalTag,
  getTopCandidates,
} from "@/lib/cryptoScreener";

interface RsiItem {
  symbol: string;
  rsi_4h: number | null;
  rsi_1d: number | null;
  rsi_1w: number | null;
}
interface NetflowItem {
  token_symbol: string;
  net_flow_24h_usd: number;
}
interface CoinItem {
  symbol: string;
  name: string;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
}
interface TrendingItem { symbol: string; }

interface Props {
  rsiAll:   RsiItem[]     | null | undefined;
  netflows: NetflowItem[] | null | undefined;
  coins:    CoinItem[]    | null | undefined;
  trending: TrendingItem[];
}

const PRESET_LABELS: Record<PresetKey, string> = {
  overall:    "종합",
  rsi:        "RSI 기술적",
  smartmoney: "스마트머니",
  momentum:   "모멘텀",
};

export default function CoinScreenerSection({ rsiAll, netflows, coins, trending }: Props) {
  const [preset, setPreset] = useState<PresetKey>("overall");

  const trendingSymbols = useMemo(() => trending.map(t => t.symbol), [trending]);

  const top5: ScoredCoin[] = useMemo(
    () => getTopCandidates(rsiAll, netflows, coins, trendingSymbols, PRESETS[preset], 5),
    [rsiAll, netflows, coins, trendingSymbols, preset],
  );

  return (
    <section className="space-y-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          매수 후보 스크리너
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          RSI · 스마트머니 · 모멘텀 종합 점수 기준 TOP 5 · 1시간 갱신
        </p>
      </div>

      {/* 프리셋 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(PRESET_LABELS) as PresetKey[]).map(key => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              preset === key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
            }`}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>

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
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 shrink-0">
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
              {coin.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {coin.tags.map((tag, ti) => (
                    <TagBadge key={ti} tag={tag} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 면책 고지 */}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
        * 투자 추천이 아닙니다. RSI · 스마트머니 · 모멘텀 지표를 자동 합산한 참고용 점수입니다.
        투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
      </p>
    </section>
  );
}

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
