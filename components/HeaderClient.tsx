"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Category = { name: string; count: number };

export default function HeaderClient({ categories }: { categories: Category[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // 모바일 메뉴 열릴 때 스크롤 막기
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeAll = () => {
    setMobileOpen(false);
    setDropdownOpen(false);
  };

  return (
    <>
      {/* ── 데스크탑 nav ── */}
      <nav className="hidden md:flex items-center gap-6">
        <Link
          href="/about"
          className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          About
        </Link>
        <Link
          href="/posts"
          className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          Posts
        </Link>

        {/* 카테고리 드롭다운 (클릭 방식) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
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
            <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg z-50">
              {categories.map(({ name, count }) => (
                <Link
                  key={name}
                  href={`/category/${encodeURIComponent(name.toLowerCase())}`}
                  onClick={closeAll}
                  className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span>{name}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {count}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ── 모바일 햄버거 버튼 ── */}
      <button
        className="md:hidden p-2 -mr-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="메뉴 열기"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? (
          /* X 아이콘 */
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          /* 햄버거 아이콘 */
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* ── 모바일 메뉴 오버레이 ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeAll}
        />
      )}

      {/* ── 모바일 메뉴 패널 ── */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-72 shadow-2xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ backgroundColor: "#ffffff" }}
      >
        {/* 패널 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="text-lg font-bold text-gray-900">메뉴</span>
          <button
            onClick={closeAll}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="메뉴 닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 패널 링크 목록 */}
        <nav className="flex flex-col px-4 py-4 gap-1">
          <Link
            href="/"
            onClick={closeAll}
            className="rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            홈
          </Link>
          <Link
            href="/posts"
            onClick={closeAll}
            className="rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Posts
          </Link>
          <Link
            href="/about"
            onClick={closeAll}
            className="rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            About
          </Link>

          {/* 카테고리 섹션 */}
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              카테고리
            </p>
            {categories.map(({ name, count }) => (
              <Link
                key={name}
                href={`/category/${encodeURIComponent(name.toLowerCase())}`}
                onClick={closeAll}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span>{name}</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
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
