import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, getAllCategories } from "@/lib/posts";
import { getViewCounts } from "@/lib/views";
import PostCard from "@/components/PostCard";
import AdSlot from "@/components/AdSlot";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";
import HeroTyping from "@/components/HeroTyping";
import HeroBattleScene from "@/components/HeroBattleScene";
import SeasonalEffect from "@/components/SeasonalEffect";
import ClientOnly from "@/components/ClientOnly";

export const revalidate = 60; // 60초마다 서버 재렌더 → 조회수 최신화

export const metadata: Metadata = {
  title: "StraWeb",
  description: "개발, 리뷰, 투자 등 관심 있는 것들을 편하게 기록하는 블로그입니다.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "StraWeb",
    description: "개발, 리뷰, 투자 등 관심 있는 것들을 편하게 기록하는 블로그입니다.",
    type: "website",
    url: "https://www.stragos.xyz",
    siteName: "StraWeb",
    locale: "ko_KR",
    images: [{ url: "https://www.stragos.xyz/og?title=StraWeb", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StraWeb",
    description: "개발, 리뷰, 투자 등 관심 있는 것들을 편하게 기록하는 블로그입니다.",
    images: ["https://www.stragos.xyz/og?title=StraWeb"],
  },
};

const CATEGORY_ICONS: Record<string, string> = {
  개발: "💻",
  리뷰: "📦",
  일상: "☀️",
  투자: "📈",
  정보: "📌",
};

function getSeason(month: number): "spring" | "summer" | "autumn" | "winter" {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}



export default async function HomePage() {
  const recentPosts = getAllPosts().slice(0, 6);
  const categories = getAllCategories();
  const season = getSeason(new Date().getMonth() + 1);
  const viewCounts = await getViewCounts(recentPosts.map((p) => p.slug));

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "StraWeb",
    url: "https://www.stragos.xyz",
    description: "개발, 리뷰, 투자 등 관심 있는 것들을 편하게 기록하는 블로그입니다.",
    author: {
      "@type": "Person",
      name: "Stragos",
      url: "https://www.stragos.xyz",
      sameAs: ["https://x.com/0xStragos"],
    },
    blogPost: recentPosts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `https://www.stragos.xyz/posts/${p.slug}`,
      datePublished: p.date,
      author: { "@type": "Person", name: "Stragos" },
    })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "StraWeb",
    url: "https://www.stragos.xyz",
    description: "개발, 리뷰, 투자 등 관심 있는 것들을 편하게 기록하는 블로그입니다.",
    author: { "@type": "Person", name: "Stragos" },
    inLanguage: "ko-KR",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.stragos.xyz/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
    />
    <ClientOnly><SeasonalEffect season={season} /></ClientOnly>

    <div className="relative z-[1] lg:grid lg:grid-cols-[240px_1fr_220px] lg:gap-6 xl:gap-8">

      {/* ── 왼쪽 사이드바 (lg 이상에서만 표시) ── */}
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <div className="space-y-8">

      {/* ── Hero (로컬 개발환경·모바일에서는 숨김) ── */}
      {process.env.NODE_ENV !== "development" && (
      <section className="hidden md:block overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#1a1f2e] text-white ring-1 ring-white/[0.06]">

        {/* 배틀씬 캔버스 영역 */}
        <div className="relative">
          <ClientOnly><HeroBattleScene /></ClientOnly>

          {/* HeroTyping — 좌상단 고정 */}
          <div className="absolute top-3 left-5 z-[1]">
            <HeroTyping />
          </div>
        </div>

        {/* 설명 — ATB 패널 바로 아래 */}
        <p className="px-5 py-3.5 text-base leading-relaxed text-slate-300">
          개발하면서 겪은 것들, 관심 가는 것들을 편하게 기록하는 공간입니다.<br />게임, 투자, 일상 등 다양한 주제를 다룹니다.
        </p>
      </section>
      )}


      {/* ── 카테고리 바로가기 ── */}
      {categories.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">카테고리</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {categories.map(({ name, count }) => (
              <Link
                key={name}
                href={`/category/${encodeURIComponent(name.toLowerCase())}`}
                className="group flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-4 text-center shadow-sm transition-all hover:border-teal-400 dark:hover:border-cyan-500 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="text-2xl leading-none">{CATEGORY_ICONS[name] ?? "🗂️"}</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-teal-600 dark:group-hover:text-cyan-400 transition-colors">{name}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{count}개</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 최근 글 ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">최근 글</h2>
          <Link
            href="/posts"
            className="text-sm font-medium text-teal-600 dark:text-cyan-400 hover:text-teal-800 dark:hover:text-cyan-300 transition-colors"
          >
            전체 보기 →
          </Link>
        </div>

        <ul className="grid gap-3">
          {recentPosts.map((post, i) => (
            <li key={post.slug}>
              <PostCard post={post} priority={i < 2} viewCount={viewCounts[post.slug]} />
            </li>
          ))}
        </ul>
      </section>

      {/* ── 하단 광고 ── */}
      <AdSlot size="rectangle" className="mx-auto max-w-sm" />

      {/* ── 모바일: 사이드바 하단 표시 ── */}
      <div className="lg:hidden space-y-6">
        <RightSidebar />
        <Sidebar />
      </div>

      </div>{/* end 메인 콘텐츠 */}

      {/* ── 오른쪽 사이드바 (lg 이상에서만 표시) ── */}
      <aside className="hidden lg:block">
        <RightSidebar />
      </aside>
    </div>
    </>
  );
}
