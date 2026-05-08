/**
 * 어드민 전용 포스트 로더
 * - posts/ 와는 분리된 admin-posts/ 디렉토리 사용
 * - sitemap, RSS, 검색, 일반 카테고리/태그 어디에도 노출되지 않음
 * - app/admin/posts/[slug] 라우트에서만 렌더링 (admin layout 의 isAuthed() 가 보호)
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
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

const adminPostsDir = path.join(process.cwd(), "admin-posts");

export type AdminTocItem = { id: string; text: string; level: 2 | 3 };

export type AdminPostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  cover?: string;
  category: string;
};

export type AdminPost = AdminPostMeta & {
  contentHtml: string;
  toc: AdminTocItem[];
};

function extractToc(markdown: string): AdminTocItem[] {
  const items: AdminTocItem[] = [];
  const slugger = new GithubSlugger();
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].trim().replace(/<[^>]+>/g, "").replace(/[`*_]/g, "").trim();
    const id = slugger.slug(text);
    if (!id) continue;
    items.push({ id, text, level });
  }
  return items;
}

function ensureDir(): boolean {
  return fs.existsSync(adminPostsDir);
}

export function getAllAdminPosts(): AdminPostMeta[] {
  if (!ensureDir()) return [];
  const files = fs.readdirSync(adminPostsDir).filter((f) => f.endsWith(".md"));
  return files
    .map((filename) => {
      const filePath = path.join(adminPostsDir, filename);
      const slug = filename.replace(/\.md$/, "");
      const raw = fs.readFileSync(filePath, "utf8");
      const { data } = matter(raw);

      const rawDate: string =
        data.date instanceof Date
          ? (() => {
              const d = data.date as Date;
              const Y = d.getFullYear();
              const M = String(d.getMonth() + 1).padStart(2, "0");
              const D = String(d.getDate()).padStart(2, "0");
              return `${Y}-${M}-${D}`;
            })()
          : String(data.date).slice(0, 10);

      return {
        slug,
        title: data.title as string,
        date: rawDate,
        description: (data.description as string) ?? "",
        tags: (data.tags as string[]) ?? [],
        cover: (data.cover as string) ?? undefined,
        category: (data.category as string) ?? "운영 노트",
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getAllAdminSlugs(): string[] {
  if (!ensureDir()) return [];
  return fs
    .readdirSync(adminPostsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export async function getAdminPostBySlug(slug: string): Promise<AdminPost | null> {
  const filePath = path.join(adminPostsDir, `${slug}.md`);
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
    .use(rehypePrettyCode, { theme: "github-dark", keepBackground: true })
    .use(rehypeLazyImages)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);

  const rawDate: string =
    data.date instanceof Date
      ? (() => {
          const d = data.date as Date;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })()
      : String(data.date).slice(0, 10);

  return {
    slug,
    title: data.title as string,
    date: rawDate,
    description: (data.description as string) ?? "",
    tags: (data.tags as string[]) ?? [],
    cover: (data.cover as string) ?? undefined,
    category: (data.category as string) ?? "운영 노트",
    contentHtml: result.toString(),
    toc,
  };
}
