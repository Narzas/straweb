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

  return (
    <nav aria-label="Table of contents">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        On this page
      </p>
      <ul className="space-y-1">
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
                  ? "font-medium text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
              ].join(" ")}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
