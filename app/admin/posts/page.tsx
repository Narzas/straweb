import Link from "next/link";
import { getAllAdminPosts } from "@/lib/admin-posts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "운영 노트",
  robots: { index: false, follow: false },
};

function isRecent(dateStr: string, days = 7): boolean {
  const postDate = new Date(`${dateStr}T00:00:00+09:00`);
  const now = new Date();
  const diffMs = now.getTime() - postDate.getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/admin/posts/${p.slug}`}
              className="group flex flex-col rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-br from-indigo-50/60 to-blue-50/40 dark:from-indigo-950/30 dark:to-blue-950/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap">
                    {p.category}
                  </span>
                  {isRecent(p.date, 3) && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap animate-pulse">
                      NEW
                    </span>
                  )}
                </div>
                <time className="text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {p.date}
                </time>
              </div>
              <div className="flex-1 px-5 py-4 flex flex-col">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 line-clamp-2">
                  {p.title}
                </h2>
                {p.description && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3 flex-1">
                    {p.description}
                  </p>
                )}
                {p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-300"
                      >
                        #{t}
                      </span>
                    ))}
                    {p.tags.length > 4 && (
                      <span className="text-[10px] text-gray-400 self-center">
                        +{p.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
