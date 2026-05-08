import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllAdminSlugs, getAdminPostBySlug } from "@/lib/admin-posts";
import PostBody from "@/components/PostBody";
import TableOfContents from "@/components/TableOfContents";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "운영 노트",
  robots: { index: false, follow: false, nocache: true },
};

export async function generateStaticParams() {
  return getAllAdminSlugs().map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export default async function AdminPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getAdminPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/posts"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          ← 운영 노트 목록
        </Link>
        <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          어드민 전용 · 외부 미공개
        </span>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-10">
        <article>
          <header className="mb-8 space-y-3 border-b border-gray-200 dark:border-slate-700 pb-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 font-semibold text-white">
                {post.category}
              </span>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 font-medium text-indigo-600 dark:text-indigo-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-gray-100 break-keep">
              {post.title}
            </h1>
            {post.description && (
              <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">
                {post.description}
              </p>
            )}
            <time className="text-sm text-gray-400">{post.date}</time>
          </header>

          <PostBody contentHtml={post.contentHtml} />
        </article>

        {post.toc.length > 0 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TableOfContents toc={post.toc} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
