"use client";

import { useEffect, useState } from "react";

export default function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // 세션 내 중복 카운트 방지
    const alreadyCounted = sessionStorage.getItem("visited");

    if (alreadyCounted) {
      fetch("/api/visitors")
        .then((r) => r.json())
        .then((d) => setCount(d.count))
        .catch(() => {});
    } else {
      sessionStorage.setItem("visited", "1");
      fetch("/api/visitors", { method: "POST" })
        .then((r) => r.json())
        .then((d) => setCount(d.count))
        .catch(() => {});
    }
  }, []);

  if (count === null) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
      누적 방문자 <strong className="text-gray-600">{count.toLocaleString()}</strong>명
    </span>
  );
}
