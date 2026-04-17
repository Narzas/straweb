"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WuPost } from "@/app/api/wublockchain/route";

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
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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

function PostCard({ post, isNew }: { post: WuPost; isNew: boolean }) {
  const [visible, setVisible] = useState(!isNew);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (isNew) {
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    }
  }, [isNew]);

  return (
    <>
      {lightbox && post.photo && (
        <ImageLightbox src={post.photo} onClose={() => setLightbox(false)} />
      )}
      <div
        className="overflow-hidden transition-all duration-500 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-10px)",
        }}
      >
        <div className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 overflow-hidden select-none">
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
            <div className="px-3 pt-2 max-h-[16.5rem] overflow-y-auto">
              <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {post.text}
              </p>
            </div>
          )}
          <div className="px-3 py-2 flex items-center justify-between">
            {post.time && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {timeAgo(post.time)}
              </span>
            )}
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-sky-500 transition-colors ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              원문 →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default function WuBlockchainFeed() {
  const [posts, setPosts] = useState<WuPost[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function load(first = false) {
    try {
      const res = await fetch("/api/wublockchain");
      if (!res.ok) return;
      const data = await res.json();
      const incoming: WuPost[] = data.posts ?? [];
      if (!incoming.length) return;

      if (!first) {
        const incomingIds = new Set(incoming.map((p) => p.id));
        const added = new Set([...incomingIds].filter((id) => !prevIdsRef.current.has(id)));
        if (added.size > 0) setNewIds(added);
      }

      prevIdsRef.current = new Set(incoming.map((p) => p.id));
      setPosts(incoming);
    } finally {
      if (first) setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (newIds.size === 0) return;
    const t = setTimeout(() => setNewIds(new Set()), 600);
    return () => clearTimeout(t);
  }, [newIds]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0].map((i) => (
          <div key={i} className="animate-pulse rounded-lg bg-gray-100 dark:bg-slate-700 h-20" />
        ))}
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="animate-pulse rounded-lg bg-gray-100 dark:bg-slate-700 h-20" />
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} isNew={newIds.has(post.id)} />
      ))}
    </div>
  );
}
