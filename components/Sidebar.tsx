"use client";

import { useEffect, useState } from "react";
import ClockWeatherWidget from "./ClockWeatherWidget";

type IndexData = { price: number | null; change: number | null };

type MarketData = {
  bitcoin: { usd: number | null; krw: number | null; change24h: number | null };
  nasdaq: IndexData;
  kospi: IndexData;
  kosdaq: IndexData;
  usdKrw: number | null;
};

type NewsItem = { title: string; link: string; source: string };
type NewsCategory = { key: string; label: string; items: NewsItem[] };

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-100 dark:bg-slate-700 ${className ?? ""}`} />
  );
}

function MarketRow({
  icon,
  label,
  value,
  sub,
  change,
  bg,
  labelColor,
}: {
  icon: string;
  label: string;
  value: string | null;
  sub?: string;
  change?: number | null;
  bg: string;
  labelColor: string;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-1.5 border ${bg}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none">{icon}</span>
        <span className={`text-[11px] font-semibold ${labelColor}`}>{label}</span>
      </div>
      <div className="text-right">
        {value ? (
          <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {value}
            {sub && <span className="ml-0.5 text-[10px] font-normal text-gray-400">{sub}</span>}
          </p>
        ) : (
          <p className="text-[11px] text-gray-400">-</p>
        )}
        {change != null && (
          <p className={`text-[11px] font-semibold tabular-nums ${change >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
          </p>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [marketLoading, setMarketLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    async function loadMarket() {
      try {
        const res = await fetch("/api/market");
        if (res.ok) setMarket(await res.json());
      } finally {
        setMarketLoading(false);
      }
    }
    async function loadNews() {
      try {
        const res = await fetch("/api/news");
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories ?? []);
        }
      } finally {
        setNewsLoading(false);
      }
    }

    loadMarket();
    loadNews();

    const t1 = setInterval(loadMarket, 300_000);
    const t2 = setInterval(loadNews, 600_000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const fmtKrw = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
  const fmtIdx = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const activeNews = categories[activeTab]?.items ?? [];

  return (
    <div className="space-y-4 lg:sticky lg:top-24">

      {/* 시계 + 날씨 */}
      <ClockWeatherWidget />

      {/* 시세 카드 — 비트코인 / 나스닥 / 코스피 / 코스닥 / 달러 */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 shadow-sm space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-0.5">
          실시간 시세
        </p>
        {marketLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : !market ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 px-1">데이터를 불러올 수 없습니다.</p>
        ) : (
          <>
            {/* 비트코인 */}
            <MarketRow
              icon="₿"
              label="비트코인"
              value={market.bitcoin.krw != null ? fmtKrw(market.bitcoin.krw) : null}
              change={market.bitcoin.change24h}
              bg="bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30"
              labelColor="text-amber-700 dark:text-amber-400"
            />
            {/* 나스닥 */}
            <MarketRow
              icon="🇺🇸"
              label="나스닥"
              value={market.nasdaq.price != null ? fmtIdx(market.nasdaq.price) : null}
              change={market.nasdaq.change}
              bg="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30"
              labelColor="text-blue-700 dark:text-blue-400"
            />
            {/* 코스피 */}
            <MarketRow
              icon="🇰🇷"
              label="코스피"
              value={market.kospi.price != null ? fmtIdx(market.kospi.price) : null}
              change={market.kospi.change}
              bg="bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30"
              labelColor="text-rose-700 dark:text-rose-400"
            />
            {/* 코스닥 */}
            <MarketRow
              icon="📊"
              label="코스닥"
              value={market.kosdaq.price != null ? fmtIdx(market.kosdaq.price) : null}
              change={market.kosdaq.change}
              bg="bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30"
              labelColor="text-purple-700 dark:text-purple-400"
            />
            {/* 달러 환율 */}
            <MarketRow
              icon="💵"
              label="달러 환율"
              value={
                market.usdKrw != null
                  ? market.usdKrw.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : null
              }
              sub="원"
              bg="bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30"
              labelColor="text-green-700 dark:text-green-400"
            />
          </>
        )}
      </div>

      {/* 실시간 뉴스 */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          실시간 뉴스
        </p>

        {!newsLoading && categories.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {categories.map((cat, i) => (
              <button
                key={cat.key}
                onClick={() => setActiveTab(i)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  i === activeTab
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {newsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : activeNews.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">뉴스를 불러올 수 없습니다.</p>
        ) : (
          <ol className="space-y-3">
            {activeNews.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0 text-xs font-bold text-indigo-400 w-4">
                  {i + 1}
                </span>
                <div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs leading-snug text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 transition-colors"
                  >
                    {item.title}
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-3 text-[10px] text-gray-300 dark:text-slate-600 text-right">Google News</p>
      </div>
    </div>
  );
}
