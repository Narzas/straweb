"use client";

import { useState } from "react";

type GainerLoserItem = {
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  image?: string | null;
};

type GainersLosersData = {
  gainers: GainerLoserItem[];
  losers: GainerLoserItem[];
};

function fmtPrice(n: number) {
  if (n >= 1) return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + n.toFixed(4);
}

function Row({ item, isGainer }: { item: GainerLoserItem; isGainer: boolean }) {
  const pct = item.price_change_percentage_24h;
  const accent = isGainer ? "text-emerald-500" : "text-red-500";
  return (
    <div className={`relative group/row flex flex-1 items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-slate-700/50 last:border-0 transition-colors cursor-default ${isGainer ? "hover:bg-emerald-500/5" : "hover:bg-red-500/5"}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.symbol} loading="lazy" className="w-4 h-4 rounded-full shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100 truncate">{item.symbol}</p>
          <p className="text-[10px] text-gray-400 truncate">{item.name}</p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-1">
        <p className={`text-[12px] font-bold tabular-nums ${accent}`}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
        </p>
        <p className="text-[10px] text-gray-400 tabular-nums">{fmtPrice(item.current_price)}</p>
      </div>
      {/* 호버 툴팁 */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-48 opacity-0 group-hover/row:opacity-100 transition-opacity duration-100">
        <div className="rounded-xl bg-gray-900 dark:bg-slate-700 shadow-xl px-3 py-2.5 text-[11px] text-white space-y-1.5">
          <div className="flex items-center gap-1.5">
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={item.symbol} className="w-4 h-4 rounded-full" />
            )}
            <span className="font-bold">{item.symbol}</span>
            <span className="text-gray-400 truncate">{item.name}</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-white/10 pt-1.5">
            <span className="text-gray-400">24h 변동</span>
            <span className={`font-bold tabular-nums ${accent}`}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">현재가</span>
            <span className="font-mono tabular-nums">{fmtPrice(item.current_price)}</span>
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
          <span className="font-semibold text-slate-800 dark:text-slate-200">수익률 TOP/BOTTOM이란?</span><br />
          시가총액 상위 <strong className="text-slate-700 dark:text-slate-300">250개 코인</strong> 중 지난 24시간 동안 가장 많이 오르고 내린 코인을 각각 5개씩 보여줍니다.
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer shrink-0 mt-0.5">✕</button>
      </div>
      <div className="space-y-1.5">
        <p className="font-semibold text-slate-700 dark:text-slate-300">표시 항목</p>
        <ul className="space-y-1 pl-1">
          <li><span className="text-emerald-600 dark:text-emerald-400 font-medium">🚀 급등 TOP 5</span> — 24h 상승률 상위 5개. 강한 모멘텀이 있지만 추격 매수 주의.</li>
          <li><span className="text-red-500 font-medium">💥 급락 TOP 5</span> — 24h 하락률 상위 5개. 반등 후보일 수 있으나 추가 하락 리스크 존재.</li>
        </ul>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-500">
        데이터 출처: CoinGecko. 투자 권유가 아닙니다.
      </p>
    </div>
  );
}

export default function GainersLosersSection({ data }: { data: GainersLosersData }) {
  const [showInfo, setShowInfo] = useState(false);

  if (!data?.gainers?.length && !data?.losers?.length) return null;

  return (
    <section className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="pl-3 border-l-2 border-indigo-500">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            📊 수익률 TOP/BOTTOM
          </h2>
          <p className="text-[11px] text-gray-400">(시총 250위 내 24h)</p>
        </div>
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
        {data.gainers?.length > 0 && (
          <div className="rounded-2xl border border-slate-700/50 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50">
              <span className="text-[12px] font-bold text-emerald-500">🚀 급등 TOP 5</span>
            </div>
            <div className="flex flex-col flex-1">
              {data.gainers.map((item) => <Row key={item.symbol} item={item} isGainer={true} />)}
            </div>
          </div>
        )}
        {data.losers?.length > 0 && (
          <div className="rounded-2xl border border-slate-700/50 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
              <span className="text-[12px] font-bold text-red-500">💥 급락 TOP 5</span>
            </div>
            <div className="flex flex-col flex-1">
              {data.losers.map((item) => <Row key={item.symbol} item={item} isGainer={false} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
