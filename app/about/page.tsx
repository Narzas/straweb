import type { Metadata } from "next";
import Link from "next/link";
import ImageWithFallback from "@/components/ImageWithFallback";
import { siteConfig } from "@/lib/site";

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

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="space-y-5">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">About</h1>
        <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600">
          <ImageWithFallback src="/cover.png" alt="cover" fill className="object-cover" />
        </div>
        <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          안녕하세요, <strong>Stragos</strong>입니다. StraWeb은 제가 직접 보고 경험한 것들을
          정리해두는 개인 블로그입니다. 크립토·투자, 개발, 게임이 주요 주제이고,
          틈틈이 관심 가는 것들을 자유롭게 기록합니다.
        </p>
      </section>

      <hr className="border-gray-200 dark:border-slate-700" />

      {/* Profile */}
      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">운영자 소개</h2>
        <div className="flex items-start gap-5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <ImageWithFallback
              src="/profile.png"
              alt="profile"
              fill
              className="object-cover"
              fallback={<span className="text-2xl font-bold text-white">N</span>}
            />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Stragos</p>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              개발을 업으로 삼고 있고, 크립토·블록체인·주식 투자에 관심이 많습니다.
              게임과 게임기도 좋아해서 가끔 리뷰를 남기기도 합니다.
              이 블로그는 그런 관심사들을 꾸준히 기록해두려는 목적으로 시작했습니다.
            </p>
          </div>
        </div>
      </section>

      {/* What this blog covers */}
      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">다루는 주제</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              ),
              color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
              title: "크립토 · 투자",
              desc: "시장 흐름, 온체인 데이터, 개인적인 투자 관점을 정리합니다. 뉴스 집계가 아닌 직접 해석한 내용 위주입니다.",
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              ),
              color: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
              title: "개발",
              desc: "실제 작업하면서 막혔던 부분, 삽질 기록, 배운 것들을 남깁니다. Spring Boot, Next.js, TypeScript 등.",
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
                </svg>
              ),
              color: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
              title: "게임 · 리뷰",
              desc: "직접 해본 게임이나 사용해본 기기에 대한 솔직한 후기를 씁니다.",
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              ),
              color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
              title: "그 외 기록",
              desc: "특정 카테고리에 묶이지 않는 것들도 생각날 때 자유롭게 남깁니다.",
            },
          ].map(({ icon, color, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex gap-3"
            >
              <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${color}`}>
                {icon}
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</p>
                <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Crypto briefing feature */}
      <section className="space-y-4 rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">크립토 브리핑</h2>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          매시간 자동으로 갱신되는 크립토 시장 요약 페이지를 직접 만들어 운영하고 있습니다.
          공포·탐욕 지수, BTC 도미넌스, RSI 히트맵, 온체인 자금 흐름, 예측 시장 등
          여러 지표를 한 화면에서 볼 수 있도록 정리했습니다.
        </p>
        <Link
          href="/crypto"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          크립토 브리핑 보기 →
        </Link>
      </section>

      {/* How this site was built */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">이 사이트에 대해</h2>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Next.js(App Router)와 TypeScript로 직접 개발하고, Vercel에 배포해 운영 중입니다.
          디자인부터 기능 구현까지 전부 직접 만들었고, 크립토 데이터 수집·가공 파이프라인도
          직접 구축했습니다. 사이트 자체가 하나의 사이드 프로젝트이기도 합니다.
        </p>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          구현 과정에서 겪은 것들은 개발 카테고리 글로 정리해두고 있습니다.
        </p>
      </section>

      <hr className="border-gray-200 dark:border-slate-700" />

      {/* CTA */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">문의 · 피드백</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          블로그 관련 이야기나 피드백은 언제든 환영합니다.
        </p>
        <Link
          href="/contact"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Contact →
        </Link>
      </section>

    </div>
  );
}
