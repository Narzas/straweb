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
    <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]" />
      <span className="text-sm text-indigo-100">
        누적 방문자{" "}
        <strong className="text-white text-base font-bold">{count.toLocaleString()}</strong>
        <span className="ml-0.5 text-indigo-200">명</span>
      </span>
    </div>
  );
}
