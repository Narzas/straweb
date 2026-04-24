"use client";

import { useState, useMemo, useEffect } from "react";
import {
  FuturesCoin,
  FuturesPresetKey,
  FUTURES_PRESETS,
  FUTURES_PRESET_LABELS,
  getTopFutures,
  getPresetMaxScore,
} from "@/lib/futuresScanner";
import type { FuturesStats, FuturesCoinStats } from "@/lib/futuresStats";

interface Props {
  data: FuturesCoin[];
  stats?: FuturesStats;
}

// 심볼로부터 결정론적 mock 통계 생성 (DB 데이터 부족 시 UI 검증용)
function pseudoMockStat(symbol: string): FuturesCoinStats {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = ((hash << 5) - hash) + symbol.charCodeAt(i);
    hash |= 0;
  }
  const rng = (mod: number) => Math.abs(hash % mod);
  return {
    count: 4 + rng(8),
    hitRate: 30 + rng(55),
    avgReturn24h: 2 + (rng(80) / 10),
    maxReturn24h: 12 + (rng(300) / 10),
    lastSignalHoursAgo: rng(72),
  };
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

export default function FuturesScannerSection({ data, stats }: Props) {
  const [preset, setPreset] = useState<FuturesPresetKey>("overall");
  const [showInfo, setShowInfo] = useState(false);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const scoreMax = useMemo(() => getPresetMaxScore(FUTURES_PRESETS[preset]), [preset]);
  const top10 = useMemo(
    () => getTopFutures(data, FUTURES_PRESETS[preset], 10).map((coin) => ({
      ...coin,
      score: Math.min(100, Math.max(0, Math.round((coin.score / scoreMax) * 100))),
    })),
    [data, preset, scoreMax],
  );

  // 프리셋 변경 또는 초기 진입 시 첫 카드 자동 펼침
  useEffect(() => {
    if (top10.length > 0) setExpandedSymbol(top10[0].symbol);
  }, [preset, top10]);

  return (
    <section className="space-y-4">
      {/* 헤더 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pl-3 border-l-2 border-indigo-500">
            📡 선물 시그널 <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(가격+OI 조합 · 펀딩비 건강도 · 타이밍 점수 · TOP 10)</span>
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

        {/* 백테스트 통계 카드 */}
        {stats && (
          <div className="relative mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-800/30 px-4 py-3 overflow-hidden">
            {/* 본 콘텐츠 (mock일 땐 흐림 처리) */}
            <div className={stats.overall.isMock ? "opacity-15 blur-md pointer-events-none select-none" : ""}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  지난 {stats.overall.daysCovered}일 백테스트
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700">
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">적중률</p>
                  <p className="text-xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {stats.overall.hitRate.toFixed(0)}<span className="text-sm font-bold">%</span>
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">평균 수익</p>
                  <p className="text-xl font-extrabold leading-none text-blue-600 dark:text-blue-400 tabular-nums">
                    +{stats.overall.avgReturn24h.toFixed(1)}<span className="text-sm font-bold">%</span>
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">최고 수익</p>
                  <p className="text-xl font-extrabold leading-none text-amber-600 dark:text-amber-400 tabular-nums">
                    +{stats.overall.maxReturn24h.toFixed(1)}<span className="text-sm font-bold">%</span>
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                총 {stats.overall.totalSignals}개 시그널 · 24h 후 +5% 이상 도달 = 적중
              </p>
            </div>

            {/* mock일 때 오버레이 메시지 */}
            {stats.overall.isMock && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 gap-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    백테스트 데이터 수집 중
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  실제 시그널 30건 이상 누적되면 적중률·수익률이 표시됩니다
                </p>
              </div>
            )}
          </div>
        )}
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
            <>
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
              👆 코인 카드를 탭하면 과거 시그널 통계가 표시됩니다
              {stats?.overall.isMock && (
                <span className="block sm:inline text-[12px] font-normal text-gray-500 dark:text-gray-400 sm:ml-1">
                  (현재 데이터 수집 중 — 시그널 누적 후 활성화)
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {top10.map((coin, idx) => {
                const coinStats = stats?.byCoin[coin.symbol.toUpperCase()]
                  ?? (stats?.overall.isMock ? pseudoMockStat(coin.symbol) : undefined);
                const isExpanded = expandedSymbol === coin.symbol;
                return (
                <div key={coin.symbol} className="relative group">
                  {/* 적중률 도장 — 표본 30건 이상 + 양극단(≥80 / <20)만 표시 */}
                  {coinStats && coinStats.count >= 30 && (coinStats.hitRate >= 80 || coinStats.hitRate < 20) && (
                    <div
                      className={`pointer-events-none absolute -top-1.5 -right-1.5 z-20 w-9 h-9 rounded-full border-2 flex flex-col items-center justify-center font-extrabold -rotate-12 ${
                        coinStats.hitRate >= 80
                          ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          : "border-red-500 text-red-600 dark:text-red-400"
                      }`}
                      aria-label={`적중률 ${coinStats.hitRate.toFixed(0)}%`}
                    >
                      <span className="text-[12px] leading-none tabular-nums">
                        {coinStats.hitRate.toFixed(0)}
                      </span>
                      <span className="text-[7px] leading-none mt-0.5 font-bold">적중</span>
                    </div>
                  )}
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
                  <button
                    type="button"
                    onClick={() => setExpandedSymbol(isExpanded ? null : coin.symbol)}
                    className={`w-full text-left rounded-lg border bg-white dark:bg-slate-800/60 px-3 py-2 space-y-1.5 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors ${
                      isExpanded
                        ? "border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-300 dark:ring-indigo-700"
                        : preset === "overheat"
                          ? "border-red-200 dark:border-red-900/50"
                          : "border-gray-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 w-4 shrink-0">#{idx + 1}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 shrink-0 w-16">{coin.symbol}</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <PriceArrow v={coin.priceChange1h} />
                        <PriceTag label="1H" v={coin.priceChange1h} />
                        <PriceTag label="4H" v={coin.priceChange4h} />
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {coin.score}<span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">/100</span>
                      </span>
                      <span className={`text-sm text-gray-500 dark:text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} aria-hidden>
                        ▼
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 flex-wrap">
                      <span>펀딩 {fmtPct(coin.fundingRate * 100)}</span>
                      <span>·</span>
                      <span className={
                        coin.oiChangePct > 0  ? "text-blue-500 dark:text-blue-400 font-medium" :
                        coin.oiChangePct < 0  ? "text-orange-500 dark:text-orange-400 font-medium" :
                                                ""
                      }>
                        OI {fmtPct(coin.oiChangePct)}
                      </span>
                      <span>·</span>
                      <span>거래량 {fmtVol(coin.volume4hUsd)}</span>
                      {coin.volumeSpike >= 1.5 && <span className="text-yellow-500 font-medium">· {coin.volumeSpike.toFixed(1)}x↑</span>}
                      {coin.marketCapUsd !== null && <span>· 시총 {fmtCap(coin.marketCapUsd)}</span>}
                    </div>
                    <ScoreBar score={coin.score} />
                  </button>

                  {/* 펼침 패널 — 코인별 과거 통계 */}
                  {isExpanded && (
                    <div className="mt-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-900/20 px-3 py-2.5 space-y-2">
                      {coinStats ? (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                              {coin.symbol} 과거 시그널 통계
                            </p>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              {coinStats.lastSignalHoursAgo < 24
                                ? `${coinStats.lastSignalHoursAgo}시간 전`
                                : `${Math.floor(coinStats.lastSignalHoursAgo / 24)}일 전`} 마지막 신호
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center">
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">시그널</p>
                              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{coinStats.count}회</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">적중률</p>
                              <p className={`text-sm font-bold ${
                                coinStats.hitRate >= 60 ? "text-emerald-600 dark:text-emerald-400" :
                                coinStats.hitRate >= 40 ? "text-yellow-600 dark:text-yellow-400" :
                                "text-red-500 dark:text-red-400"
                              }`}>{coinStats.hitRate.toFixed(0)}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">평균</p>
                              <p className={`text-sm font-bold ${
                                coinStats.avgReturn24h > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                              }`}>{coinStats.avgReturn24h >= 0 ? "+" : ""}{coinStats.avgReturn24h.toFixed(1)}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">최고</p>
                              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">+{coinStats.maxReturn24h.toFixed(1)}%</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed border-t border-indigo-200 dark:border-indigo-800/40 pt-1.5">
                            * 24시간 후 +5% 이상 도달 = 적중<br />
                            과거 통계가 미래 수익을 보장하지 않습니다.
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center py-2">
                          이 코인의 과거 시그널이 아직 없습니다 (지난 7일).
                        </p>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            </>
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
