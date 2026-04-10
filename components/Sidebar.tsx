"use client";

import { useEffect, useState } from "react";
import ClockWeatherWidget from "./ClockWeatherWidget";
import GuestbookPreview from "./GuestbookPreview";

type MarketData = {
  bitcoin: { usd: number | null; krw: number | null; change24h: number | null };
  usdKrw: number | null;
};

type NewsItem = { title: string; link: string; source: string };
type NewsCategory = { key: string; label: string; items: NewsItem[] };

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-100 ${className ?? ""}`} />
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

  const fmtKrw = (n: number) =>
    "₩" + Math.round(n).toLocaleString("ko-KR");

  const fmtUsd = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const activeNews = categories[activeTab]?.items ?? [];

  return (
    <div className="space-y-4 sticky top-24">

      {/* ── 시계 + 날씨 통합 카드 ── */}
      <ClockWeatherWidget />

      {/* ── 시세 카드 ── */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        {marketLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : !market ? (
          <p className="text-xs text-gray-400">데이터를 불러올 수 없습니다.</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {/* BTC */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-medium text-gray-500 shrink-0">₿</span>
              {market.bitcoin.krw !== null && (
                <span className="text-[13px] font-bold text-gray-900 truncate">
                  {fmtKrw(market.bitcoin.krw)}
                </span>
              )}
              {market.bitcoin.change24h !== null && (
                <span
                  className={`text-[11px] font-semibold shrink-0 ${
                    market.bitcoin.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {market.bitcoin.change24h >= 0 ? "▲" : "▼"}
                  {Math.abs(market.bitcoin.change24h).toFixed(1)}%
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-gray-200 shrink-0" />

            {/* USD/KRW */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-gray-500">$</span>
              {market.usdKrw !== null && (
                <span className="text-[13px] font-bold text-gray-900">
                  {market.usdKrw.toLocaleString("ko-KR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  <span className="ml-0.5 text-[10px] font-normal text-gray-400">원</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 실시간 뉴스 카드 ── */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          실시간 뉴스
        </p>

        {/* 카테고리 탭 */}
        {!newsLoading && categories.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {categories.map((cat, i) => (
              <button
                key={cat.key}
                onClick={() => setActiveTab(i)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  i === activeTab
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
          <p className="text-xs text-gray-400">뉴스를 불러올 수 없습니다.</p>
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
                    className="block text-xs leading-snug text-gray-700 hover:text-indigo-600 line-clamp-2 transition-colors"
                  >
                    {item.title}
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-3 text-[10px] text-gray-300 text-right">Google News</p>
      </div>

      {/* ── 방명록 미리보기 ── */}
      <GuestbookPreview />
    </div>
  );
}
