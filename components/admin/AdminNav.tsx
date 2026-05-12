"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/picks", label: "매수타점", match: "/admin/picks" },
  { href: "/admin/analytics", label: "Analytics", match: "/admin/analytics" },
  { href: "/admin/posts", label: "Posts", match: "/admin/posts" },
];

// analytics 페이지에서는 nav 숨김 (사용자 요청 — 운영노트·매수타점 메뉴 노출 X)
const HIDDEN_PATHS = ["/admin/analytics"];

export function AdminNav() {
  const pathname = usePathname() ?? "";
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;
  return (
    <nav className="border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-1">
        <Link
          href="/"
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 mr-3 py-3"
        >
          ← 사이트
        </Link>
        {NAV.map((n) => {
          const active = pathname.startsWith(n.match);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-emerald-500 text-emerald-700 dark:text-emerald-300"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
