"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TwitterPost } from "@/app/api/twitter-feed/[username]/route";

const ACCOUNTS = [
  { username: "WuBlockchain", label: "Wu Blockchain" },
  { username: "top7ico", label: "TOP 7 ICO" },
] as const;

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="rounded-lg shadow-2xl object-contain"
        style={{ maxWidth: "92vw", maxHeight: "88vh", width: "auto", height: "auto" }}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>,
    document.body
  );
}

function PostCard({ post }: { post: TwitterPost }) {
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      {lightbox && post.photo && (
        <ImageLightbox src={post.photo} onClose={() => setLightbox(false)} />
      )}
      <div className="rounded-lg border-l-2 border-indigo-400 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20 overflow-hidden select-none">
        {post.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.photo}
            alt=""
            className="w-full object-cover max-h-48 cursor-zoom-in"
            loading="lazy"
            onClick={() => setLightbox(true)}
          />
        )}
        {post.text && (
          <div className="px-3 pt-2.5 max-h-[16.5rem] overflow-y-auto">
            <p className="text-[13px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-medium">
              {post.text}
            </p>
          </div>
        )}
        <div className="px-3 py-2 flex items-center justify-between">
          {post.time && (
            <span className="text-[10px] text-indigo-400 dark:text-indigo-400">
              {timeAgo(post.time)}
            </span>
          )}
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            원문 →
          </a>
        </div>
      </div>
    </>
  );
}

type FeedState = {
  post: TwitterPost | null;
  loading: boolean;
};

export default function OwnerNewsFeed() {
  const [feeds, setFeeds] = useState<FeedState[]>(
    ACCOUNTS.map(() => ({ post: null, loading: true }))
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const prevIdsRef = useRef<(string | null)[]>(ACCOUNTS.map(() => null));
  const initializedRef = useRef(false);

  async function loadAll(isFirst = false) {
    const results = await Promise.allSettled(
      ACCOUNTS.map((a) =>
        fetch(`/api/twitter-feed/${a.username}`)
          .then((r) => r.json())
          .then((d) => (d.posts?.[0] as TwitterPost) ?? null)
          .catch(() => null)
      )
    );

    const posts = results.map((r) => (r.status === "fulfilled" ? r.value : null));

    setFeeds(posts.map((post) => ({ post, loading: false })));

    if (isFirst) {
      // 초기: 더 최신 글 있는 계정 먼저
      const times = posts.map((p) => (p?.time ? new Date(p.time).getTime() : 0));
      const newerIdx = times[1] > times[0] ? 1 : 0;
      setCurrentIdx(newerIdx);
      prevIdsRef.current = posts.map((p) => p?.id ?? null);
      initializedRef.current = true;
      return;
    }

    // 갱신 감지: 새 글 올라온 계정으로 자동 전환
    let updatedIdx = -1;
    for (let i = 0; i < posts.length; i++) {
      if (posts[i]?.id && posts[i]!.id !== prevIdsRef.current[i]) {
        updatedIdx = i;
        break;
      }
    }
    prevIdsRef.current = posts.map((p) => p?.id ?? null);
    if (updatedIdx !== -1) setCurrentIdx(updatedIdx);
  }

  useEffect(() => {
    loadAll(true);
    const t = setInterval(() => loadAll(false), 60_000);
    return () => clearInterval(t);
  }, []);

  const loading = feeds.some((f) => f.loading);
  const currentPost = feeds[currentIdx]?.post;

  return (
    <div>
      {/* 슬라이드 영역 */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${currentIdx * 100}%)` }}
        >
          {ACCOUNTS.map((_, i) => (
            <div key={i} className="w-full flex-shrink-0">
              {feeds[i].loading ? (
                <div className="animate-pulse rounded-lg bg-gray-100 dark:bg-slate-700 h-20" />
              ) : feeds[i].post ? (
                <PostCard post={feeds[i].post!} />
              ) : (
                <div className="animate-pulse rounded-lg bg-gray-100 dark:bg-slate-700 h-20" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 하단: 점 인디케이터 + 좌우 버튼 */}
      <div className="flex items-center justify-between mt-2.5 px-0.5">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="w-6 h-6 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 disabled:opacity-25 transition-all text-sm leading-none"
          aria-label="이전"
        >
          ‹
        </button>

        <div className="flex items-center gap-1.5">
          {ACCOUNTS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`rounded-full transition-all duration-300 ${
                currentIdx === i
                  ? "w-4 h-1.5 bg-indigo-400 dark:bg-indigo-500"
                  : "w-1.5 h-1.5 bg-indigo-200 dark:bg-indigo-800 hover:bg-indigo-300 dark:hover:bg-indigo-700"
              }`}
              aria-label={`슬라이드 ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIdx((i) => Math.min(ACCOUNTS.length - 1, i + 1))}
          disabled={currentIdx === ACCOUNTS.length - 1}
          className="w-6 h-6 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 disabled:opacity-25 transition-all text-sm leading-none"
          aria-label="다음"
        >
          ›
        </button>
      </div>
    </div>
  );
}
