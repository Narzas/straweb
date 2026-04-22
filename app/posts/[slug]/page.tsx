import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getAllSlugs, getPostBySlug, getAllPosts } from "@/lib/posts";
import { siteConfig } from "@/lib/site";
import TableOfContents from "@/components/TableOfContents";
import AdSlot from "@/components/AdSlot";
import CommentSection from "@/components/CommentSection";
import Sidebar from "@/components/Sidebar";
import ViewCount from "@/components/ViewCount";
import PostBody from "@/components/PostBody";
import ShareButtons from "@/components/ShareButtons";
import ReadingProgress from "@/components/ReadingProgress";
import MobileToc from "@/components/MobileToc";

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
    keywords: post.tags?.length ? post.tags : [...siteConfig.keywords],
    authors: [{ name: siteConfig.author, url: siteConfig.url }],
    creator: siteConfig.author,
    alternates: { canonical: `/posts/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      locale: "ko_KR",
      siteName: siteConfig.name,
      url: `${siteConfig.url}/posts/${slug}`,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [siteConfig.author],
      tags: post.tags,
      images: [
        post.cover && !post.cover.endsWith(".svg")
          ? { url: `${siteConfig.url}${post.cover}`, width: 1200, height: 630, alt: post.title }
          : { url: `${siteConfig.url}/og?title=${encodeURIComponent(post.title)}&category=${encodeURIComponent(post.category)}&date=${encodeURIComponent(post.date)}`, width: 1200, height: 630, alt: post.title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.cover && !post.cover.endsWith(".svg") ? `${siteConfig.url}${post.cover}` : `${siteConfig.url}/og?title=${encodeURIComponent(post.title)}&category=${encodeURIComponent(post.category)}&date=${encodeURIComponent(post.date)}`],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  const showAds = post.category !== "개발";
  const allPosts = getAllPosts();
  const currentIdx = allPosts.findIndex((p) => p.slug === post.slug);
  const prevPost = currentIdx < allPosts.length - 1 ? allPosts[currentIdx + 1] : null;
  const nextPost = currentIdx > 0 ? allPosts[currentIdx - 1] : null;

  const relatedPosts = allPosts
    .filter((p) => p.slug !== post.slug && p.slug !== prevPost?.slug && p.slug !== nextPost?.slug)
    .map((p) => ({
      ...p,
      score: (p.category === post.category ? 2 : 0) + p.tags.filter((t) => post.tags.includes(t)).length,
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    author: { "@type": "Person", name: siteConfig.author, url: siteConfig.url, sameAs: ["https://x.com/0xStragos"] },
    datePublished: post.date,
    dateModified: post.date,
    url: `${siteConfig.url}/posts/${slug}`,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    keywords: post.tags?.join(", "),
    inLanguage: "ko-KR",
    ...(post.cover ? { image: `${siteConfig.url}${post.cover}` } : {}),
  };

  return (
    <>
      <ReadingProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    <div className="lg:grid lg:grid-cols-[270px_1fr] lg:gap-8 xl:gap-12">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

    <div className="relative">
      <Link
        href="/posts"
        aria-label="모든 포스트 목록으로 돌아가기"
        className="mb-8 inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        ← All posts
      </Link>

      <div className="lg:grid lg:grid-cols-[1fr_200px] lg:gap-12">
        <article>
          {/* Post header */}
          <header className="mb-8 space-y-4 border-b border-gray-200 dark:border-slate-700 pb-8">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/category/${encodeURIComponent(post.category.toLowerCase())}`}
                className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                {post.category}
              </Link>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tag/${encodeURIComponent(tag.toLowerCase())}`}
                  className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                >
                  #{tag}
                </Link>
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
            <p className="text-lg leading-relaxed text-gray-500 dark:text-gray-400">{post.description}</p>
            <div className="flex items-center gap-3">
              <time className="text-sm text-gray-400">{post.date}</time>
              <ViewCount slug={post.slug} track={true} />
            </div>
            <div className="mt-4">
              <ShareButtons
                title={post.title}
                url={`${siteConfig.url}/posts/${post.slug}`}
              />
            </div>
          </header>

          {/* 모바일 목차 */}
          <MobileToc toc={post.toc} />

          {/* 본문 */}
          <PostBody contentHtml={post.contentHtml} />

          {/* ── 하단 광고 (본문 끝 이후) ──────────────── */}
          {showAds && <AdSlot size="horizontal" className="mt-10" />}

          {/* ── 관련 글 ──────────────────────────────── */}
          {relatedPosts.length > 0 && (
            <section className="mt-12 border-t border-gray-200 dark:border-slate-700 pt-8">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                관련 글
              </h2>
              <ul className="space-y-3">
                {relatedPosts.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/posts/${p.slug}`}
                      className="group flex items-start gap-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                    >
                      <span className="mt-0.5 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {p.category}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {p.title}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{p.date}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── 이전/다음 글 ─────────────────────────── */}
          {(prevPost || nextPost) && (
            <nav aria-label="이전/다음 글" className="mt-12 border-t border-gray-200 dark:border-slate-700 pt-8 grid grid-cols-2 gap-4">
              <div>
                {prevPost && (
                  <Link
                    href={`/posts/${prevPost.slug}`}
                    className="group flex flex-col gap-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors h-full"
                  >
                    <span className="text-xs text-gray-400 dark:text-gray-500">← 이전 글</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 transition-colors break-keep">
                      {prevPost.title}
                    </span>
                  </Link>
                )}
              </div>
              <div>
                {nextPost && (
                  <Link
                    href={`/posts/${nextPost.slug}`}
                    className="group flex flex-col gap-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors text-right h-full"
                  >
                    <span className="text-xs text-gray-400 dark:text-gray-500">다음 글 →</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 transition-colors break-keep">
                      {nextPost.title}
                    </span>
                  </Link>
                )}
              </div>
            </nav>
          )}

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
    </>
  );
}
