"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GuestbookPreview from "./GuestbookPreview";

type PopularPost = { slug: string; title: string; category: string; views: number };

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

export default function RightSidebar() {
  const [popular, setPopular] = useState<PopularPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/popular")
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((d) => setPopular(Array.isArray(d) ? d : []))
      .catch(() => setPopular([]))
      .finally(() => setLoading(false));
  }, []);

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

        {loading ? (
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
                    className="block text-xs leading-snug font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 transition-colors"
                  >
                    {post.title}
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

      {/* 방명록 */}
      <GuestbookPreview />
    </div>
  );
}
