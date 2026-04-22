"use client";

import { useState } from "react";
import type { TocItem } from "@/lib/posts";
import TableOfContents from "./TableOfContents";

export default function MobileToc({ toc }: { toc: TocItem[] }) {
  const [open, setOpen] = useState(false);
  if (toc.length === 0) return null;

  return (
    <div className="lg:hidden mb-8 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
          </svg>
          목차 ({toc.length}개)
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-slate-700">
          <TableOfContents toc={toc} />
        </div>
      )}
    </div>
  );
}
