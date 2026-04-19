"use client";

import { useState } from "react";

type NewsItem = {
  title: string;
  url: string;
  description: string;
  image: string | null;
  pubDate: string;
};

type ArticleState = { loading: boolean; content: string | null; error: boolean };

export default function CryptoNewsSection({ news }: { news: NewsItem[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [articles, setArticles] = useState<Record<number, ArticleState>>({});

  async function toggle(i: number) {
    if (expanded === i) {
      setExpanded(null);
      return;
    }
    setExpanded(i);
    if (articles[i]) return;

    setArticles((prev) => ({ ...prev, [i]: { loading: true, content: null, error: false } }));
    try {
      const res = await fetch(`/api/fetch-news?url=${encodeURIComponent(news[i].url)}&title=${encodeURIComponent(news[i].title)}`);
      const data = await res.json();
      setArticles((prev) => ({
        ...prev,
        [i]: { loading: false, content: data.content ?? null, error: !data.content },
      }));
    } catch {
      setArticles((prev) => ({ ...prev, [i]: { loading: false, content: null, error: true } }));
    }
  }

  const items = news.slice(0, 4);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
          📰 주요 뉴스
        </h2>
        <span className="text-[11px] text-gray-400">CoinTelegraph</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {items.map((n, i) => {
          const isOpen = expanded === i;
          const art = articles[i];
          return (
            <div
              key={i}
              className={`flex flex-col rounded-xl overflow-hidden border transition-all duration-200 bg-white dark:bg-slate-800 ${
                isOpen
                  ? "col-span-2 border-indigo-300 dark:border-indigo-700 shadow-md"
                  : "border-gray-200 dark:border-slate-700"
              }`}
            >
              {/* 카드 헤더 (클릭 영역) */}
              <button
                onClick={() => toggle(i)}
                className="flex flex-col text-left w-full group"
              >
                {n.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={n.image}
                    alt=""
                    className={`w-full object-cover transition-all duration-200 ${isOpen ? "h-40" : "h-24"}`}
                    loading="lazy"
                  />
                )}
                <div className="p-2.5 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-500 transition-colors leading-snug ${
                        isOpen ? "" : "line-clamp-2"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.pubDate).toLocaleDateString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                    {isOpen ? "▲ 접기" : "▼"}
                  </span>
                </div>
              </button>

              {/* 펼쳐진 본문 */}
              {isOpen && (
                <div className="px-3 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3">
                  {art?.loading && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" />
                      번역 중...
                    </div>
                  )}
                  {art?.error && !art?.loading && (
                    <p className="text-xs text-red-400">본문을 불러오지 못했습니다.</p>
                  )}
                  {art?.content && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {art.content}
                    </p>
                  )}
                  {!art?.content && !art?.loading && n.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      {n.description}
                    </p>
                  )}
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-[11px] text-indigo-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    원문 보기 →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
