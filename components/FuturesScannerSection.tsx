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

interface Signal {
  id: number;
  recorded_at: string;
  symbol: string;
  rank: number;
  entry_price: number;
  score: number;
  price_1h: number | null;
  price_4h: number | null;
  price_24h: number | null;
}

interface Props {
  data: FuturesCoin[];
  signals?: Signal[];
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

function InfoPanel() {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3 text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
      <p>
        <span className="font-semibold text-slate-800 dark:text-slate-200">선물 시그널이란?</span><br />
        단순히 <strong className="text-slate-700 dark:text-slate-300">"움직인 코인"</strong>이 아닌, <strong className="text-slate-700 dark:text-slate-300">"돈이 쌓이는 자리"</strong>를 찾는 도구입니다.
        펀딩비·가격·미결제약정(OI)·거래량을 조합해 자동 점수화합니다.
      </p>
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

function TrackingInfoPanel() {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3 text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
      <p>
        <span className="font-semibold text-slate-800 dark:text-slate-200">트래킹이란?</span><br />
        매시간 정각, 선물 시그널 <strong className="text-slate-700 dark:text-slate-300">TOP 10 코인의 진입가</strong>를 자동 기록하고
        1시간 · 4시간 · 24시간 후 실제 가격을 추적해 수익률을 계산합니다.
      </p>
      <div className="space-y-1.5">
        <p className="font-semibold text-slate-700 dark:text-slate-300">표시 항목</p>
        <ul className="space-y-1 pl-1">
          <li><span className="text-indigo-600 dark:text-indigo-400 font-medium">1H / 4H / 24H 수익률</span> — 진입가 대비 각 시점의 등락률. 아직 미집계는 — 표시.</li>
          <li><span className="text-emerald-600 dark:text-emerald-400 font-medium">평균 수익률</span> — 전체 기록된 신호의 시간대별 평균. 플러스면 초록, 마이너스면 빨강.</li>
          <li><span className="text-yellow-600 dark:text-yellow-400 font-medium">승률</span> — 수익이 발생한 신호의 비율 (수익 ÷ 전체 건수).</li>
        </ul>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-500">
        실제 투자가 아닌 시뮬레이션입니다. 슬리피지·수수료는 반영되지 않습니다.
      </p>
    </div>
  );
}

// ── 트래킹 서브 컴포넌트 ─────────────────────────────────────────────────────

function pnl(entry: number, exit: number | null): number | null {
  if (!exit || entry === 0) return null;
  return ((exit - entry) / entry) * 100;
}

function PnlBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300 dark:text-gray-600 text-[11px]">—</span>;
  const pos = value >= 0;
  return (
    <span className={`text-[11px] font-semibold ${pos ? "text-emerald-500" : "text-red-400"}`}>
      {pos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function statsFor(signals: Signal[], field: "price_1h" | "price_4h" | "price_24h") {
  const results = signals
    .map((s) => pnl(s.entry_price, s[field]))
    .filter((v): v is number => v !== null);
  if (results.length === 0) return null;
  const wins = results.filter((v) => v > 0).length;
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  return { count: results.length, winRate: (wins / results.length) * 100, avg };
}

function StatChip({ label, stats }: { label: string; stats: ReturnType<typeof statsFor> }) {
  if (!stats) return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 min-w-[72px]">
      <span className="text-[10px] text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-[11px] text-gray-300 dark:text-gray-600 mt-0.5">집계중</span>
    </div>
  );
  return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 min-w-[72px]">
      <span className="text-[10px] text-gray-400 dark:text-gray-500">{label} ({stats.count}건)</span>
      <span className={`text-sm font-bold mt-0.5 ${stats.avg >= 0 ? "text-emerald-500" : "text-red-400"}`}>
        {stats.avg >= 0 ? "+" : ""}{stats.avg.toFixed(2)}%
      </span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500">승률 {stats.winRate.toFixed(0)}%</span>
    </div>
  );
}

function TrackingTab({ signals }: { signals: Signal[] }) {
  const stats1h  = statsFor(signals, "price_1h");
  const stats4h  = statsFor(signals, "price_4h");
  const stats24h = statsFor(signals, "price_24h");

  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  const recent = signals.filter((s) => s.recorded_at >= cutoff);

  const grouped = new Map<string, Signal[]>();
  for (const s of recent) {
    const key = s.recorded_at.slice(0, 16);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const groups = [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  return (
    <div className="space-y-4">
      {/* 통계 */}
      <div className="flex gap-2 flex-wrap">
        <StatChip label="1H 평균" stats={stats1h} />
        <StatChip label="4H 평균" stats={stats4h} />
        <StatChip label="24H 평균" stats={stats24h} />
      </div>

      {/* 시간대별 신호 */}
      <div className="space-y-3">
        {groups.map(([timeKey, group]) => {
          const kstMs = new Date(timeKey + ":00Z").getTime() + 9 * 3600_000;
          const kstStr = new Date(kstMs).toISOString().slice(11, 16) + " KST";
          return (
            <div key={timeKey} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{kstStr}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {group.sort((a, b) => a.rank - b.rank).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3 py-2 flex items-center gap-3"
                  >
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 w-4 shrink-0">#{s.rank}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-16 shrink-0">{s.symbol}</span>
                    <div className="flex gap-3 text-[11px] text-gray-400 dark:text-gray-500 flex-wrap">
                      <span>1H <PnlBadge value={pnl(s.entry_price, s.price_1h)} /></span>
                      <span>4H <PnlBadge value={pnl(s.entry_price, s.price_4h)} /></span>
                      <span>24H <PnlBadge value={pnl(s.entry_price, s.price_24h)} /></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        * 매시간 정각 스캐너 TOP 10 진입가 기준. 투자 결과가 아닌 참고용 시뮬레이션입니다.
      </p>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function FuturesScannerSection({ data, signals = [] }: Props) {
  const [tab, setTab]       = useState<"scanner" | "tracking">("scanner");
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

  const hasTracking = signals.some((s) => s.price_1h !== null);

  return (
    <section className="space-y-4">
      {/* 헤더 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pl-3 border-l-2 border-indigo-500">
            📡 선물 시그널
          </h2>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer border shrink-0 ${
              showInfo
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            }`}
          >
            {showInfo ? "닫기" : "이게 뭔가요?"}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tab === "scanner"
            ? "가격+OI 조합 · 펀딩비 건강도 · 타이밍 점수 · TOP 10"
            : "스캐너 TOP 10 · 1H/4H/24H 수익률 추적"}
        </p>
      </div>

      {/* 큰 탭 */}
      <div className="flex border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => { setTab("scanner"); setShowInfo(false); }}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${
            tab === "scanner"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          스캐너
        </button>
        <button
          onClick={() => { setTab("tracking"); setShowInfo(false); }}
          disabled={!hasTracking}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === "tracking"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 cursor-pointer"
              : hasTracking
                ? "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
                : "border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed"
          }`}
        >
          트래킹{!hasTracking && <span className="ml-1 text-[10px] font-normal">(집계중)</span>}
        </button>
      </div>

      {/* 스캐너 탭 */}
      {tab === "scanner" && (
        <>
          {showInfo && <InfoPanel />}

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
      )}

      {/* 트래킹 탭 */}
      {tab === "tracking" && hasTracking && (
        <>
          {showInfo && <TrackingInfoPanel />}
          <TrackingTab signals={signals} />
        </>
      )}
    </section>
  );
}
