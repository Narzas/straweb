import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getAllSlugs, getPostBySlug } from "@/lib/posts";
import { siteConfig } from "@/lib/site";
import TableOfContents from "@/components/TableOfContents";
import AdSlot from "@/components/AdSlot";
import CommentSection from "@/components/CommentSection";
import Sidebar from "@/components/Sidebar";
import ViewTracker from "@/components/ViewTracker";
import ViewCount from "@/components/ViewCount";

const COUPANG_ADS: Record<string, { href: string; imageId: string }> = {
  "anbernic-rg40xxv-review": {
    href: "https://link.coupang.com/a/elOIvN",
    imageId: "rg40xxv",
  },
  "anbernic-rg34xxsp-review": {
    href: "https://link.coupang.com/a/elPsEw",
    imageId: "rg34xxsp",
  },
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/posts/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `${siteConfig.url}/posts/${slug}`,
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  const showAds = post.category !== "개발";

  return (
    <div className="lg:grid lg:grid-cols-[270px_1fr] lg:gap-8 xl:gap-12">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

    <div className="relative">
      <Link
        href="/posts"
        className="mb-8 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        ← All posts
      </Link>

      <div className="lg:grid lg:grid-cols-[1fr_200px] lg:gap-12">
        <article>
          {/* Post header */}
          <header className="mb-8 space-y-4 border-b border-gray-200 pb-8">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/category/${encodeURIComponent(post.category.toLowerCase())}`}
                className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                {post.category}
              </Link>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-gray-100 break-keep">
              {post.title.includes("—") ? (
                <>
                  {post.title.split("—")[0].trimEnd()}
                  <br />
                  <span className="text-2xl font-semibold opacity-60">— {post.title.split("—").slice(1).join("—").trimStart()}</span>
                </>
              ) : post.title}
            </h1>
            <p className="text-lg leading-relaxed text-gray-500">{post.description}</p>
            <div className="flex items-center gap-3">
              <time className="text-sm text-gray-400">{post.date}</time>
              <ViewCount slug={post.slug} />
            </div>
          <ViewTracker slug={post.slug} />
          </header>

          {/* 본문 */}
          <div
            className="post-body"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />

          {/* ── 하단 광고 (본문 끝 이후) ──────────────── */}
          {showAds && <AdSlot size="horizontal" className="mt-10" />}

          {/* ── 댓글 ────────────────────────────────── */}
          <CommentSection postSlug={post.slug} />
        </article>

        {/* TOC + 파트너스 광고 Sidebar */}
        {(post.toc.length > 0 || !!COUPANG_ADS[post.slug]) && (
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-8">
              {post.toc.length > 0 && <TableOfContents toc={post.toc} />}

              {COUPANG_ADS[post.slug] && (
                <div className="flex flex-col items-center gap-1.5">
                  <a
                    href={COUPANG_ADS[post.slug].href}
                    target="_blank"
                    rel="noopener"
                    referrerPolicy="unsafe-url"
                  >
                    <Image
                      src={`/api/partner-image/${COUPANG_ADS[post.slug].imageId}`}
                      alt="쿠팡 파트너스 상품"
                      width={120}
                      height={240}
                      unoptimized
                      className="rounded-lg"
                    />
                  </a>
                  <p className="text-[10px] text-gray-400 text-center leading-snug">
                    * 쿠팡 파트너스 활동을 통해<br />수수료를 받을 수 있음
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── 모바일 사이드바 (lg 미만 하단 표시) ── */}
      <div className="lg:hidden mt-8">
        <Sidebar />
      </div>
    </div>
    </div>
  );
}
