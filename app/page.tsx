import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, getAllCategories } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import AdSlot from "@/components/AdSlot";
import VisitorCounter from "@/components/VisitorCounter";
import Sidebar from "@/components/Sidebar";
import HeroTyping from "@/components/HeroTyping";
import HeroDotGrid from "@/components/HeroDotGrid";

export const metadata: Metadata = {
  title: "StraWeb",
  description: "개발, 리뷰, 투자 등 관심 있는 것들을 편하게 기록하는 블로그입니다.",
};

const CATEGORY_ICONS: Record<string, string> = {
  개발: "💻",
  리뷰: "📦",
  일상: "☀️",
  투자: "📈",
  정보: "📌",
};

export default async function HomePage() {
  const recentPosts = getAllPosts().slice(0, 6);
  const categories = getAllCategories();

  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-10 xl:gap-14">

      {/* ── 왼쪽 사이드바 (lg 이상에서만 표시) ── */}
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <div className="space-y-14">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-8 py-14 text-white sm:px-12">
        {/* 배경 장식 */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/5" />
        <HeroDotGrid />

        <div className="relative space-y-4">
          <p className="text-sm font-medium tracking-widest text-indigo-200 uppercase">
            Welcome to
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl break-keep">
            StraWeb
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-indigo-100">
            개발하면서 겪은 것들, 관심 가는 것들을 편하게 기록하는 공간입니다.
            <br className="hidden sm:block" />
            게임, 투자, 일상 등 다양한 주제를 다룹니다.
          </p>
          <HeroTyping />
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/posts"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
            >
              글 목록 보기
            </Link>
            <Link
              href="/about"
              className="rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              소개
            </Link>
          </div>

          {/* 방문자 */}
          <div className="pt-4">
            <VisitorCounter />
          </div>
        </div>
      </section>

      {/* ── 상단 광고 ── */}
      <AdSlot size="horizontal" className="w-full" />

      {/* ── 카테고리 바로가기 ── */}
      {categories.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">카테고리</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(({ name, count }) => (
              <Link
                key={name}
                href={`/category/${encodeURIComponent(name.toLowerCase())}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <span>{CATEGORY_ICONS[name] ?? "🗂️"}</span>
                {name}
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 최근 글 ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">최근 글</h2>
          <Link
            href="/posts"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            전체 보기 →
          </Link>
        </div>

        <ul className="grid gap-8 sm:grid-cols-2">
          {recentPosts.map((post, i) => (
            <li key={post.slug}>
              <PostCard post={post} priority={i < 2} />
            </li>
          ))}
        </ul>
      </section>

      {/* ── 하단 광고 ── */}
      <AdSlot size="rectangle" className="mx-auto max-w-sm" />

      </div>{/* end 메인 콘텐츠 */}
    </div>
  );
}
