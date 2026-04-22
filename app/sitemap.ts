import type { MetadataRoute } from "next";
import { getAllPosts, getAllCategories, getAllTags } from "@/lib/posts";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const posts = getAllPosts();
  const categories = getAllCategories();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date("2026-04-20"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/posts`,
      lastModified: new Date("2026-04-20"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/about`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/guestbook`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/contact`,
      lastModified: new Date("2026-01-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/search`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/crypto`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
  ];

  const tags = getAllTags();

  // 카테고리/태그는 최신 포스트 날짜 기준
  const latestPostDate = posts[0] ? new Date(posts[0].date) : new Date("2026-04-01");

  const categoryRoutes: MetadataRoute.Sitemap = categories.map(({ name }) => ({
    url: `${base}/category/${encodeURIComponent(name.toLowerCase())}`,
    lastModified: latestPostDate,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const tagRoutes: MetadataRoute.Sitemap = tags.map(({ name }) => ({
    url: `${base}/tag/${encodeURIComponent(name.toLowerCase())}`,
    lastModified: latestPostDate,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/posts/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...tagRoutes, ...postRoutes];
}
