import { NextResponse } from "next/server";

const CHANNEL = "korean_alpha_TG";

export type TelegramMessage = {
  id: string;
  text: string;
  photo: string | null;
  time: string;
};

function parseMessages(html: string): TelegramMessage[] {
  const results: TelegramMessage[] = [];

  // 각 메시지 블록을 data-post 기준으로 분리
  const blocks = html.split(/(?=<div class="tgme_widget_message\s)/);

  for (const block of blocks) {
    const idMatch = block.match(/data-post="[^/]+\/(\d+)"/);
    if (!idMatch) continue;
    const id = idMatch[1];

    // 사진 URL — background-image:url('...')
    const photoMatch = block.match(/background-image:url\('([^']+)'\)/);
    const photo = photoMatch?.[1] ?? null;

    // 텍스트 — .tgme_widget_message_text 내부
    const textMatch = block.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    const text = textMatch
      ? textMatch[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&nbsp;/g, " ")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
          .trim()
      : "";

    // 시간
    const timeMatch = block.match(/datetime="([^"]+)"/);
    const time = timeMatch?.[1] ?? "";

    if (text || photo) {
      results.push({ id, text, photo, time });
    }
  }

  return results;
}

export async function GET() {
  try {
    const res = await fetch(`https://t.me/s/${CHANNEL}`, {
      next: { revalidate: 60 },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });

    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const html = await res.text();

    const all = parseMessages(html);
    const latest = all.slice(-1).reverse(); // 최신 1개

    return NextResponse.json(
      { messages: latest },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch (e) {
    console.error("[telegram]", e);
    return NextResponse.json({ messages: [] }, { status: 500 });
  }
}
