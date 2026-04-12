"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClockWeatherWidget from "./ClockWeatherWidget";

type PopularPost = { slug: string; title: string; category: string; views: number };
type NewsItem = { title: string; link: string; source: string };
type NewsCategory = { key: string; label: string; items: NewsItem[] };

const CATEGORY_ICONS: Record<string, string> = {
  개발: "💻", 리뷰: "📦", 일상: "☀️", 투자: "📈", 정보: "📌",
};

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-100 dark:bg-slate-700 ${className ?? ""}`} />
  );
}

function fmtViews(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export default function Sidebar() {
  const [popular, setPopular] = useState<PopularPost[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/popular")
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((d) => setPopular(Array.isArray(d) ? d : []))
      .catch(() => setPopular([]))
      .finally(() => setPopularLoading(false));

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

    loadNews();

    const t = setInterval(loadNews, 600_000);
    return () => clearInterval(t);
  }, []);

  const activeNews = categories[activeTab]?.items ?? [];

  return (
    <div className="space-y-4 lg:sticky lg:top-24">

      {/* 시계 + 날씨 */}
      <ClockWeatherWidget />

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
