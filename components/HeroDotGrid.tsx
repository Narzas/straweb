"use client";

import { useEffect, useState } from "react";

const COLS = 18;
const ROWS = 5;

const LEVEL_CLASS = [
  "bg-white/[0.05]",
  "bg-indigo-300/20",
  "bg-indigo-200/40",
  "bg-violet-200/55",
  "bg-white/75",
];

type Cell = {
  level: number;
  delay: number;
  duration: number;
  pulse: boolean;
};

export default function HeroDotGrid() {
  const [cells, setCells] = useState<Cell[]>([]);

  useEffect(() => {
    setCells(
      Array.from({ length: COLS * ROWS }, () => {
        const r = Math.random();
        const level = r < 0.42 ? 0 : Math.ceil(Math.random() * 4);
        return {
          level,
          delay: parseFloat((Math.random() * 3.5).toFixed(2)),
          duration: parseFloat((1.4 + Math.random() * 1.2).toFixed(2)),
          pulse: level > 0 && Math.random() > 0.55,
        };
      })
    );
  }, []);

  if (cells.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-0 bottom-0 hidden sm:flex items-center z-0">
      <div className="flex flex-col gap-[5px] opacity-50">
        {Array.from({ length: ROWS }, (_, r) => (
          <div key={r} className="flex gap-[5px]">
            {Array.from({ length: COLS }, (_, c) => {
              const cell = cells[r * COLS + c];
              if (!cell) return null;
              return (
                <div
                  key={c}
                  className={`h-2.5 w-2.5 rounded-[2px] ${LEVEL_CLASS[cell.level]} ${
                    cell.pulse ? "animate-pulse" : ""
                  }`}
                  style={
                    cell.pulse
                      ? {
                          animationDelay: `${cell.delay}s`,
                          animationDuration: `${cell.duration}s`,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
