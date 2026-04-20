"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TwitterPost } from "@/app/api/twitter-feed/[username]/route";

const ACCOUNTS = [
  { username: "WuBlockchain", label: "Wu Blockchain", apiPath: "/api/twitter-feed/WuBlockchain" },
  { username: "top7ico", label: "TOP 7 ICO", apiPath: "/api/top7ico-feed" },
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

function FeedPlaceholder() {
  return (
    <div className="rounded-lg border-l-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/20 px-3 py-3 space-y-2 overflow-hidden">
      {/* shimmer 라인들 */}
      <div className="relative h-3 rounded-full bg-indigo-100 dark:bg-indigo-900/40 overflow-hidden">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-indigo-200/60 dark:via-indigo-700/40 to-transparent" />
      </div>
      <div className="relative h-3 rounded-full bg-indigo-100 dark:bg-indigo-900/40 overflow-hidden w-5/6">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_0.2s_infinite] bg-gradient-to-r from-transparent via-indigo-200/60 dark:via-indigo-700/40 to-transparent" />
      </div>
      <div className="relative h-3 rounded-full bg-indigo-100 dark:bg-indigo-900/40 overflow-hidden w-3/4">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_0.4s_infinite] bg-gradient-to-r from-transparent via-indigo-200/60 dark:via-indigo-700/40 to-transparent" />
      </div>
      <p className="text-[10px] text-indigo-300 dark:text-indigo-700 pt-1 animate-pulse">
        업데이트 대기 중…
      </p>
    </div>
  );
}

async function gtranslate(text: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("translate failed");
  const data = await res.json();
  return (data[0] as [string, string][]).map((s) => s[0]).join("");
}

function PostCard({ post }: { post: TwitterPost }) {
  const [lightbox, setLightbox] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  async function handleTranslate() {
    if (!post.text) return;
    setTranslating(true);
    try {
      const result = await gtranslate(post.text);
      setTranslated(result);
    } catch {
      // silent fail
    } finally {
      setTranslating(false);
    }
  }

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
              {translated ?? post.text}
            </p>
          </div>
        )}
        <div className="px-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {post.time && (
              <p className="text-[10px] text-indigo-400">
                {timeAgo(post.time)}
              </p>
            )}
          </div>
          {post.text && !translated && (
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 disabled:opacity-50 transition-colors"
            >
              {translating ? "번역 중…" : "🌐 번역"}
            </button>
          )}
          {translated && (
            <button
              onClick={() => setTranslated(null)}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              원문으로
            </button>
          )}
        </div>
      </div>
    </>
  );
}

const LS_KEY = "owner-news-feed-v2";

function loadFromStorage(): (TwitterPost | null)[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return ACCOUNTS.map(() => null);
    return JSON.parse(raw) as (TwitterPost | null)[];
  } catch {
    return ACCOUNTS.map(() => null);
  }
}

function saveToStorage(posts: (TwitterPost | null)[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(posts));
  } catch {}
}

type FeedState = {
  post: TwitterPost | null;
};

export default function OwnerNewsFeed() {
  const [feeds, setFeeds] = useState<FeedState[]>(
    ACCOUNTS.map(() => ({ post: null }))
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const prevIdsRef = useRef<(string | null)[]>(ACCOUNTS.map(() => null));
  const currentPostsRef = useRef<(TwitterPost | null)[]>(ACCOUNTS.map(() => null));

  // localStorage에서 이전 글 즉시 복원
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.some((p) => p !== null)) {
      setFeeds(stored.map((post) => ({ post })));
      currentPostsRef.current = stored;
      const times = stored.map((p) => (p?.time ? new Date(p.time).getTime() : 0));
      setCurrentIdx(times[1] > times[0] ? 1 : 0);
      prevIdsRef.current = stored.map((p) => p?.id ?? null);
    }
  }, []);

  async function loadAll(isFirst = false) {
    const results = await Promise.allSettled(
      ACCOUNTS.map((a) =>
        fetch(a.apiPath)
          .then((r) => r.json())
          .then((d) => (d.posts?.[0] as TwitterPost) ?? null)
          .catch(() => null)
      )
    );

    const fetched = results.map((r) => (r.status === "fulfilled" ? r.value : null));

    // 텍스트 없는 결과는 무시하고 기존 글 유지
    const merged = currentPostsRef.current.map((cur, i) =>
      fetched[i]?.text ? fetched[i] : cur
    );
    currentPostsRef.current = merged;
    setFeeds(merged.map((post) => ({ post })));
    saveToStorage(merged);

    if (isFirst) {
      const times = merged.map((p) => (p?.time ? new Date(p.time).getTime() : 0));
      setCurrentIdx(times[1] > times[0] ? 1 : 0);
      prevIdsRef.current = merged.map((p) => p?.id ?? null);
      return;
    }

    // 갱신 감지: 새 글 올라온 계정으로 자동 전환
    let updatedIdx = -1;
    for (let i = 0; i < fetched.length; i++) {
      if (fetched[i]?.id && fetched[i]!.id !== prevIdsRef.current[i]) {
        updatedIdx = i;
        break;
      }
    }
    prevIdsRef.current = merged.map((p) => p?.id ?? null);
    if (updatedIdx !== -1) setCurrentIdx(updatedIdx);
  }

  useEffect(() => {
    loadAll(true);
    const t = setInterval(() => loadAll(false), 60_000);
    return () => clearInterval(t);
  }, []);

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
              {feeds[i].post ? (
                <PostCard post={feeds[i].post!} />
              ) : (
                <FeedPlaceholder />
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
