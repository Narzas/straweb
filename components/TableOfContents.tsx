"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/posts";

export default function TableOfContents({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const headings = toc.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0.1 }
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [toc]);

  if (toc.length === 0) return null;

  const activeIndex = toc.findIndex(({ id }) => id === activeId);
  const progressPct = activeIndex >= 0 ? ((activeIndex + 1) / toc.length) * 100 : 0;

  return (
    <nav aria-label="Table of contents">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        On this page
      </p>
      <div className="relative">
        <div className="absolute left-0 top-0 h-full w-[2px] rounded-full bg-gray-100 dark:bg-slate-700" />
        <div
          className="absolute left-0 top-0 w-[2px] rounded-full bg-teal-500 dark:bg-cyan-400 transition-all duration-300"
          style={{ height: `${progressPct}%` }}
        />
        <ul className="space-y-1 pl-3">
          {toc.map(({ id, text, level }) => (
            <li key={id} style={{ paddingLeft: level === 3 ? "0.75rem" : "0" }}>
              <a
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={[
                  "block rounded py-0.5 text-sm transition-colors",
                  activeId === id
                    ? "font-medium text-teal-600 dark:text-cyan-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
                ].join(" ")}
              >
                {text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
