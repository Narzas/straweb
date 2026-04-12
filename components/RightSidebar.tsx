"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GuestbookPreview from "./GuestbookPreview";

type PopularPost = { slug: string; title: string; category: string; views: number };
type IndexData = { price: number | null; change: number | null };
type MarketData = {
  bitcoin: { usd: number | null; krw: number | null; change24h: number | null };
  nasdaq: IndexData;
  kospi: IndexData;
  kosdaq: IndexData;
  usdKrw: number | null;
};

const CATEGORY_ICONS: Record<string, string> = {
  개발: "💻", 리뷰: "📦", 일상: "☀️", 투자: "📈", 정보: "📌",
};

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 dark:bg-slate-700 ${className ?? ""}`} />;
}

function fmtViews(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function MarketRow({
  icon, label, value, sub, change, bg, labelColor,
}: {
  icon: string; label: string; value: string | null; sub?: string;
  change?: number | null; bg: string; labelColor: string;
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

export default function RightSidebar() {
  const [popular, setPopular] = useState<PopularPost[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketOpen, setMarketOpen] = useState(true);

  useEffect(() => {
    fetch("/api/popular")
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((d) => setPopular(Array.isArray(d) ? d : []))
      .catch(() => setPopular([]))
      .finally(() => setPopularLoading(false));

    async function loadMarket() {
      try {
        const res = await fetch("/api/market");
        if (res.ok) setMarket(await res.json());
      } finally {
        setMarketLoading(false);
      }
    }
    loadMarket();
    const t = setInterval(loadMarket, 300_000);
    return () => clearInterval(t);
  }, []);

  const fmtKrw = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
  const fmtIdx = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4 lg:sticky lg:top-24">

      {/* 인기글 */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            🔥 인기글
          </p>
          <Link
            href="/posts"
            className="text-[11px] text-indigo-400 hover:text-indigo-600 transition-colors"
          >
            전체 →
          </Link>
        </div>

        {popularLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            ))}
          </div>
        ) : popular.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">아직 조회 데이터가 없습니다.</p>
        ) : (
          <ol className="space-y-3">
            {popular.map((post, i) => (
              <li key={post.slug} className="flex gap-2.5 items-start">
                <span className={`mt-0.5 flex-shrink-0 text-xs font-black w-4 tabular-nums ${
                  i === 0 ? "text-amber-500" :
                  i === 1 ? "text-slate-400" :
                  i === 2 ? "text-amber-700" :
                  "text-gray-300 dark:text-slate-600"
                }`}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/posts/${post.slug}`}
                    title={post.title}
                    className="block text-xs leading-snug font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 truncate transition-colors"
                  >
                    {post.title.length > 20 ? post.title.slice(0, 20) + "…" : post.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">
                      {CATEGORY_ICONS[post.category] ?? "🗂️"} {post.category}
                    </span>
                    <span className="text-[10px] text-gray-300 dark:text-slate-600">·</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      👁 {fmtViews(post.views)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 시세 카드 — 접기/펼치기 */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => setMarketOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📈</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              시세
            </span>
          </div>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${marketOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {marketOpen && (
          <div className="px-3 pb-3 space-y-1">
            {marketLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : !market ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-2">데이터를 불러올 수 없습니다.</p>
            ) : (
              <>
                <MarketRow
                  icon="₿" label="비트코인"
                  value={market.bitcoin.krw != null ? fmtKrw(market.bitcoin.krw) : null}
                  change={market.bitcoin.change24h}
                  bg="bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30"
                  labelColor="text-amber-700 dark:text-amber-400"
                />
                <MarketRow
                  icon="🇺🇸" label="나스닥"
                  value={market.nasdaq.price != null ? fmtIdx(market.nasdaq.price) : null}
                  change={market.nasdaq.change}
                  bg="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30"
                  labelColor="text-blue-700 dark:text-blue-400"
                />
                <MarketRow
                  icon="🇰🇷" label="코스피"
                  value={market.kospi.price != null ? fmtIdx(market.kospi.price) : null}
                  change={market.kospi.change}
                  bg="bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30"
                  labelColor="text-rose-700 dark:text-rose-400"
                />
                <MarketRow
                  icon="📊" label="코스닥"
                  value={market.kosdaq.price != null ? fmtIdx(market.kosdaq.price) : null}
                  change={market.kosdaq.change}
                  bg="bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30"
                  labelColor="text-purple-700 dark:text-purple-400"
                />
                <MarketRow
                  icon="💵" label="달러 환율"
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
        )}
      </div>

      {/* 방명록 */}
      <GuestbookPreview />
    </div>
  );
}
