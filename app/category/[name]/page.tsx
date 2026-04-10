import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllCategories, getPostsByCategory } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";

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
    title: `${label} posts`,
    description: `All posts in the ${label} category.`,
    alternates: { canonical: `/category/${name}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { name } = await params;
  const label = decodeURIComponent(name);

  const posts = getPostsByCategory(label);
  if (posts.length === 0) notFound();

  const allCategories = getAllCategories();

  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-10 xl:gap-14">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

    <div className="space-y-8">
        {/* ── 모바일 사이드바 ── */}
        <div className="lg:hidden">
          <Sidebar />
        </div>
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/posts"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          ← All posts
        </Link>
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 capitalize break-keep">
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
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              {cat}
              <span className={["ml-1.5 text-xs", isActive ? "text-indigo-200" : "text-gray-400"].join(" ")}>
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
    </div>
    </div>
  );
}
