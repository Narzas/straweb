import { NextResponse } from "next/server";

type NewsItem = { title: string; link: string; source: string };

const CATEGORIES = [
  { key: "headlines", label: "헤드라인", url: "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko" },
  { key: "business",  label: "경제",     url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko" },
  { key: "tech",      label: "IT",       url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko" },
  { key: "sports",    label: "스포츠",   url: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=ko&gl=KR&ceid=KR:ko" },
];

function parseItems(xml: string, limit = 4): NewsItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .slice(0, limit)
    .map((m) => {
      const block = m[1];
      const rawTitle =
        block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
        block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
      const source =
        block.match(/<source[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/source>/)?.[1] ??
        block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "";
      const title = source
        ? rawTitle.replace(new RegExp(`\\s*-\\s*${source}\\s*$`), "").trim()
        : rawTitle.trim();
      const link =
        block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
      return { title, link, source };
    })
    .filter((item) => item.title);
}

export async function GET() {
  try {
    const settled = await Promise.allSettled(
      CATEGORIES.map(async ({ key, label, url }) => {
        const res = await fetch(url, { next: { revalidate: 600 } });
        if (!res.ok) throw new Error(`fetch failed for ${key}`);
        const xml = await res.text();
        return { key, label, items: parseItems(xml) };
      })
    );

    const categories = settled
      .filter((r): r is PromiseFulfilledResult<{ key: string; label: string; items: NewsItem[] }> =>
        r.status === "fulfilled"
      )
      .map((r) => r.value);

    if (categories.length === 0) {
      return NextResponse.json({ error: "fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { categories },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
