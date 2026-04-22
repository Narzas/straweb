import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllTags, getPostsByTag } from "@/lib/posts";
import { siteConfig } from "@/lib/site";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";

export const revalidate = 60;

type Props = { params: Promise<{ name: string }> };

export async function generateStaticParams() {
  const tags = getAllTags();
  return tags.map(({ name }) => ({ name: encodeURIComponent(name.toLowerCase()) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const label = decodeURIComponent(name);
  return {
    title: `#${label}`,
    description: `StraWeb에서 '${label}' 태그가 붙은 글 목록입니다.`,
    alternates: { canonical: `/tag/${name}` },
    openGraph: {
      title: `#${label} — StraWeb`,
      description: `StraWeb에서 '${label}' 태그가 붙은 글 목록입니다.`,
      type: "website",
      url: `https://www.stragos.xyz/tag/${name}`,
      images: [{ url: `${siteConfig.url}/og?title=${encodeURIComponent(`#${label}`)}`, width: 1200, height: 630 }],
    },
  };
}

export default async function TagPage({ params }: Props) {
  const { name } = await params;
  const label = decodeURIComponent(name);
  const posts = getPostsByTag(label);

  if (posts.length === 0) notFound();

  const allTags = getAllTags();

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
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 break-keep">
              <span className="text-indigo-500 mr-0.5">#</span>{label}
            </h1>
            <span className="text-sm text-gray-400">{posts.length}개</span>
          </div>
        </div>

        {/* 태그 목록 */}
        <div className="flex flex-wrap gap-2">
          {allTags.map(({ name: t, count }) => {
            const isActive = t.toLowerCase() === label.toLowerCase();
            return (
              <Link
                key={t}
                href={`/tag/${encodeURIComponent(t.toLowerCase())}`}
                className={[
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600",
                ].join(" ")}
              >
                #{t}
                <span className={["ml-1.5 text-xs", isActive ? "text-indigo-200" : "text-gray-400 dark:text-gray-500"].join(" ")}>
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* 글 목록 */}
        <ul className="grid gap-8 sm:grid-cols-2">
          {posts.map((post) => (
            <li key={post.slug}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>

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
