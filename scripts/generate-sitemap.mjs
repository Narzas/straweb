import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const postsDir = path.join(root, "posts");
const outputPath = path.join(root, "public", "sitemap.xml");

const SITE_URL = "https://www.stragos.xyz";

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      let val = rest.join(":").trim().replace(/^['"]|['"]$/g, "");
      result[key.trim()] = val;
    }
  }
  return result;
}

function entry(url, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const now = new Date().toISOString().split("T")[0];

const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));
const posts = files.map((f) => {
  const content = fs.readFileSync(path.join(postsDir, f), "utf-8");
  const meta = parseFrontmatter(content);
  return {
    slug: f.replace(/\.md$/, ""),
    date: meta.date ?? now,
    category: meta.category ?? "",
  };
});

const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))];

const urls = [
  entry(SITE_URL,                        now, "weekly",  "1.0"),
  entry(`${SITE_URL}/posts`,             now, "weekly",  "0.8"),
  entry(`${SITE_URL}/about`,             now, "monthly", "0.5"),
  entry(`${SITE_URL}/guestbook`,         now, "monthly", "0.4"),
  ...categories.map((cat) =>
    entry(
      `${SITE_URL}/category/${encodeURIComponent(cat.toLowerCase())}`,
      now, "weekly", "0.6"
    )
  ),
  ...posts.map((post) =>
    entry(
      `${SITE_URL}/posts/${post.slug}`,
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

fs.writeFileSync(outputPath, xml, "utf-8");
console.log(`[sitemap] Generated ${urls.length} URLs → public/sitemap.xml`);
