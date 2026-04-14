import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import type { Root } from "hast";
import { visit } from "unist-util-visit";

/** 마크다운 내 <img>에 loading="lazy" decoding="async" 추가 */
function rehypeLazyImages() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "img") {
        node.properties = {
          ...node.properties,
          loading: "lazy",
          decoding: "async",
        };
      }
    });
  };
}

const postsDir = path.join(process.cwd(), "posts");

export type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
  firstHeading?: string;
  tags: string[];
  cover?: string;
  category: string;
};

export type Post = PostMeta & {
  contentHtml: string;
  toc: TocItem[];
};

function extractFirstHeading(markdown: string): string | undefined {
  for (const line of markdown.split("\n")) {
    const match = line.match(/^#{1,3}\s+(.+)/);
    if (match) return match[1].trim().replace(/[`*_]/g, "");
  }
  return undefined;
}

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const items: TocItem[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (!match) continue;

    const level = match[1].length as 2 | 3;
    // strip HTML tags first, then inline markup
    const text = match[2].trim().replace(/<[^>]+>/g, "").replace(/[`*_]/g, "").trim();
    // replicate github-slugger id generation (used by rehype-slug)
    // \p{L}\p{N} keeps unicode letters/numbers including Korean
    const id = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");

    if (!id) continue;
    items.push({ id, text, level });
  }

  return items;
}

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));

  return files
    .map((filename) => {
      const filePath = path.join(postsDir, filename);
      const slug = filename.replace(/\.md$/, "");
      const raw = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(raw);

      // date가 Date 객체면 로컬 시각 기준 문자열로 변환 (toISOString은 UTC 변환 → 시간대 오류)
      const rawDate: string = data.date instanceof Date
        ? (() => {
            const d = data.date as Date;
            const Y = d.getFullYear();
            const M = String(d.getMonth() + 1).padStart(2, "0");
            const D = String(d.getDate()).padStart(2, "0");
            const h = String(d.getHours()).padStart(2, "0");
            const m = String(d.getMinutes()).padStart(2, "0");
            const s = String(d.getSeconds()).padStart(2, "0");
            return `${Y}-${M}-${D}T${h}:${m}:${s}`;
          })()
        : String(data.date);

      return {
        slug,
        title: data.title as string,
        date: rawDate.slice(0, 10),      // 화면 표시용: YYYY-MM-DD
        _sortKey: rawDate,               // 정렬용: 시간 포함 전체 문자열
        description: (data.description as string) ?? "",
        firstHeading: extractFirstHeading(content),
        tags: (data.tags as string[]) ?? [],
        cover: (data.cover as string) ?? undefined,
        category: (data.category as string) ?? "Uncategorized",
      };
    })
    .sort((a, b) => (a._sortKey < b._sortKey ? 1 : -1))
    .map(({ _sortKey, ...post }) => post) as PostMeta[];
}

export function getAllCategories(): { name: string; count: number }[] {
  const posts = getAllPosts();
  const map = new Map<string, number>();
  for (const post of posts) {
    map.set(post.category, (map.get(post.category) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function getPostsByCategory(category: string): PostMeta[] {
  return getAllPosts().filter(
    (p) => p.category.toLowerCase() === category.toLowerCase()
  );
}

export function getAllSlugs(): string[] {
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const filePath = path.join(postsDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const toc = extractToc(content);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: "prepend",
      properties: { className: ["anchor"], ariaHidden: "true", tabIndex: -1 },
      content: { type: "text", value: "#" },
    })
    .use(rehypePrettyCode, {
      theme: "github-dark",
      keepBackground: true,
    })
    .use(rehypeLazyImages)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);

  return {
    slug,
    title: data.title as string,
    date: data.date instanceof Date
      ? (() => {
          const d = data.date as Date;
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        })()
      : String(data.date).slice(0, 10),
    description: (data.description as string) ?? "",
    tags: (data.tags as string[]) ?? [],
    cover: (data.cover as string) ?? undefined,
    category: (data.category as string) ?? "Uncategorized",
    contentHtml: result.toString(),
    toc,
  };
}
