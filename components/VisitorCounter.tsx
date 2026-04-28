"use client";

import { useEffect, useState } from "react";

type Stats = { total: number; today: number };

export default function VisitorCounter() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (window.location.hostname === "localhost") return;
    const alreadyCounted = sessionStorage.getItem("visited");

    if (alreadyCounted) {
      fetch("/api/visitors")
        .then((r) => r.json())
        .then((d) => setStats({ total: d.total ?? 0, today: d.today ?? 0 }))
        .catch(() => {});
    } else {
      sessionStorage.setItem("visited", "1");
      fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrer: document.referrer || null,
          path: window.location.pathname,
        }),
      })
        .then((r) => r.json())
        .then((d) => setStats({ total: d.total ?? 0, today: d.today ?? 0 }))
        .catch(() => {});
    }
  }, []);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 text-sm text-gray-400 dark:text-gray-500">
      <span>
        오늘{" "}
        <strong className="text-gray-600 dark:text-gray-300 tabular-nums">
          {stats.today.toLocaleString()}
        </strong>
        명
      </span>
      <span className="text-gray-200 dark:text-slate-600">|</span>
      <span>
        누적{" "}
        <strong className="text-gray-600 dark:text-gray-300 tabular-nums">
          {stats.total.toLocaleString()}
        </strong>
        명
      </span>
    </div>
  );
}
