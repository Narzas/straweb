import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/posts";
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

  const topTags = getAllTags().slice(0, 12);

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
            className="flex-1 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-teal-400 dark:focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:focus:ring-cyan-800 transition"
          />
          <button
            type="submit"
            className="rounded-xl bg-teal-600 hover:bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
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
        <div className="space-y-6 py-10 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-6 w-24 h-24 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">결과가 없습니다</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              <span className="font-medium text-gray-600 dark:text-gray-300">&ldquo;{query}&rdquo;</span>에 맞는 글을 찾지 못했습니다.
            </p>
          </div>
          {topTags.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">인기 태그로 찾아보기</p>
              <div className="flex flex-wrap justify-center gap-2">
                {topTags.map(({ name }) => (
                  <a
                    key={name}
                    href={`/search?q=${encodeURIComponent(name)}`}
                    className="rounded-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-teal-400 dark:hover:border-cyan-500 hover:text-teal-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    #{name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 빈 상태 — 검색 전 */}
      {!query && (
        <div className="space-y-8 py-8">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-400 dark:text-slate-500">제목, 태그, 카테고리로 검색할 수 있습니다.</p>
          </div>
          {topTags.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">인기 태그</p>
              <div className="flex flex-wrap gap-2">
                {topTags.map(({ name, count }) => (
                  <a
                    key={name}
                    href={`/search?q=${encodeURIComponent(name)}`}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-teal-400 dark:hover:border-cyan-500 hover:text-teal-600 dark:hover:text-cyan-400 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <span className="text-gray-400 dark:text-slate-500 group-hover:text-teal-400 dark:group-hover:text-cyan-500 transition-colors">#</span>
                    {name}
                    <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">{count}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 결과 */}
      {posts.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2">
          {posts.map((post, i) => (
            <li key={post.slug}>
              <PostCard post={post} priority={i < 2} variant="grid" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
