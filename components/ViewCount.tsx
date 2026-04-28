"use client";

import { useEffect, useState } from "react";

export default function ViewCount({
  slug,
  initialCount,
  track = false,
}: {
  slug: string;
  initialCount?: number;
  /** true일 때 조회수 증가 + 실시간 표시 (상세 페이지용) */
  track?: boolean;
}) {
  const [count, setCount] = useState<number | null>(initialCount ?? null);

  useEffect(() => {
    if (!track) {
      // 홈/목록 페이지: initialCount 그대로 표시, fetch 없음
      if (initialCount !== undefined) return;
      // initialCount도 없으면 GET fetch
      fetch(`/api/views/${slug}`)
        .then((r) => r.json())
        .then((d) => setCount(d.count ?? 0))
        .catch(() => {});
      return;
    }

    // ── 상세 페이지 (track=true) ──────────────────────────
    // 1. 현재 조회수 먼저 표시
    fetch(`/api/views/${slug}`)
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {});

    // 2. 로컬호스트 제외, 세션 중복 방지 후 증가
    if (typeof window === "undefined") return;
    if (window.location.hostname === "localhost") return;
    const key = `viewed:${slug}`;
    if (sessionStorage.getItem(key)) return;

    fetch(`/api/views/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrer: document.referrer || null }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.count) setCount(d.count); // POST 응답으로 갱신된 카운트 표시
        sessionStorage.setItem(key, "1");
      })
      .catch(() => {});
  }, [slug, initialCount, track]);

  if (count === null) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path
          fillRule="evenodd"
          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z"
          clipRule="evenodd"
        />
      </svg>
      {count.toLocaleString()}
    </span>
  );
}
