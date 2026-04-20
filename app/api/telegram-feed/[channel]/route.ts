import { NextResponse } from "next/server";

export const runtime = "edge";

export type TelegramPost = {
  id: string;
  text: string;
  photo: string | null;
  time: string;
  url: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#036;/g, "$")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseTelegram(html: string, channel: string): TelegramPost | null {
  const wrapperRe = /<div[^>]+class="[^"]*tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*tgme_widget_message_wrap|$)/g;
  const blocks: { id: string; block: string }[] = [];
  let m: RegExpExecArray | null;

  const escaped = channel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const idRe = new RegExp(`data-post="${escaped}\\/(\\d+)"`);

  while ((m = wrapperRe.exec(html)) !== null) {
    const idMatch = m[0].match(idRe);
    if (idMatch) blocks.push({ id: idMatch[1], block: m[0] });
  }

  if (!blocks.length) return null;

  blocks.sort((a, b) => Number(b.id) - Number(a.id));

  for (const candidate of blocks) {
    const textMatch = candidate.block.match(
      /<div[^>]+class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    if (!textMatch) continue;

    const text = stripHtml(textMatch[1]).trim();
    if (!text) continue;

    const timeMatch = candidate.block.match(/<time[^>]+datetime="([^"]+)"/);
    const time = timeMatch ? new Date(timeMatch[1]).toISOString() : new Date().toISOString();

    let photo: string | null = null;
    const bgMatch = candidate.block.match(/background-image:url\('(https:\/\/cdn[^']+)'\)/);
    if (bgMatch) {
      photo = bgMatch[1];
    } else {
      const imgMatch = candidate.block.match(/<img[^>]+src="(https:\/\/cdn[^"]+)"/);
      if (imgMatch) photo = imgMatch[1];
    }

    return {
      id: candidate.id,
      text,
      photo,
      time,
      url: `https://t.me/${channel}/${candidate.id}`,
    };
  }

  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ channel: string }> }
) {
  const { channel } = await params;

  const ALLOWED = ["wublockchainkr", "lookonchainchannel", "top7ico"];
  if (!ALLOWED.includes(channel)) {
    return NextResponse.json({ posts: [] }, { status: 400 });
  }

  try {
    const res = await fetch(`https://t.me/s/${channel}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 120 },
    });

    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const html = await res.text();
    const post = parseTelegram(html, channel);

    if (post) {
      return NextResponse.json({ posts: [post] }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (e) {
    console.error(`[telegram-feed/${channel}]`, e);
  }

  return NextResponse.json({ posts: [] }, { headers: { "Cache-Control": "no-store" } });
}
