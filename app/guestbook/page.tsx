"use client";

import { useEffect, useRef, useState } from "react";
import Toast from "@/components/Toast";

type Entry = { id: string; author: string; message: string; created_at: string; ip?: string };

const AVATAR_COLORS = [
  "bg-violet-500", "bg-indigo-500", "bg-sky-500",
  "bg-emerald-500", "bg-orange-500", "bg-pink-500",
];

function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <div className={`flex-shrink-0 h-8 w-8 rounded-full ${color} flex items-center justify-center`}>
      <span className="text-xs font-bold text-white select-none">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function GuestbookPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [author, setAuthor] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    fetch(`/api/guestbook?page=${page}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => {
        setEntries(Array.isArray(d.data) ? d.data : []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(() => { setEntries([]); setFetchError(true); })
      .finally(() => setLoading(false));
  }, [page]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "오류가 발생했습니다.");
        return;
      }
      setAuthor("");
      setMessage("");
      formRef.current?.reset();
      setToast("방명록이 등록되었습니다!");
      if (page === 1) {
        setEntries((prev) => [data, ...prev.slice(0, 9)]);
        setTotal((t) => t + 1);
        setTotalPages((tp) => Math.ceil((total + 1) / 10));
      } else {
        setPage(1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold text-gray-900 dark:text-gray-100">방명록</h1>
      <p className="mb-8 text-sm text-gray-400 dark:text-gray-500">방문 흔적을 남겨주세요. 짧은 인사도 환영합니다.</p>

      {/* ── 작성 폼 ── */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="mb-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-3"
      >
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="이름 (최대 20자)"
            maxLength={20}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
            autoComplete="name"
            className="w-36 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:focus:ring-cyan-800"
          />
        </div>
        <textarea
          placeholder="내용을 남겨주세요. (최대 200자)"
          maxLength={200}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={3}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:focus:ring-cyan-800"
        />
        <div className="flex items-center justify-between">
          {error ? <p role="alert" aria-live="polite" className="text-xs text-red-500">{error}</p> : <span />}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{message.length}/200</span>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      </form>

      {/* ── 목록 ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400 dark:text-gray-500">총 {total}개</p>
      </div>
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-4 space-y-2">
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-slate-700" />
              <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : fetchError ? (
        <p className="text-center text-sm text-red-400 dark:text-red-500 py-12">목록을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">첫 번째 방명록을 남겨주세요!</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm border-l-2 border-l-teal-300 dark:border-l-cyan-700"
            >
              <div className="flex items-start gap-3">
                <Avatar name={entry.author} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{entry.author}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(entry.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                    {entry.message}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── 페이지네이션 ── */}
      {totalPages > 1 && (
        <div ref={listRef} className="mt-8 flex items-center justify-center gap-1">
          <button
            onClick={() => { setPage((p) => Math.max(1, p - 1)); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            disabled={page === 1}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="이전 페이지"
          >
            ←
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .reduce<(number | "…")[]>((acc, n, i, arr) => {
              if (i > 0 && (n as number) - (arr[i - 1] as number) > 1) acc.push("…");
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) =>
              n === "…" ? (
                <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => { setPage(n as number); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className={`min-w-[2rem] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    page === n
                      ? "bg-teal-500 text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {n}
                </button>
              )
            )}

          <button
            onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            disabled={page === totalPages}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="다음 페이지"
          >
            →
          </button>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
