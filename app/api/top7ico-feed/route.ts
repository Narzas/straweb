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
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseTelegram(html: string): TelegramPost | null {
  // Find all message blocks
  const blockRe = /data-post="top7ico\/(\d+)"[\s\S]*?(?=data-post="top7ico\/\d+"|$)/g;
  const blocks: { id: string; block: string }[] = [];
  let m: RegExpExecArray | null;

  // Split on message wrapper divs
  const wrapperRe = /<div[^>]+class="[^"]*tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*tgme_widget_message_wrap|$)/g;
  while ((m = wrapperRe.exec(html)) !== null) {
    const idMatch = m[0].match(/data-post="top7ico\/(\d+)"/);
    if (idMatch) {
      blocks.push({ id: idMatch[1], block: m[0] });
    }
  }

  if (!blocks.length) {
    // Fallback: simple data-post extraction
    const simpleRe = /data-post="top7ico\/(\d+)"/g;
    const ids: string[] = [];
    while ((m = simpleRe.exec(html)) !== null) {
      ids.push(m[1]);
    }
    if (!ids.length) return null;
    // Use largest id as latest
    const latestId = ids.sort((a, b) => Number(b) - Number(a))[0];
    return {
      id: latestId,
      text: "",
      photo: null,
      time: new Date().toISOString(),
      url: `https://t.me/top7ico/${latestId}`,
    };
  }

  // Sort by id descending, pick latest
  blocks.sort((a, b) => Number(b.id) - Number(a.id));
  const latest = blocks[0];

  // Extract time
  const timeMatch = latest.block.match(/<time[^>]+datetime="([^"]+)"/);
  const time = timeMatch ? new Date(timeMatch[1]).toISOString() : new Date().toISOString();

  // Extract image (background-image:url or <img src> inside photo div)
  let photo: string | null = null;
  const bgMatch = latest.block.match(/background-image:url\('(https:\/\/cdn[^']+)'\)/);
  if (bgMatch) {
    photo = bgMatch[1];
  } else {
    const imgMatch = latest.block.match(/<img[^>]+src="(https:\/\/cdn[^"]+)"/);
    if (imgMatch) photo = imgMatch[1];
  }

  // Extract text
  let text = "";
  const textMatch = latest.block.match(/<div[^>]+class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  if (textMatch) {
    text = stripHtml(textMatch[1])
      .replace(/Top 7 Ecosystem:.*$/m, "")
      .trim();
  }

  return {
    id: latest.id,
    text,
    photo,
    time,
    url: `https://t.me/top7ico/${latest.id}`,
  };
}

async function translateToKorean(text: string): Promise<string> {
  if (!text.trim()) return text;
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return text;
  try {
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `DeepL-Auth-Key ${apiKey}` },
      body: JSON.stringify({ text: [text], target_lang: "KO" }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.translations?.[0]?.text || text;
  } catch {
    return text;
  }
}

export async function GET() {
  try {
    const res = await fetch("https://t.me/s/top7ico", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const html = await res.text();
    const post = parseTelegram(html);

    if (post) {
      if (post.text) post.text = await translateToKorean(post.text);
      return NextResponse.json({ posts: [post] }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (e) {
    console.error("[top7ico-feed]", e);
  }

  return NextResponse.json({ posts: [] }, { headers: { "Cache-Control": "no-store" } });
}
