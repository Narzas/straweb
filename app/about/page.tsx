import type { Metadata } from "next";
import Link from "next/link";
import ImageWithFallback from "@/components/ImageWithFallback";

export const metadata: Metadata = {
  title: "About",
  description: "StraWeb 블로그 소개 및 운영자 정보입니다.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-12">
      {/* Hero */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">About</h1>
        <p className="text-lg leading-relaxed text-gray-600">
          안녕하세요. StraWeb에 오신 것을 환영합니다.
        </p>
        <p className="text-lg leading-relaxed text-gray-600">
          이곳은 개발을 하면서 겪은 일들이나 관심 있는 것들을 편하게 기록하는 공간입니다.
          그때그때 있었던 일이나 생각들을 가볍게 남기고 있습니다.
        </p>
        <p className="text-lg leading-relaxed text-gray-600">
          게임이나 게임기 같은 것들을 취미로 즐기고 있고,
          크립토, 블록체인, 주식 등 투자에도 관심이 많습니다.
        </p>

        {/* 커버 이미지 — public/cover.png 없으면 그라디언트 표시 */}
        <div className="relative w-full h-56 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600">
          <ImageWithFallback
            src="/cover.png"
            alt="cover"
            fill
            className="object-cover"
          />
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Profile */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">소개</h2>
        <div className="flex items-start gap-5">
          {/* 프로필 이미지 — public/profile.png 없으면 이니셜 표시 */}
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <ImageWithFallback
              src="/profile.png"
              alt="profile"
              fill
              className="object-cover"
              fallback={
                <span className="text-2xl font-bold text-white">S</span>
              }
            />
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-gray-900">StraWeb 운영자</p>
            <p className="text-sm leading-relaxed text-gray-600">
              개발을 하면서 겪은 경험과 생각들을 기록하기 위해 블로그를 운영하고 있습니다.
            </p>
            <p className="text-sm leading-relaxed text-gray-600">
              특정 주제에 한정되지 않고, 관심 있는 것들을 꾸준히 정리해 나가는 것을 목표로 합니다.
            </p>
          </div>
        </div>
      </section>

      {/* Blog purpose */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">블로그 방향</h2>
        <ul className="space-y-2 text-gray-600">
          {[
            "개발 과정에서 겪은 경험과 기록",
            "관심 있는 것들에 대한 자유로운 기록",
            "투자 및 크립토 관련 개인적인 관점",
            "사용해본 것들에 대한 리뷰",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 text-indigo-500">▸</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="rounded-2xl bg-indigo-50 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">문의 및 피드백</h2>
        <p className="text-sm text-gray-600">
          블로그 관련 이야기나 가벼운 피드백은 언제든지 환영합니다.
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
