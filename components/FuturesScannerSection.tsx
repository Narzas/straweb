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
