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

function MessageCard({ msg, isNew }: { msg: TelegramMessage; isNew: boolean }) {
  const [visible, setVisible] = useState(!isNew);

  useEffect(() => {
    if (isNew) {
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    }
  }, [isNew]);

  return (
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
            className="w-full object-cover max-h-48"
            loading="lazy"
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
      if (!res.ok) return; // 실패 시 기존 데이터 유지
      const data = await res.json();
      const msgs: TelegramMessage[] = data.messages ?? [];

      if (!msgs.length) return; // 빈 응답이면 기존 데이터 유지

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
    const t = setInterval(() => load(false), 60_000);
    return () => clearInterval(t);
  }, []);

  // 애니메이션 후 newIds 초기화
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
