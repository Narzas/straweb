import type { Metadata } from "next";
import Link from "next/link";
import ImageWithFallback from "@/components/ImageWithFallback";

export const metadata: Metadata = {
  title: "About — StraWeb",
  description:
    "StraWeb 블로그 소개입니다. 개발 경험, 크립토 투자, 게임 등 관심사를 직접 기록하는 개인 블로그입니다.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-14">

      {/* Hero */}
      <section className="space-y-5">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">About</h1>
        <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600">
          <ImageWithFallback src="/cover.png" alt="cover" fill className="object-cover" />
        </div>
        <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          안녕하세요, <strong>Narzas</strong>입니다. StraWeb은 제가 직접 보고 경험한 것들을
          정리해두는 개인 블로그입니다. 크립토·투자, 개발, 게임이 주요 주제이고,
          틈틈이 관심 가는 것들을 자유롭게 기록합니다.
        </p>
      </section>

      <hr className="border-gray-200 dark:border-gray-700" />

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
            <p className="font-semibold text-gray-900 dark:text-gray-100">Narzas</p>
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
              icon: "📈",
              title: "크립토 · 투자",
              desc: "시장 흐름, 온체인 데이터, 개인적인 투자 관점을 정리합니다. 뉴스 집계가 아닌 직접 해석한 내용 위주입니다.",
            },
            {
              icon: "💻",
              title: "개발",
              desc: "실제 작업하면서 막혔던 부분, 삽질 기록, 배운 것들을 남깁니다. Spring Boot, Next.js, TypeScript 등.",
            },
            {
              icon: "🎮",
              title: "게임 · 리뷰",
              desc: "직접 해본 게임이나 사용해본 기기에 대한 솔직한 후기를 씁니다.",
            },
            {
              icon: "🔖",
              title: "그 외 기록",
              desc: "특정 카테고리에 묶이지 않는 것들도 생각날 때 자유롭게 남깁니다.",
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-1"
            >
              <p className="text-lg">
                {icon} <span className="font-semibold text-gray-900 dark:text-gray-100">{title}</span>
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{desc}</p>
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

      <hr className="border-gray-200 dark:border-gray-700" />

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
