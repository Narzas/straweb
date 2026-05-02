"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Entry = { id: string; author: string; message: string; created_at: string; ip?: string };

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function GuestbookPreview() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/guestbook")
      .then((r) => r.ok ? r.json() : Promise.resolve([]))
      .then((d) => setEntries(Array.isArray(d) ? d.slice(0, 3) : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">방명록</p>
        <Link
          href="/guestbook"
          className="text-[11px] text-teal-400 hover:text-teal-600 transition-colors"
        >
          더보기 →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="animate-pulse rounded bg-gray-100 dark:bg-slate-700 h-3 w-16" />
              <div className="animate-pulse rounded bg-gray-100 dark:bg-slate-700 h-3 w-4/5" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Link
          href="/guestbook"
          className="block text-xs text-gray-400 hover:text-teal-500 transition-colors"
        >
          첫 번째 방명록을 남겨보세요!
        </Link>
      ) : (
        <ul className="space-y-2.5">
          {entries.map((entry) => (
            <li key={entry.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{entry.author}</span>
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{timeAgo(entry.created_at)}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{entry.message}</p>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/guestbook"
        className="mt-3 block w-full rounded-lg border border-teal-100 dark:border-cyan-800/40 bg-teal-50 dark:bg-cyan-900/20 py-1.5 text-center text-xs font-medium text-teal-600 dark:text-cyan-400 transition-colors hover:bg-teal-100 dark:hover:bg-cyan-900/30"
      >
        ✍️ 방명록 남기기
      </Link>
    </div>
  );
}
