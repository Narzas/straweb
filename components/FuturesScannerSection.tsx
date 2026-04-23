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
  const color =
    score >= 60 ? "bg-emerald-500" :
    score >= 35 ? "bg-yellow-400" :
                  "bg-red-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export default function FuturesScannerSection({ data }: Props) {
  const [preset, setPreset] = useState<FuturesPresetKey>("overall");

  const scoreMax = useMemo(() => {
    const w = FUTURES_PRESETS[preset];
    return 30 * w.volume + 20 * w.funding + 30 * w.oi + 20;
  }, [preset]);

  const top10 = useMemo(
    () => getTopFutures(data, FUTURES_PRESETS[preset], 10).map((coin) => ({
      ...coin,
      score: Math.round((coin.score / scoreMax) * 100),
    })),
    [data, preset, scoreMax],
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
        <ul className="space-y-1.5">
          {top10.map((coin, idx) => (
            <li
              key={coin.symbol}
              className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3 py-2 space-y-1.5"
            >
              {/* 1행: 순위 + 심볼 + 지표 + 점수 */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 w-4 shrink-0">
                  #{idx + 1}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 shrink-0 w-16">
                  {coin.symbol}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex-1">
                  펀딩 +{(coin.fundingRate * 100).toFixed(3)}%
                  {coin.oiChangePct > 0 && ` · OI +${coin.oiChangePct.toFixed(1)}%`}
                  {` · ${fmtVol(coin.volume4hUsd)}`}
                  {coin.marketCapUsd !== null && ` · 시총 ${fmtCap(coin.marketCapUsd)}`}
                </span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {coin.score}<span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">/100</span>
                </span>
              </div>

              {/* 2행: 점수 게이지 바 */}
              <ScoreBar score={coin.score} />
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
