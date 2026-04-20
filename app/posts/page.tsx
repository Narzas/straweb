import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getAllPosts, getAllCategories } from "@/lib/posts";
import { createServiceClient } from "@/lib/supabase";
import PostCard from "@/components/PostCard";
import PostSortTabs from "@/components/PostSortTabs";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Posts",
  description: "All blog posts on StraWeb.",
  alternates: {
    canonical: "/posts",
  },
  openGraph: {
    title: "Posts",
    description: "All blog posts on StraWeb.",
    type: "website",
    url: "/posts",
  },
};

async function getViewCounts(): Promise<Record<string, number>> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("post_views")
      .select("slug, view_count");
    if (!data) return {};
    return Object.fromEntries(
      data.map(({ slug, view_count }: { slug: string; view_count: number }) => [
        slug,
        view_count,
      ])
    );
  } catch {
    return {};
  }
}

type Props = {
  searchParams: Promise<{ sort?: string }>;
};

const CATEGORY_ICONS: Record<string, string> = {
  개발: "💻",
  리뷰: "📦",
  일상: "☀️",
  투자: "📈",
  정보: "📌",
};

export default async function PostsPage({ searchParams }: Props) {
  const { sort } = await searchParams;
  const categories = getAllCategories();

  let posts = getAllPosts(); // 기본: 최신순

  if (sort === "views") {
    const viewCounts = await getViewCounts();
    posts = [...posts].sort(
      (a, b) => (viewCounts[b.slug] ?? 0) - (viewCounts[a.slug] ?? 0)
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr_220px] lg:gap-6 xl:gap-8">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

      <div className="space-y-8">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Posts</h1>
            <p className="text-gray-500">{posts.length} posts total</p>
          </div>
          <Suspense>
            <PostSortTabs />
          </Suspense>
        </div>

        {categories.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">카테고리</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(({ name, count }) => (
                <Link
                  key={name}
                  href={`/category/${encodeURIComponent(name.toLowerCase())}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-400"
                >
                  <span>{CATEGORY_ICONS[name] ?? "🗂️"}</span>
                  {name}
                  <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {count}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <ul className="grid gap-3">
          {posts.map((post, i) => (
            <li key={post.slug}>
              <PostCard post={post} priority={i < 2} />
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
