import { getAllPosts, getPostBySlug } from "@/lib/posts";
import { siteConfig } from "@/lib/site";

export const revalidate = 3600;

function escape(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const posts = getAllPosts();

  const fullPosts = await Promise.all(
    posts.map((p) => getPostBySlug(p.slug))
  );

  const items = fullPosts
    .map((post) => {
      if (!post) return "";
      return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteConfig.url}/posts/${post.slug}</link>
      <guid isPermaLink="true">${siteConfig.url}/posts/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.description}]]></description>
      <content:encoded><![CDATA[${post.contentHtml}]]></content:encoded>
      <category><![CDATA[${post.category}]]></category>
      ${post.tags.map((t) => `<category><![CDATA[${t}]]></category>`).join("\n      ")}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escape(siteConfig.name)}</title>
    <link>${siteConfig.url}</link>
    <description>${escape(siteConfig.description)}</description>
    <language>ko</language>
    <managingEditor>${escape(siteConfig.author)}</managingEditor>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteConfig.url}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
