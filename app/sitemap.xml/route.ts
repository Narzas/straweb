import { getAllPosts, getAllCategories } from "@/lib/posts";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

function entry(
  url: string,
  lastmod: string,
  changefreq: string,
  priority: string
) {
  return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function GET() {
  const posts = getAllPosts();
  const categories = getAllCategories();
  const now = new Date().toISOString().split("T")[0];

  const urls: string[] = [
    entry(siteConfig.url,              now, "weekly",  "1.0"),
    entry(`${siteConfig.url}/posts`,   now, "weekly",  "0.8"),
    entry(`${siteConfig.url}/about`,   now, "monthly", "0.5"),
    entry(`${siteConfig.url}/guestbook`, now, "monthly", "0.4"),
    ...categories.map(({ name }) =>
      entry(
        `${siteConfig.url}/category/${encodeURIComponent(name.toLowerCase())}`,
        now, "weekly", "0.6"
      )
    ),
    ...posts.map((post) =>
      entry(
        `${siteConfig.url}/posts/${post.slug}`,
        new Date(post.date).toISOString().split("T")[0],
        "monthly",
        "0.7"
      )
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
