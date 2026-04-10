"use client";

import { useEffect, useRef, useState } from "react";
import type { Metadata } from "next";

type Entry = { id: string; author: string; message: string; created_at: string };

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
  const [author, setAuthor] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch("/api/guestbook")
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

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
      setEntries((prev) => [data, ...prev]);
      setAuthor("");
      setMessage("");
      formRef.current?.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold text-gray-900">방명록</h1>
      <p className="mb-8 text-sm text-gray-400">방문 흔적을 남겨주세요. 짧은 인사도 환영합니다.</p>

      {/* ── 작성 폼 ── */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="mb-10 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3"
      >
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="이름 (최대 20자)"
            maxLength={20}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
            className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <textarea
          placeholder="내용을 남겨주세요. (최대 200자)"
          maxLength={200}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:border-indigo-400 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          {error ? <p className="text-xs text-red-500">{error}</p> : <span />}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{message.length}/200</span>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      </form>

      {/* ── 목록 ── */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
              <div className="h-3 w-20 rounded bg-gray-200" />
              <div className="h-3 w-4/5 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">첫 번째 방명록을 남겨주세요!</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-gray-800">{entry.author}</span>
                <span className="text-xs text-gray-400">{timeAgo(entry.created_at)}</span>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
                {entry.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
