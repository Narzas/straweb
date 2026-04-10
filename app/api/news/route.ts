import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
      { next: { revalidate: 600 } }
    );
    const xml = await res.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 5)
      .map((m) => {
        const block = m[1];

        const rawTitle =
          block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
          block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ??
          "";

        const source =
          block.match(/<source[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/source>/)?.[1] ??
          block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ??
          "";

        // 제목 끝에 " - 출처명" 패턴 제거
        const title = source
          ? rawTitle.replace(new RegExp(`\\s*-\\s*${source}\\s*$`), "").trim()
          : rawTitle.trim();

        const link =
          block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";

        return { title, link, source };
      })
      .filter((item) => item.title);

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
