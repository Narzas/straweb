"use client";

import { useEffect, useState } from "react";
import ClockWeatherWidget from "./ClockWeatherWidget";

type NewsItem = { title: string; link: string; source: string };
type NewsCategory = { key: string; label: string; items: NewsItem[] };

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-100 dark:bg-slate-700 ${className ?? ""}`} />
  );
}

export default function Sidebar() {
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
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

    const t2 = setInterval(loadNews, 600_000);
    return () => {
      clearInterval(t2);
    };
  }, []);

  const activeNews = categories[activeTab]?.items ?? [];

  return (
    <div className="space-y-4 lg:sticky lg:top-24">

      {/* 시계 + 날씨 */}
      <ClockWeatherWidget />

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
