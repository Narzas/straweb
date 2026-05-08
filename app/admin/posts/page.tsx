import Link from "next/link";
import { getAllAdminPosts } from "@/lib/admin-posts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "운영 노트",
  robots: { index: false, follow: false },
};

export default function AdminPostsPage() {
  const posts = getAllAdminPosts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          운영 노트
        </h1>
        <Link
          href="/admin/analytics"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          ← Analytics
        </Link>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        어드민 전용 문서입니다. 일반 사이트(검색·sitemap·RSS) 어디에도
        노출되지 않습니다.
      </p>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-sm text-gray-400">
          아직 작성된 운영 노트가 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/admin/posts/${p.slug}`}
                className="block rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {p.category}
                  </span>
                  <time>{p.date}</time>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {p.title}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {p.description}
                </p>
                {p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-300"
                      >
                        #{t}
                      </span>
                    ))}
                    {p.tags.length > 6 && (
                      <span className="text-[10px] text-gray-400">
                        +{p.tags.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
