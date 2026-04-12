import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllPosts } from "@/lib/posts";
import { createServiceClient } from "@/lib/supabase";
import PostCard from "@/components/PostCard";
import PostSortTabs from "@/components/PostSortTabs";
import Sidebar from "@/components/Sidebar";

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

export default async function PostsPage({ searchParams }: Props) {
  const { sort } = await searchParams;

  let posts = getAllPosts(); // 기본: 최신순

  if (sort === "views") {
    const viewCounts = await getViewCounts();
    posts = [...posts].sort(
      (a, b) => (viewCounts[b.slug] ?? 0) - (viewCounts[a.slug] ?? 0)
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-10 xl:gap-14">
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

        <ul className="grid gap-6 sm:grid-cols-2">
          {posts.map((post, i) => (
            <li key={post.slug}>
              <PostCard post={post} priority={i < 2} />
            </li>
          ))}
        </ul>

        {/* ── 모바일 사이드바 (lg 미만 하단 표시) ── */}
        <div className="lg:hidden">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
