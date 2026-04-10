"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

type Category = { name: string; count: number };

export default function HeaderClient({ categories }: { categories: Category[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 검색창 열릴 때 포커스
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // 모바일 메뉴 열릴 때 스크롤 막기
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeAll = () => {
    setMobileOpen(false);
    setDropdownOpen(false);
    setSearchOpen(false);
  };

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    closeAll();
    setSearchQuery("");
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      {/* ── 데스크탑 nav ── */}
      <nav className="hidden md:flex items-center gap-2">
        <Link
          href="/about"
          className="px-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-white"
        >
          About
        </Link>
        <Link
          href="/posts"
          className="px-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-white"
        >
          Posts
        </Link>
        <Link
          href="/guestbook"
          className="px-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-white"
        >
          방명록
        </Link>

        {/* 카테고리 드롭다운 (클릭 방식) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1 px-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-white"
            aria-expanded={dropdownOpen}
          >
            Categories
            <svg
              className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 shadow-lg z-50">
              {categories.map(({ name, count }) => (
                <Link
                  key={name}
                  href={`/category/${encodeURIComponent(name.toLowerCase())}`}
                  onClick={closeAll}
                  className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <span>{name}</span>
                  <span className="rounded-full bg-gray-100 dark:bg-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-300">
                    {count}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 검색 */}
        {searchOpen ? (
          <form onSubmit={handleSearchSubmit} className="flex items-center">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              placeholder="검색..."
              className="w-40 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="ml-1 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="검색 닫기"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="검색"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7 7 0 1116.65 16.65z" />
            </svg>
          </button>
        )}

        {/* 다크 모드 토글 */}
        <ThemeToggle />
      </nav>

      {/* ── 모바일 오른쪽 버튼들 ── */}
      <div className="md:hidden flex items-center gap-1">
        <ThemeToggle />
        <button
          className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── 모바일 메뉴 오버레이 ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeAll}
        />
      )}

      {/* ── 모바일 메뉴 패널 ── */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-72 bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 패널 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 px-5 py-4">
          <span className="text-lg font-bold text-gray-900 dark:text-white">메뉴</span>
          <button
            onClick={closeAll}
            className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            aria-label="메뉴 닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 모바일 검색 */}
        <div className="px-4 pt-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색..."
              className="flex-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              검색
            </button>
          </form>
        </div>

        {/* 패널 링크 목록 */}
        <nav className="flex flex-col px-4 py-4 gap-1">
          <Link
            href="/"
            onClick={closeAll}
            className="rounded-lg px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            홈
          </Link>
          <Link
            href="/posts"
            onClick={closeAll}
            className="rounded-lg px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Posts
          </Link>
          <Link
            href="/about"
            onClick={closeAll}
            className="rounded-lg px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            About
          </Link>
          <Link
            href="/guestbook"
            onClick={closeAll}
            className="rounded-lg px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            방명록
          </Link>

          {/* 카테고리 섹션 */}
          <div className="mt-3 border-t border-gray-100 dark:border-slate-700 pt-3">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              카테고리
            </p>
            {categories.map(({ name, count }) => (
              <Link
                key={name}
                href={`/category/${encodeURIComponent(name.toLowerCase())}`}
                onClick={closeAll}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <span>{name}</span>
                <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
