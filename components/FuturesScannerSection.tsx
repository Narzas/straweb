"use client";

import { useState, useMemo } from "react";
import {
  FuturesCoin,
  FuturesPresetKey,
  FUTURES_PRESETS,
  FUTURES_PRESET_LABELS,
  getTopFutures,
  getPresetMaxScore,
} from "@/lib/futuresScanner";

interface Props {
  data: FuturesCoin[];
}

// ── 포맷 헬퍼 ────────────────────────────────────────────────────────────────

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

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// ── 스캐너 서브 컴포넌트 ─────────────────────────────────────────────────────

function PriceArrow({ v }: { v: number }) {
  if (v > 1)  return <span className="text-emerald-500 font-bold">↑</span>;
  if (v < -1) return <span className="text-red-400 font-bold">↓</span>;
  return <span className="text-gray-400">→</span>;
}

function PriceTag({ label, v }: { label: string; v: number }) {
  const color = v > 1 ? "text-emerald-500" : v < -1 ? "text-red-400" : "text-gray-400 dark:text-gray-500";
  return (
    <span className={`text-[10px] font-medium ${color}`}>
      {label} {fmtPct(v)}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 60 ? "bg-emerald-500" :
    score >= 35 ? "bg-yellow-400" :
                  "bg-red-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function InfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3 text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
      <div className="flex items-start justify-between gap-2">
        <p>
          <span className="font-semibold text-slate-800 dark:text-slate-200">선물 시그널이란?</span><br />
          단순히 <strong className="text-slate-700 dark:text-slate-300">"움직인 코인"</strong>이 아닌, <strong className="text-slate-700 dark:text-slate-300">"돈이 쌓이는 자리"</strong>를 찾는 도구입니다.
          펀딩비·가격·미결제약정(OI)·거래량을 조합해 자동 점수화합니다.
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer shrink-0 mt-0.5">✕</button>
      </div>
      <div className="space-y-1.5">
        <p className="font-semibold text-slate-700 dark:text-slate-300">점수 구조 (100점 만점)</p>
        <ul className="space-y-1 pl-1">
          <li><span className="text-green-600 dark:text-green-400 font-medium">펀딩비 건강도 (25pt)</span> — 0~0.01% 최고점. 펀딩 과열은 감점 (롱 과열 신호).</li>
          <li><span className="text-blue-600 dark:text-blue-400 font-medium">가격+OI 조합 (30pt)</span> — 가격↓+OI↑ = 숏 쌓임(롱 기회🔥) / 가격↑+OI↑ = 추세 / 횡보+OI↑ = 포지션 축적.</li>
          <li><span className="text-yellow-600 dark:text-yellow-400 font-medium">거래량 상대 점수 (20pt)</span> — 전체 대상 중 상위 10% 최고점.</li>
          <li><span className="text-purple-600 dark:text-purple-400 font-medium">타이밍 점수 (25pt)</span> — 4H 횡보 + OI 6H 증가 + 거래량 증가 시작 → 막 터지기 직전 포착.</li>
        </ul>
        <p className="text-red-500 dark:text-red-400 font-medium mt-1">패널티: 1H +8% 이상(이미 터짐) / 펀딩 과열 / 거래량 5배 급증 / 시총 $20M 미만(조작 위험)</p>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-300">프리셋별 특징</p>
        <ul className="space-y-0.5 pl-1">
          <li><span className="font-medium">종합</span> — 모든 지표 균등 반영. 기본값.</li>
          <li><span className="font-medium">초기 유입</span> — 타이밍 점수 2.5배 가중. OI 축적 + 횡보 구간 집중.</li>
          <li><span className="font-medium">추세 추종</span> — 가격+OI 조합 2배. 이미 방향이 잡힌 코인.</li>
          <li><span className="font-medium">숏 스퀴즈</span> — 가격↓+OI↑ 콤보 극대화. 반등 후보 탐색.</li>
          <li><span className="font-medium">과열 구간</span> — 패널티 제거, 현재 과열 중인 코인 탐색 (진입보다 회피 참고용).</li>
        </ul>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function FuturesScannerSection({ data }: Props) {
  const [preset, setPreset] = useState<FuturesPresetKey>("overall");
  const [showInfo, setShowInfo] = useState(false);

  const scoreMax = useMemo(() => getPresetMaxScore(FUTURES_PRESETS[preset]), [preset]);
  const top10 = useMemo(
    () => getTopFutures(data, FUTURES_PRESETS[preset], 10).map((coin) => ({
      ...coin,
      score: Math.min(100, Math.max(0, Math.round((coin.score / scoreMax) * 100))),
    })),
    [data, preset, scoreMax],
  );

  return (
    <section className="space-y-4">
      {/* 헤더 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pl-3 border-l-2 border-indigo-500">
            📡 선물 시그널
          </h2>
          {!showInfo && (
            <button
              onClick={() => setShowInfo(true)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer border border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shrink-0"
            >
              이게 뭔가요?
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          가격+OI 조합 · 펀딩비 건강도 · 타이밍 점수 · TOP 10
        </p>
      </div>

      {/* 스캐너 */}
      <>
        {showInfo && <InfoPanel onClose={() => setShowInfo(false)} />}

          {/* 프리셋 탭 */}
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(FUTURES_PRESET_LABELS) as FuturesPresetKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  preset === key
                    ? key === "overheat"
                      ? "bg-red-500 text-white"
                      : "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                }`}
              >
                {key === "overheat" ? "⚠️ " : ""}{FUTURES_PRESET_LABELS[key]}
              </button>
            ))}
          </div>

          {preset === "overheat" && (
            <p className="text-[11px] text-red-500 dark:text-red-400 font-medium">
              ⚠️ 경고 모드: 현재 과열 신호가 강한 코인입니다. 진입보다는 회피 참고용으로 사용하세요.
            </p>
          )}

          {top10.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4">
              데이터가 충분하지 않습니다. 다음 갱신 시 표시됩니다.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {top10.map((coin, idx) => (
                <div key={coin.symbol} className="relative group">
                  {/* 툴팁 */}
                  <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 w-64 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 shadow-xl px-3 py-2.5 space-y-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <p className="text-xs font-bold text-white">{coin.symbol} <span className="text-slate-400 font-normal">#{idx + 1}위</span></p>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">1H 가격</span>
                        <span className={coin.priceChange1h > 1 ? "text-emerald-400 font-medium" : coin.priceChange1h < -1 ? "text-red-400 font-medium" : "text-slate-400"}>
                          {fmtPct(coin.priceChange1h)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">4H 가격</span>
                        <span className={coin.priceChange4h > 2 ? "text-emerald-400 font-medium" : coin.priceChange4h < -2 ? "text-red-400 font-medium" : "text-slate-400"}>
                          {fmtPct(coin.priceChange4h)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">OI (1H / 6H)</span>
                        <span className={coin.oiChangePct > 0 ? "text-blue-400 font-medium" : "text-slate-400"}>
                          {fmtPct(coin.oiChangePct)} / {fmtPct(coin.oiChangePct6h)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">펀딩비</span>
                        <span className={
                          coin.fundingRate * 100 > 0.03 ? "text-red-400 font-medium" :
                          coin.fundingRate * 100 > 0.01 ? "text-yellow-400 font-medium" :
                          coin.fundingRate >= 0 ? "text-green-400 font-medium" : "text-slate-400"
                        }>
                          {fmtPct(coin.fundingRate * 100)}
                          {coin.fundingRate * 100 > 0.03 ? " 🔴" : coin.fundingRate * 100 > 0.01 ? " 🟡" : coin.fundingRate >= 0 ? " 🟢" : ""}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">거래량 (4H) / 급등</span>
                        <span className="text-yellow-400 font-medium">
                          {fmtVol(coin.volume4hUsd)} / {coin.volumeSpike.toFixed(1)}x
                        </span>
                      </div>
                      {coin.marketCapUsd !== null && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">시가총액</span>
                          <span className={`font-medium ${coin.marketCapUsd < 20_000_000 ? "text-red-400" : coin.marketCapUsd < 50_000_000 ? "text-yellow-400" : "text-slate-300"}`}>
                            {fmtCap(coin.marketCapUsd)}
                            {coin.marketCapUsd < 20_000_000 ? " ⚠️" : ""}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-700 pt-1 mt-0.5">
                        <span className="text-slate-400">종합 점수</span>
                        <span className="text-indigo-400 font-bold">{coin.score} / 100</span>
                      </div>
                    </div>
                  </div>

                  {/* 카드 */}
                  <div className={`rounded-lg border bg-white dark:bg-slate-800/60 px-3 py-2 space-y-1.5 ${
                    preset === "overheat"
                      ? "border-red-200 dark:border-red-900/50"
                      : "border-gray-200 dark:border-slate-700"
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 w-4 shrink-0">#{idx + 1}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 shrink-0 w-16">{coin.symbol}</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                        <PriceArrow v={coin.priceChange1h} />
                        <PriceTag label="1H" v={coin.priceChange1h} />
                        <PriceTag label="4H" v={coin.priceChange4h} />
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:inline">
                          OI {fmtPct(coin.oiChangePct)}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {coin.score}<span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">/100</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                      <span>펀딩 {fmtPct(coin.fundingRate * 100)}</span>
                      <span>·</span>
                      <span>4H거래량 {fmtVol(coin.volume4hUsd)}</span>
                      {coin.volumeSpike >= 1.5 && <span className="text-yellow-500 font-medium">· {coin.volumeSpike.toFixed(1)}x↑</span>}
                      {coin.marketCapUsd !== null && <span>· 시총 {fmtCap(coin.marketCapUsd)}</span>}
                    </div>
                    <ScoreBar score={coin.score} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-yellow-200 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2">
            <p className="text-[11px] text-yellow-700 dark:text-yellow-400 leading-relaxed font-medium">
              ⚠️ 투자 추천이 아닙니다. 가격·OI·펀딩비·거래량을 자동 합산한 참고용 점수입니다.
              투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
            </p>
          </div>
      </>
    </section>
  );
}
