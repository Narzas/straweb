import type { Metadata } from "next";
import Link from "next/link";
import ImageWithFallback from "@/components/ImageWithFallback";
import { siteConfig } from "@/lib/site";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "About",
  description:
    "StraWeb 블로그 소개입니다. 개발 경험, 크립토 투자, 게임 등 관심사를 직접 기록하는 개인 블로그입니다.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About — StraWeb",
    description:
      "StraWeb 블로그 소개입니다. 개발 경험, 크립토 투자, 게임 등 관심사를 직접 기록하는 개인 블로그입니다.",
    type: "profile",
    url: "https://www.stragos.xyz/about",
    siteName: "StraWeb",
    locale: "ko_KR",
    images: [{ url: `${siteConfig.url}/og?title=${encodeURIComponent("About — StraWeb")}`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About — StraWeb",
    description: "StraWeb 블로그 소개입니다. 개발 경험, 크립토 투자, 게임 등 관심사를 직접 기록하는 개인 블로그입니다.",
    images: [`${siteConfig.url}/og?title=${encodeURIComponent("About — StraWeb")}`],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Stragos",
  url: "https://www.stragos.xyz/about",
  description: "개발, 크립토·투자, 게임을 좋아하는 개인 블로그 StraWeb 운영자",
  sameAs: ["https://x.com/0xStragos"],
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://www.stragos.xyz/about",
  },
};

const TOPICS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    accent: "border-emerald-400 dark:border-emerald-500",
    iconBg: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    title: "크립토 · 투자",
    desc: "시장 흐름, 온체인 데이터, 개인적인 투자 관점을 정리합니다. 뉴스 집계가 아닌 직접 해석한 내용 위주입니다.",
    href: "/category/투자",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    accent: "border-cyan-400 dark:border-cyan-500",
    iconBg: "bg-teal-50 dark:bg-cyan-900/30 text-teal-600 dark:text-cyan-400",
    title: "개발",
    desc: "실제 작업하면서 막혔던 부분, 삽질 기록, 배운 것들을 남깁니다. Spring Boot, Next.js, TypeScript 등.",
    href: "/category/개발",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
      </svg>
    ),
    accent: "border-violet-400 dark:border-violet-500",
    iconBg: "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
    title: "게임 · 리뷰",
    desc: "직접 해본 게임이나 사용해본 기기에 대한 솔직한 후기를 씁니다.",
    href: "/category/리뷰",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
    accent: "border-amber-400 dark:border-amber-500",
    iconBg: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    title: "그 외 기록",
    desc: "특정 카테고리에 묶이지 않는 것들도 생각날 때 자유롭게 남깁니다.",
    href: "/category/일상",
  },
];

const TECH_STACK = [
  { label: "Next.js", color: "bg-black text-white dark:bg-white dark:text-black" },
  { label: "TypeScript", color: "bg-blue-600 text-white" },
  { label: "Tailwind CSS", color: "bg-sky-500 text-white" },
  { label: "Supabase", color: "bg-emerald-600 text-white" },
  { label: "Vercel", color: "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" },
  { label: "GitHub Actions", color: "bg-gray-700 text-white" },
];

export default function AboutPage() {
  const postCount = getAllPosts().length;

  return (
    <div className="mx-auto max-w-2xl space-y-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="space-y-0">
        {/* Cover image with overlay */}
        <div className="relative w-full h-56 rounded-t-2xl overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700">
          <ImageWithFallback src="/cover.png" alt="cover" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-teal-300/80 mb-1">Personal Blog</p>
              <h1 className="text-3xl font-black text-white tracking-tight">Stragos</h1>
            </div>
            <a
              href="https://x.com/0xStragos"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
              </svg>
              @0xStragos
            </a>
          </div>
        </div>

        {/* Profile strip below cover */}
        <div className="rounded-b-2xl border border-t-0 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-6 py-4 flex items-center gap-4">
          <div className="relative h-14 w-14 shrink-0 rounded-full overflow-hidden border-2 border-white dark:border-slate-600 shadow-md bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center -mt-8">
            <ImageWithFallback
              src="/profile.png"
              alt="profile"
              fill
              className="object-cover"
              fallback={<span className="text-xl font-bold text-white">N</span>}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Stragos</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">개발 · 크립토 · 게임을 기록하는 블로그</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{postCount}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Posts</p>
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section>
        <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
          안녕하세요, <strong className="text-gray-900 dark:text-gray-100">Stragos</strong>입니다.
          StraWeb은 제가 직접 보고 경험한 것들을 정리해두는 개인 블로그입니다.
          크립토·투자, 개발, 게임이 주요 주제이고, 틈틈이 관심 가는 것들을 자유롭게 기록합니다.
        </p>
      </section>

      {/* Topics */}
      <section className="space-y-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">다루는 주제</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOPICS.map(({ icon, accent, iconBg, title, desc, href }) => (
            <Link
              key={title}
              href={href}
              className={`group rounded-xl border-l-4 ${accent} border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4 flex gap-3 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
            >
              <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${iconBg} transition-colors`}>
                {icon}
              </div>
              <div className="space-y-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm group-hover:text-teal-600 dark:group-hover:text-cyan-400 transition-colors">{title}</p>
                <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Crypto briefing feature */}
      <section className="relative overflow-hidden rounded-2xl border border-teal-200 dark:border-cyan-800/60 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-cyan-950/30 p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-teal-400/20 dark:bg-cyan-400/10 blur-2xl"
        />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600 dark:bg-cyan-600 text-white text-xs font-bold">₿</span>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">크립토 브리핑</h2>
            <span className="rounded-full bg-teal-100 dark:bg-cyan-900/50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-cyan-400 border border-teal-200 dark:border-cyan-800">매시간 갱신</span>
          </div>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            공포·탐욕 지수, BTC 도미넌스, RSI 히트맵, 온체인 자금 흐름, 예측 시장 등
            여러 지표를 한 화면에서 볼 수 있도록 정리했습니다.
          </p>
          <Link
            href="/crypto"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-cyan-600 dark:hover:bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
          >
            브리핑 보기
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* How this site was built */}
      <section className="space-y-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">이 사이트에 대해</h2>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Next.js(App Router)와 TypeScript로 직접 개발하고, Vercel에 배포해 운영 중입니다.
          디자인부터 기능 구현까지 전부 직접 만들었고, 크립토 데이터 수집·가공 파이프라인도
          직접 구축했습니다. 사이트 자체가 하나의 사이드 프로젝트이기도 합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {TECH_STACK.map(({ label, color }) => (
            <span
              key={label}
              className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${color}`}
            >
              {label}
            </span>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          구현 과정에서 겪은 것들은 개발 카테고리 글로 정리해두고 있습니다.
        </p>
      </section>

      <hr className="border-gray-200 dark:border-slate-700" />

      {/* CTA row */}
      <section className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/guestbook"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-teal-400 dark:hover:border-cyan-600 hover:text-teal-600 dark:hover:text-cyan-400 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          방명록 남기기
        </Link>
        <Link
          href="/contact"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-cyan-600 dark:hover:bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          Contact
        </Link>
      </section>
    </div>
  );
}
