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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_slug: postSlug, author, content, is_secret: isSecret, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "오류가 발생했습니다.");
      return;
    }

    onSubmit(data);
    setAuthor("");
    setContent("");
    setPassword("");
    setIsSecret(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">
            이름 <span className="text-red-400">*</span>
          </label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
            placeholder="닉네임"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        {isSecret && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              비밀번호 <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={isSecret}
              placeholder="비밀글 비밀번호"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">
          댓글 <span className="text-red-400">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={4}
          placeholder="댓글을 입력해 주세요"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 select-none">
          <input
            type="checkbox"
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-indigo-600"
          />
          🔒 비밀글
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
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}
    </form>
  );
}
