"use client";

import { useEffect, useState } from "react";
import type { PublicComment } from "@/lib/comments";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";

export default function CommentSection({ postSlug }: { postSlug: string }) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`/api/comments?slug=${encodeURIComponent(postSlug)}`)
      .then((r) => r.json())
      .then((data) => {
        setComments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [postSlug]);

  function handleNew(comment: PublicComment) {
    setComments((prev) => [...prev, comment]);
  }

  return (
    <section className="space-y-8 border-t border-gray-200 dark:border-slate-700 pt-10 mt-10">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        댓글 {comments.length > 0 && <span className="text-teal-600 dark:text-cyan-400">{comments.length}</span>}
      </h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-700" />
          ))}
        </div>
      ) : (
        <CommentList comments={comments} />
      )}

      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">댓글 작성</h3>
        <CommentForm postSlug={postSlug} onSubmit={handleNew} />
      </div>
    </section>
  );
}
