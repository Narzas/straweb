"use client";

import { useEffect, useState } from "react";

type MarketData = {
  bitcoin: { usd: number | null; krw: number | null; change24h: number | null };
  usdKrw: number | null;
};

type NewsItem = { title: string; link: string; source: string };

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-100 ${className ?? ""}`} />
  );
}

export default function Sidebar() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
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
          setNews(data.items ?? []);
        }
      } finally {
        setNewsLoading(false);
      }
    }

    loadMarket();
    loadNews();

    const t1 = setInterval(loadMarket, 60_000);
    const t2 = setInterval(loadNews, 300_000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const fmtKrw = (n: number) =>
    "₩" + Math.round(n).toLocaleString("ko-KR");

  const fmtUsd = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-5 sticky top-24">

      {/* ── 시세 카드 ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          실시간 시세
        </p>

        {marketLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-5 w-3/5" />
            </div>
          </div>
        ) : !market ? (
          <p className="text-xs text-gray-400">데이터를 불러올 수 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {/* BTC */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">₿ 비트코인</span>
                {market.bitcoin.change24h !== null && (
                  <span
                    className={`text-[11px] font-semibold ${
                      market.bitcoin.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {market.bitcoin.change24h >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(market.bitcoin.change24h).toFixed(2)}%
                  </span>
                )}
              </div>
              {market.bitcoin.krw !== null && (
                <p className="text-[15px] font-bold text-gray-900 leading-tight mt-0.5">
                  {fmtKrw(market.bitcoin.krw)}
                </p>
              )}
              {market.bitcoin.usd !== null && (
                <p className="text-xs text-gray-400">{fmtUsd(market.bitcoin.usd)}</p>
              )}
            </div>

            {/* USD/KRW */}
            <div className="border-t border-gray-100 pt-3">
              <span className="text-xs font-medium text-gray-500">$ 달러 환율</span>
              {market.usdKrw !== null && (
                <p className="text-[15px] font-bold text-gray-900 leading-tight mt-0.5">
                  {market.usdKrw.toLocaleString("ko-KR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="text-xs font-normal text-gray-400">KRW</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 실시간 뉴스 카드 ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          실시간 뉴스
        </p>

        {newsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-xs text-gray-400">뉴스를 불러올 수 없습니다.</p>
        ) : (
          <ol className="space-y-3">
            {news.map((item, i) => (
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
                  {item.source && (
                    <span className="mt-0.5 block text-[10px] text-gray-400">
                      {item.source}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-3 text-[10px] text-gray-300 text-right">Google News</p>
      </div>
    </div>
  );
}
