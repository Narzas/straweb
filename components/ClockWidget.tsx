"use client";

import { useEffect, useState } from "react";

const DAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function getTimeParts() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const day = DAYS[now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return { date: `${y}.${m}.${d}`, day, hh, mm, ss };
}

export default function ClockWidget() {
  const [parts, setParts] = useState(getTimeParts);
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const tick = setInterval(() => {
      setParts(getTimeParts());
      setColonVisible((v) => !v);
    }, 500);
    return () => clearInterval(tick);
  }, []);

  const sep = (
    <span
      className="transition-opacity duration-100"
      style={{ opacity: colonVisible ? 1 : 0.15 }}
    >
      :
    </span>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* 날짜 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">
          {parts.date}
        </span>
        <span className="text-xs font-semibold text-indigo-400">
          {parts.day}
        </span>
      </div>

      {/* 시간 */}
      <p
        className="text-center text-3xl font-extrabold tracking-tight"
        style={{
          background: "linear-gradient(to right, #6366f1, #7c3aed)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {parts.hh}{sep}{parts.mm}{sep}{parts.ss}
      </p>
    </div>
  );
}
