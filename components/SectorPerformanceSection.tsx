"use client";

import { useState } from "react";

type SectorItem = {
  id: string;
  name: string;
  market_cap_change_24h: number;
  volume_24h: number | null;
};

function cellStyle(pct: number): { bg: string; border: string; text: string } {
  const abs = Math.abs(pct);
  const isUp = pct >= 0;

  if (isUp) {
    if (abs >= 10) return { bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300 dark:border-emerald-700/50", text: "text-emerald-700 dark:text-emerald-300" };
    if (abs >= 5)  return { bg: "bg-emerald-50 dark:bg-emerald-900/20",  border: "border-emerald-200 dark:border-emerald-800/50", text: "text-emerald-600 dark:text-emerald-400" };
    if (abs >= 2)  return { bg: "bg-emerald-50/70 dark:bg-emerald-900/10", border: "border-emerald-200/70 dark:border-emerald-800/30", text: "text-emerald-600 dark:text-emerald-400" };
    return           { bg: "bg-emerald-50/40 dark:bg-emerald-900/5",   border: "border-emerald-100 dark:border-emerald-900/20", text: "text-emerald-500 dark:text-emerald-500" };
  } else {
    if (abs >= 10) return { bg: "bg-red-100 dark:bg-red-900/30",      border: "border-red-300 dark:border-red-700/50",      text: "text-red-700 dark:text-red-300" };
    if (abs >= 5)  return { bg: "bg-red-50 dark:bg-red-900/20",        border: "border-red-200 dark:border-red-800/50",      text: "text-red-600 dark:text-red-400" };
    if (abs >= 2)  return { bg: "bg-red-50/70 dark:bg-red-900/10",     border: "border-red-200/70 dark:border-red-800/30",   text: "text-red-500 dark:text-red-400" };
    return           { bg: "bg-red-50/40 dark:bg-red-900/5",          border: "border-red-100 dark:border-red-900/20",      text: "text-red-400 dark:text-red-500" };
  }
}

function fmtVol(v: number | null): string {
  if (!v) return "—";
  if (v >= 1_000_000_000) return "$" + (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
  return "$" + v.toLocaleString();
}

function SectorCell({ s }: { s: SectorItem }) {
  const pct = s.market_cap_change_24h;
  const { bg, border, text } = cellStyle(pct);

  return (
    <div className={`relative group/cell rounded-xl border px-3 py-2 flex flex-col gap-0.5 cursor-default ${bg} ${border}`}>
      <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-tight truncate block">{s.name}</span>
      <span className={`text-[12px] font-black tabular-nums ${text}`}>
        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </span>
      {/* 호버 툴팁 */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-44 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-100">
        <div className="rounded-xl bg-gray-900 dark:bg-slate-700 shadow-xl px-3 py-2.5 text-[11px] text-white space-y-1.5">
          <p className="font-bold leading-snug">{s.name}</p>
          <div className="flex justify-between gap-2 border-t border-white/10 pt-1.5">
            <span className="text-gray-400">시총 변동 24h</span>
            <span className={`font-bold tabular-nums ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">거래량 24h</span>
            <span className="font-mono tabular-nums">{fmtVol(s.volume_24h)}</span>
          </div>
        </div>
        <div className="w-2 h-2 bg-gray-900 dark:bg-slate-700 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  );
}

function InfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3 text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
      <div className="flex items-start justify-between gap-2">
        <p>
          <span className="font-semibold text-slate-800 dark:text-slate-200">섹터별 24h 성과란?</span><br />
          DeFi·Layer1·GameFi 등 <strong className="text-slate-700 dark:text-slate-300">코인 카테고리(섹터)</strong>의 시가총액 변화율을 기준으로 지난 24시간 동안 가장 강하고 약한 섹터를 보여줍니다.
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer shrink-0 mt-0.5">✕</button>
      </div>
      <div className="space-y-1.5">
        <p className="font-semibold text-slate-700 dark:text-slate-300">활용 방법</p>
        <ul className="space-y-1 pl-1">
          <li><span className="text-emerald-600 dark:text-emerald-400 font-medium">🚀 상승 TOP 5</span> — 현재 자금이 몰리는 테마. 해당 섹터 내 개별 코인 탐색에 활용.</li>
          <li><span className="text-red-500 font-medium">💥 하락 TOP 5</span> — 자금이 이탈 중인 테마. 반등 기대 또는 회피 판단 참고용.</li>
          <li><span className="text-slate-600 dark:text-slate-400 font-medium">색상 강도</span> — 진할수록 변화폭이 큼 (±2% / ±5% / ±10% 기준).</li>
        </ul>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-500">
        데이터 출처: CoinGecko. 투자 권유가 아닙니다.
      </p>
    </div>
  );
}

export default function SectorPerformanceSection({ sectors }: { sectors: SectorItem[] }) {
  const [showInfo, setShowInfo] = useState(false);

  if (!sectors?.length) return null;

  const sorted = [...sectors]
    .filter((s) => s.market_cap_change_24h != null)
    .sort((a, b) => b.market_cap_change_24h - a.market_cap_change_24h);

  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  return (
    <section className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pl-3 border-l-2 border-indigo-500">
          🏷️ 섹터별 24h 성과
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
      {showInfo && <InfoPanel onClose={() => setShowInfo(false)} />}
      <div className="grid gap-3 sm:grid-cols-2 flex-1 sm:items-stretch">
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-800 flex flex-col">
          <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50 rounded-t-2xl">
            <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">🚀 상승 TOP 5</span>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {top5.map((s) => <SectorCell key={s.id} s={s} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 flex flex-col">
          <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50 rounded-t-2xl">
            <span className="text-[12px] font-bold text-red-500">💥 하락 TOP 5</span>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {bottom5.map((s) => <SectorCell key={s.id} s={s} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
