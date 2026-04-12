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
}: {
  post: PostMeta;
  priority?: boolean;
}) {
  const gradient = pickGradient(post.slug);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">

      {/* Thumbnail */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100 dark:bg-slate-700">
        {post.cover ? (
          <Image
            src={post.cover}
            alt={post.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
          >
            <span className="select-none text-5xl font-bold text-white/30">
              {post.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* 카테고리 + 태그 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/category/${encodeURIComponent(post.category.toLowerCase())}`}
            className="relative z-10 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            {post.category}
          </Link>
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 dark:bg-slate-600 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 제목 — stretched-link: after 가상 요소가 카드 전체를 덮음 */}
        <h2 className="text-lg font-semibold leading-normal text-gray-900 dark:text-gray-100 transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400 break-keep">
          <Link
            href={`/posts/${post.slug}`}
            className="after:absolute after:inset-0 after:z-0"
          >
            {post.title.includes("—") ? (
              <>
                {post.title.split("—")[0].trimEnd()}
                <br />
                <span className="text-base font-normal opacity-70">— {post.title.split("—").slice(1).join("—").trimStart()}</span>
              </>
            ) : post.title}
          </Link>
        </h2>

        {post.firstHeading && (
          <p className="line-clamp-1 flex-1 text-sm leading-relaxed text-gray-400 dark:text-gray-500">
            {post.firstHeading}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between">
          <time className="text-xs text-gray-400 dark:text-gray-500">{post.date}</time>
          <ViewCount slug={post.slug} />
        </div>
      </div>
    </div>
  );
}
