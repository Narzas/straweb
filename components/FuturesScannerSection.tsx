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

function InfoPanel() {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3 text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
      <p>
        <span className="font-semibold text-slate-800 dark:text-slate-200">선물 스캐너란?</span><br />
        Binance USDT 무기한 선물 시장에서 <strong className="text-slate-700 dark:text-slate-300">지금 뭔가 움직이는 저시총 코인</strong>을 자동으로 걸러냅니다.
        펀딩비가 양수(롱 우세)이고, 미결제약정(OI)이 늘고 있으며, 거래량까지 터진 코인을 종합 점수로 순위를 매깁니다.
      </p>
      <div className="space-y-1.5">
        <p className="font-semibold text-slate-700 dark:text-slate-300">점수 구성 (100점 만점)</p>
        <ul className="space-y-1 pl-1">
          <li><span className="text-green-600 dark:text-green-400 font-medium">펀딩비</span> — 양수일수록 롱 포지션 수요가 많다는 신호. 높을수록 고점수.</li>
          <li><span className="text-blue-600 dark:text-blue-400 font-medium">OI 변화 (4H)</span> — 미결제약정 증가 = 신규 자금 유입. 4시간 기준 상승률로 계산.</li>
          <li><span className="text-yellow-600 dark:text-yellow-400 font-medium">거래량 (4H)</span> — 전체 대상 중 거래량 상위 10%면 만점, 25% 이내 고점수.</li>
          <li><span className="text-emerald-600 dark:text-emerald-400 font-medium">시총 보너스</span> — $50M 미만 +20점, $100M 미만 +10점. 저시총일수록 폭발 가능성.</li>
        </ul>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-300">프리셋 탭</p>
        <p>각 탭은 4가지 점수의 가중치를 다르게 적용합니다. <span className="font-medium">고펀딩비</span>는 펀딩비에, <span className="font-medium">OI 급증</span>은 미결제약정에, <span className="font-medium">거래량 폭발</span>은 거래량에 3배 가중치를 줍니다.</p>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">매시간 갱신 · 데이터 출처: Binance Futures 공개 API</p>
    </div>
  );
}

export default function FuturesScannerSection({ data }: Props) {
  const [preset, setPreset] = useState<FuturesPresetKey>("overall");
  const [showInfo, setShowInfo] = useState(false);

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
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            선물 스캐너
          </h2>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center text-[11px] font-bold cursor-pointer"
            aria-label="선물 스캐너 설명"
          >
            ?
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Binance USDT Perp · 펀딩비 양수 · OI 증가 · 저시총 기준 · TOP 10
        </p>
      </div>

      {showInfo && <InfoPanel />}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {top10.map((coin, idx) => (
            <div
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
            </div>
          ))}
        </div>
      )}

      {/* 면책 고지 */}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
        * 투자 추천이 아닙니다. Binance 선물 시장의 펀딩비·OI·거래량을 자동 합산한 참고용 점수입니다.
        투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
      </p>
    </section>
  );
}
