import { NextResponse } from "next/server";

const SYNDICATION_URL =
  "https://syndication.twitter.com/srv/timeline-profile/screen-name/WuBlockchain";

const CACHE_TTL = 180_000;    // 트위터 실제 호출: 3분에 1번
const RETRY_BACKOFF = 300_000; // 429 등 실패 시 5분 대기
const POST_COUNT = 1;

export type WuPost = {
  id: string;
  text: string;
  photo: string | null;
  time: string;
  url: string;
};

let lastGood: WuPost[] = [];
let lastFetchAt = 0;
let lastAttemptAt = 0;

function expandUrls(text: string, urls: { url: string; expanded_url: string }[]): string {
  let out = text;
  for (const u of urls) {
    out = out.replace(u.url, u.expanded_url);
  }
  // t.co 단축 URL 및 pic.x.com 링크 제거
  out = out.replace(/https?:\/\/t\.co\/\S+/g, "").replace(/https?:\/\/pic\.x\.com\/\S+/g, "").trim();
  return out;
}

interface TwitterMedia {
  type: string;
  media_url_https: string;
}

interface TwitterUrl {
  url: string;
  expanded_url: string;
}

interface TwitterTweet {
  id_str: string;
  full_text?: string;
  text?: string;
  created_at: string;
  conversation_id_str?: string;
  in_reply_to_screen_name?: string | null;
  extended_entities?: { media?: TwitterMedia[] };
  entities?: { urls?: TwitterUrl[]; media?: TwitterMedia[] };
}

interface TimelineEntry {
  type: string;
  content?: { tweet?: TwitterTweet };
}

function parseSyndication(html: string): WuPost[] {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return [];

  const data = JSON.parse(m[1]);
  const entries: TimelineEntry[] = data?.props?.pageProps?.timeline?.entries ?? [];
  const results: WuPost[] = [];

  for (const entry of entries) {
    if (entry.type !== "tweet") continue;
    const t = entry.content?.tweet;
    if (!t) continue;

    const raw = t.full_text ?? t.text ?? "";

    // 리트윗 및 타 계정 멘션 답글 제외
    if (raw.startsWith("RT @")) continue;
    if (t.in_reply_to_screen_name && t.in_reply_to_screen_name !== "WuBlockchain") continue;

    const urls: TwitterUrl[] = t.entities?.urls ?? [];
    const text = expandUrls(raw, urls).replace(/\s+/g, " ").trim();

    // "Source: URL" 만 있는 트윗 제외
    if (!text || /^source:\s*https?:\/\//i.test(text)) continue;

    // 이미지
    const media: TwitterMedia[] = t.extended_entities?.media ?? t.entities?.media ?? [];
    const photo = media.find((m) => m.type === "photo")?.media_url_https ?? null;

    const time = t.created_at ? new Date(t.created_at).toISOString() : "";
    const url = `https://x.com/WuBlockchain/status/${t.id_str}`;

    results.push({ id: t.id_str, text, photo, time, url });
    if (results.length >= POST_COUNT) break;
  }

  return results;
}

async function translateToKorean(text: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return text;
    const data = await res.json();
    return (data[0] as [string, string][]).map((seg) => seg[0]).join("") || text;
  } catch {
    return text;
  }
}

export async function GET() {
  const now = Date.now();

  if (lastGood.length && now - lastFetchAt < CACHE_TTL) {
    return NextResponse.json({ posts: lastGood });
  }

  // 실패 직후 반복 요청 방지 (2분 backoff)
  if (now - lastAttemptAt < RETRY_BACKOFF) {
    return NextResponse.json({ posts: lastGood }, { headers: { "Cache-Control": "no-store" } });
  }
  lastAttemptAt = now;

  try {
    const res = await fetch(SYNDICATION_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 55 },
    });

    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const html = await res.text();
    const latest = parseSyndication(html);

    if (latest.length) {
      const translated = await Promise.all(
        latest.map(async (post) => ({
          ...post,
          text: post.text ? await translateToKorean(post.text) : post.text,
        }))
      );
      lastGood = translated;
      lastFetchAt = now;
    }
  } catch (e) {
    console.error("[wublockchain]", e);
  }

  return NextResponse.json(
    { posts: lastGood },
    { headers: { "Cache-Control": "no-store" } }
  );
}
