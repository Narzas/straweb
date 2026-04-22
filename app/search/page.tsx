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
      {/* 검색 입력 */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">검색</h1>
        <form method="GET" action="/search" className="flex gap-2">
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="제목, 태그, 카테고리로 검색..."
            autoComplete="off"
            className="flex-1 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-indigo-400 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition"
          />
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            검색
          </button>
        </form>
        {query && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &ldquo;{query}&rdquo; — {posts.length}개 결과
          </p>
        )}
      </div>

      {/* 빈 상태 — 결과 없음 */}
      {query && posts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="rounded-full bg-orange-50 dark:bg-orange-950/30 p-4">
            <svg className="w-10 h-10 text-orange-300 dark:text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">결과가 없습니다</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            <span className="font-medium text-gray-600 dark:text-gray-400">&ldquo;{query}&rdquo;</span>에 맞는 글을 찾지 못했습니다.<br />다른 키워드로 검색해보세요.
          </p>
        </div>
      )}

      {/* 빈 상태 — 검색 전 */}
      {!query && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="rounded-full bg-gray-50 dark:bg-slate-800 p-4">
            <svg className="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7 7 0 1116.65 16.65z" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-500 dark:text-gray-400">검색어를 입력해주세요</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">제목, 태그, 카테고리로 검색할 수 있습니다.</p>
        </div>
      )}

      {/* 결과 */}
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
