"use client";

import { useState } from "react";
import type { PublicComment } from "@/lib/comments";

type CommentItemProps = {
  comment: PublicComment;
};

function CommentItem({ comment }: CommentItemProps) {
  const [revealed, setRevealed]   = useState(false);
  const [content, setContent]     = useState(comment.content);
  const [password, setPassword]   = useState("");
  const [showInput, setShowInput] = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  async function handleReveal(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(`/api/comments/${comment.id}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "오류가 발생했습니다.");
      return;
    }

    setContent(data.content);
    setRevealed(true);
    setShowInput(false);
  }

  const date = new Date(comment.created_at).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
            {comment.author.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-gray-800">{comment.author}</span>
          {comment.is_secret && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">🔒 비밀</span>
          )}
        </div>
        <time className="text-xs text-gray-400">{date}</time>
      </div>

      {comment.is_secret && !revealed ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-400 italic">{content}</p>
          {!showInput ? (
            <button
              onClick={() => setShowInput(true)}
              className="text-xs text-indigo-600 underline hover:text-indigo-800"
            >
              비밀번호로 확인
            </button>
          ) : (
            <form onSubmit={handleReveal} className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "확인 중…" : "확인"}
              </button>
            </form>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
}

type Props = {
  comments: PublicComment[];
};

export default function CommentList({ comments }: Props) {
  if (comments.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 py-6">
        아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id}>
          <CommentItem comment={c} />
        </li>
      ))}
    </ul>
  );
}
