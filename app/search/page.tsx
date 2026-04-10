import type { Metadata } from "next";
import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `"${q}" 검색 결과` : "검색",
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const posts = query
    ? getAllPosts().filter((p) => {
        const lq = query.toLowerCase();
        return (
          p.title.toLowerCase().includes(lq) ||
          p.description.toLowerCase().includes(lq) ||
          p.tags.some((t) => t.toLowerCase().includes(lq)) ||
          p.category.toLowerCase().includes(lq)
        );
      })
    : [];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">검색</h1>
        {query && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            &ldquo;{query}&rdquo; 검색 결과 — {posts.length}개
          </p>
        )}
      </div>

      {query && posts.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">검색 결과가 없습니다.</p>
      )}

      {!query && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">검색어를 입력해주세요.</p>
      )}

      {posts.length > 0 && (
        <ul className="grid gap-6 sm:grid-cols-2">
          {posts.map((post, i) => (
            <li key={post.slug}>
              <PostCard post={post} priority={i < 2} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
