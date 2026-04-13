import Link from "next/link";
import Image from "next/image";
import type { PostMeta } from "@/lib/posts";
import ViewCount from "@/components/ViewCount";

const GRADIENTS = [
  "from-violet-500 to-indigo-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-rose-600",
  "from-pink-500 to-purple-600",
  "from-amber-500 to-orange-600",
];

function pickGradient(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

export default function PostCard({
  post,
  priority = false,
  viewCount,
}: {
  post: PostMeta;
  priority?: boolean;
  viewCount?: number;
}) {
  const gradient = pickGradient(post.slug);

  return (
    <div className="group relative flex flex-row overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">

      {/* Thumbnail */}
      <div className="relative w-36 shrink-0 self-stretch overflow-hidden bg-gray-100 dark:bg-slate-700 sm:w-44 min-h-[120px]">
        {post.cover ? (
          <Image
            src={post.cover}
            alt={post.title}
            fill
            sizes="176px"
            className={`transition-transform duration-300 group-hover:scale-105 ${post.cover.endsWith(".svg") ? "object-cover object-center" : "object-contain"}`}
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            unoptimized={post.cover.endsWith(".svg")}
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
          >
            <span className="select-none text-4xl font-bold text-white/30">
              {post.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4 min-w-0">
        {/* 카테고리 + 태그 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/category/${encodeURIComponent(post.category.toLowerCase())}`}
            className="relative z-10 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            {post.category}
          </Link>
          {post.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 dark:bg-slate-600 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 제목 — stretched-link: after 가상 요소가 카드 전체를 덮음 */}
        <h2 className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100 transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400 break-keep line-clamp-2">
          <Link
            href={`/posts/${post.slug}`}
            className="after:absolute after:inset-0 after:z-0"
          >
            {post.title.includes("—") ? (
              <>
                {post.title.split("—")[0].trimEnd()}
                <span className="font-normal opacity-60"> — {post.title.split("—").slice(1).join("—").trimStart()}</span>
              </>
            ) : post.title}
          </Link>
        </h2>

        {post.firstHeading && (
          <p className="line-clamp-1 text-sm leading-relaxed text-gray-400 dark:text-gray-500">
            {post.firstHeading}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <time className="text-xs text-gray-400 dark:text-gray-500">{post.date}</time>
          <ViewCount slug={post.slug} initialCount={viewCount} />
        </div>
      </div>
    </div>
  );
}
