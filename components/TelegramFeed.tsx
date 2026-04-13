"use client";

import { useEffect, useRef, useState } from "react";
import type { TelegramMessage } from "@/app/api/telegram/route";

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

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="rounded-lg shadow-2xl object-contain"
        style={{
          maxWidth: "92vw",
          maxHeight: "88vh",
          width: "auto",
          height: "auto",
          imageRendering: "high-quality",
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}

function MessageCard({ msg, isNew }: { msg: TelegramMessage; isNew: boolean }) {
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
      {lightbox && msg.photo && (
        <ImageLightbox src={msg.photo} onClose={() => setLightbox(false)} />
      )}
      <div
        className="overflow-hidden transition-all duration-500 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-10px)",
        }}
      >
        <div className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 overflow-hidden select-none">
          {msg.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.photo}
              alt=""
              className="w-full object-cover max-h-48 cursor-zoom-in"
              loading="lazy"
              onClick={() => setLightbox(true)}
            />
          )}
          {msg.text && (
            <div className="px-3 py-2 max-h-[16.5rem] overflow-y-auto">
              <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {msg.text}
              </p>
            </div>
          )}
          {msg.time && (
            <p className="px-3 pb-2 text-[10px] text-gray-400 dark:text-gray-500">
              {timeAgo(msg.time)}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default function TelegramFeed() {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function load(first = false) {
    try {
      const res = await fetch("/api/telegram");
      if (!res.ok) return;
      const data = await res.json();
      const msgs: TelegramMessage[] = data.messages ?? [];

      if (!msgs.length) return;

      if (!first) {
        const incoming = new Set(msgs.map((m) => m.id));
        const added = new Set([...incoming].filter((id) => !prevIdsRef.current.has(id)));
        if (added.size > 0) setNewIds(added);
      }

      prevIdsRef.current = new Set(msgs.map((m) => m.id));
      setMessages(msgs);
    } finally {
      if (first) setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // 데이터 없으면 15초, 있으면 60초마다 폴링
    const t = setInterval(() => load(false), messages.length ? 60_000 : 15_000);
    return () => clearInterval(t);
  }, [messages.length]);

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

  if (!messages.length) return null;

  return (
    <div className="space-y-2">
      {messages.map((msg) => (
        <MessageCard key={msg.id} msg={msg} isNew={newIds.has(msg.id)} />
      ))}
    </div>
  );
}
