"use client";

import { useState } from "react";
import type { PublicComment } from "@/lib/comments";

type Props = {
  postSlug: string;
  onSubmit: (comment: PublicComment) => void;
};

export default function CommentForm({ postSlug, onSubmit }: Props) {
  const [author, setAuthor]     = useState("");
  const [content, setContent]   = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_slug: postSlug, author, content, is_secret: isSecret, password }),
      });

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        setError("서버 응답을 처리할 수 없습니다.");
        return;
      }

      if (!res.ok) {
        setError((data.error as string) ?? "오류가 발생했습니다.");
        return;
      }

      onSubmit(data as unknown as PublicComment);
      setAuthor("");
      setContent("");
      setPassword("");
      setIsSecret(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="comment-author" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            이름 <span className="text-red-400">*</span>
          </label>
          <input
            id="comment-author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
            autoComplete="name"
            placeholder="닉네임"
            className={inputClass}
          />
        </div>

        {isSecret && (
          <div className="space-y-1">
            <label htmlFor="comment-password" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              비밀번호 <span className="text-red-400">*</span>
            </label>
            <input
              id="comment-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={isSecret}
              autoComplete="new-password"
              placeholder="비밀글 비밀번호"
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="comment-content" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
          댓글 <span className="text-red-400">*</span>
        </label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={4}
          placeholder="댓글을 입력해 주세요"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400 select-none">
          <input
            type="checkbox"
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 accent-indigo-600"
          />
          <span aria-hidden="true">🔒</span> 비밀글
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "등록 중…" : "댓글 등록"}
        </button>
      </div>

      {error && (
        <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">댓글이 등록되었습니다!</p>
      )}
    </form>
  );
}
