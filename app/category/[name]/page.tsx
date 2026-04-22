import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllCategories, getPostsByCategory } from "@/lib/posts";
import { siteConfig } from "@/lib/site";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";

export const revalidate = 60;

type Props = {
  params: Promise<{ name: string }>;
};

export async function generateStaticParams() {
  const categories = getAllCategories();
  return categories.map(({ name }) => ({
    name: name.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const label = decodeURIComponent(name);

  return {
    title: `${label} 카테고리`,
    description: `StraWeb의 '${label}' 카테고리 글 목록입니다. 개발, 크립토, 리뷰 등 다양한 주제를 다룹니다.`,
    alternates: { canonical: `/category/${name}` },
    openGraph: {
      title: `${label} 카테고리 — StraWeb`,
      description: `StraWeb의 '${label}' 카테고리 글 목록입니다.`,
      type: "website",
      url: `https://www.stragos.xyz/category/${name}`,
      images: [{ url: `${siteConfig.url}/og?title=${encodeURIComponent(`${label} 카테고리`)}`, width: 1200, height: 630 }],
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { name } = await params;
  const label = decodeURIComponent(name);

  const posts = getPostsByCategory(label);
  if (posts.length === 0) notFound();

  const allCategories = getAllCategories();

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr_220px] lg:gap-6 xl:gap-8">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/posts"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          ← All posts
        </Link>
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 capitalize break-keep">
            {label}
          </h1>
          <span className="text-sm text-gray-400">{posts.length} posts</span>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {allCategories.map(({ name: cat, count }) => {
          const isActive = cat.toLowerCase() === label.toLowerCase();
          return (
            <Link
              key={cat}
              href={`/category/${encodeURIComponent(cat.toLowerCase())}`}
              className={[
                "rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600",
              ].join(" ")}
            >
              {cat}
              <span className={["ml-1.5 text-xs", isActive ? "text-indigo-200" : "text-gray-400 dark:text-gray-500"].join(" ")}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Post grid */}
      <ul className="grid gap-8 sm:grid-cols-2">
        {posts.map((post) => (
          <li key={post.slug}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>

      {/* ── 모바일 사이드바 (lg 미만 하단 표시) ── */}
      <div className="lg:hidden space-y-6">
        <Sidebar />
        <RightSidebar />
      </div>
    </div>

      <aside className="hidden lg:block">
        <RightSidebar />
      </aside>
    </div>
  );
}
