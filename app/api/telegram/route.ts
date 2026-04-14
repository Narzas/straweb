import { NextResponse } from "next/server";

const CHANNEL = "korean_alpha_TG";

// 마지막 성공한 결과를 메모리에 보관 — t.me 일시 차단 시에도 데이터 유지
let lastGood: TelegramMessage[] = [];
let lastFetchAt = 0;
const CACHE_TTL = 55_000; // 55초

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

    // 사진 URL — 메시지 사진 래퍼에서만 추출 (아바타/프로필 사진 제외)
    const photoWrapMatch = block.match(/tgme_widget_message_photo_wrap[^>]*style="[^"]*background-image:url\('([^']+)'\)/);
    const photo = photoWrapMatch?.[1] ?? null;

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
  const now = Date.now();

  // 캐시가 신선하면 바로 반환
  if (lastGood.length && now - lastFetchAt < CACHE_TTL) {
    return NextResponse.json({ messages: lastGood });
  }

  try {
    const res = await fetch(`https://t.me/s/${CHANNEL}`, {
      next: { revalidate: 55 }, // Next.js 데이터 캐시 — 서버리스 콜드 스타트에서도 유지됨
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

    if (latest.length) {
      lastGood = latest;
      lastFetchAt = now;
    }
  } catch (e) {
    console.error("[telegram]", e);
    // 실패해도 마지막 성공 데이터 반환
  }

  return NextResponse.json(
    { messages: lastGood },
    { headers: { "Cache-Control": "no-store" } }
  );
}
