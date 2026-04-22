'use client';

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import type { PostMeta } from "@/lib/posts";
import ViewCount from "@/components/ViewCount";

const GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-teal-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-rose-600",
  "from-pink-500 to-purple-600",
  "from-amber-500 to-orange-600",
];

function pickGradient(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

const POPUP_W = 420;
const POPUP_H = 315;

export default function PostCard({
  post,
  priority = false,
  viewCount,
  variant = "list",
}: {
  post: PostMeta;
  priority?: boolean;
  viewCount?: number;
  variant?: "list" | "grid";
}) {
  const gradient = pickGradient(post.slug);
  const thumbRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const openPopup = useCallback(() => {
    if (!thumbRef.current) return;
    const rect = thumbRef.current.getBoundingClientRect();
    let x = rect.left + rect.width / 2 - POPUP_W / 2;
    let y = rect.top - POPUP_H - 10;
    if (y < 8) y = rect.bottom + 10;
    x = Math.max(8, Math.min(x, window.innerWidth - POPUP_W - 8));
    setPopup({ x, y });
  }, []);

  const handleEnter = useCallback(() => {
    if (!post.cover) return;
    timerRef.current = setTimeout(openPopup, 250);
  }, [post.cover, openPopup]);

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPopup(null);
  }, []);

  if (variant === "grid") {
    return (
      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-teal-400/50 dark:hover:border-cyan-500/30 cursor-pointer h-full">
        {/* 썸네일 */}
        <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0">
          {post.cover ? (
            <Image
              src={post.cover}
              alt={post.title}
              fill
              sizes="(min-width: 640px) 50vw, 100vw"
              className={`transition-transform duration-500 group-hover:scale-105 ${post.cover.endsWith(".svg") ? "object-cover object-center" : "object-contain"}`}
              priority={priority}
              unoptimized={post.cover.endsWith(".svg")}
            />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center transition-transform duration-500 group-hover:scale-105`}>
              <span className="text-5xl font-black text-white/25 select-none">{post.title.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* 콘텐츠 */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/category/${encodeURIComponent(post.category.toLowerCase())}`}
              className="relative z-10 rounded-full bg-teal-600 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              {post.category}
            </Link>
            {post.tags.slice(0, 2).map((tag) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag.toLowerCase())}`}
                className="relative z-10 rounded-full bg-gray-100 dark:bg-slate-600 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-cyan-900/30 hover:text-teal-600 dark:hover:text-cyan-400 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>

          <h2 className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 group-hover:text-teal-600 dark:group-hover:text-cyan-400 line-clamp-2 transition-colors">
            <Link href={`/posts/${post.slug}`} className="after:absolute after:inset-0 after:z-0">
              {post.title}
            </Link>
          </h2>

          {post.firstHeading && (
            <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 leading-relaxed">{post.firstHeading}</p>
          )}

          <div className="mt-auto flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <time className="text-xs text-gray-400 dark:text-gray-500">{post.date}</time>
              <span className="text-xs text-gray-300 dark:text-slate-600">·</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">약 {post.readTime}분</span>
            </div>
            <ViewCount slug={post.slug} initialCount={viewCount} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-row overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-teal-400/50 dark:hover:border-cyan-500/30 cursor-pointer">

      {/* Thumbnail */}
      <div
        ref={thumbRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="relative z-[1] w-36 shrink-0 self-stretch overflow-hidden bg-gray-100 dark:bg-slate-700 sm:w-44 min-h-[120px]"
      >
        {post.cover ? (
          <Image
            src={post.cover}
            alt={post.title}
            fill
            sizes="176px"
            className={`transition-transform duration-300 group-hover:scale-105 ${post.cover.endsWith(".svg") ? "object-cover object-center" : "object-contain"}`}
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            unoptimized={post.cover.endsWith(".svg")}
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
          >
            <span className="select-none text-4xl font-bold text-white/30">
              {post.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4 min-w-0">
        {/* 카테고리 + 태그 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/category/${encodeURIComponent(post.category.toLowerCase())}`}
            className="relative z-10 rounded-full bg-teal-600 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            {post.category}
          </Link>
          {post.tags.slice(0, 2).map((tag) => (
            <Link
              key={tag}
              href={`/tag/${encodeURIComponent(tag.toLowerCase())}`}
              className="relative z-10 rounded-full bg-gray-100 dark:bg-slate-600 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-cyan-900/30 hover:text-teal-600 dark:hover:text-cyan-400 transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>

        {/* 제목 — stretched-link: after 가상 요소가 카드 전체를 덮음 */}
        <h2 className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100 transition-colors group-hover:text-teal-600 dark:group-hover:text-cyan-400 break-keep line-clamp-2">
          <Link
            href={`/posts/${post.slug}`}
            className="after:absolute after:inset-0 after:z-0"
            onFocus={handleEnter}
            onBlur={handleLeave}
          >
            {post.title.includes("—") ? (
              <>
                {post.title.split("—")[0].trimEnd()}
                <span className="font-normal opacity-60"> — {post.title.split("—").slice(1).join("—").trimStart()}</span>
              </>
            ) : post.title}
          </Link>
        </h2>

        {post.firstHeading && (
          <p className="line-clamp-1 text-sm leading-relaxed text-gray-400 dark:text-gray-500">
            {post.firstHeading}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <time className="text-xs text-gray-400 dark:text-gray-500">{post.date}</time>
            <span className="text-xs text-gray-300 dark:text-slate-600">·</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">약 {post.readTime}분</span>
          </div>
          <ViewCount slug={post.slug} initialCount={viewCount} />
        </div>
      </div>

      {/* Hover preview portal */}
      {mounted && popup && post.cover && createPortal(
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[9999] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          style={{ left: popup.x, top: popup.y, width: POPUP_W, height: POPUP_H }}
        >
          <Image
            src={post.cover}
            alt={post.title}
            fill
            sizes={`${POPUP_W}px`}
            priority
            className="object-contain p-3"
            unoptimized={post.cover.endsWith(".svg")}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
