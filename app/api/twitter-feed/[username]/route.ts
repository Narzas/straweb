import { NextResponse } from "next/server";

const CACHE_TTL = 180_000;    // 3분마다 트위터 실제 호출
const RETRY_BACKOFF = 300_000; // 429 등 실패 시 5분 대기

export type TwitterPost = {
  id: string;
  text: string;
  photo: string | null;
  time: string;
  url: string;
};

interface CacheEntry {
  posts: TwitterPost[];
  fetchedAt: number;
  attemptedAt: number;
}

// 계정별 독립 캐시
const cache = new Map<string, CacheEntry>();

function getCache(username: string): CacheEntry {
  return cache.get(username) ?? { posts: [], fetchedAt: 0, attemptedAt: 0 };
}

function expandUrls(text: string, urls: { url: string; expanded_url: string }[]): string {
  let out = text;
  for (const u of urls) out = out.replace(u.url, u.expanded_url);
  return out
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .replace(/https?:\/\/pic\.x\.com\/\S+/g, "")
    .trim();
}

interface TwitterMedia { type: string; media_url_https: string; }
interface TwitterUrl { url: string; expanded_url: string; }
interface TwitterTweet {
  id_str: string;
  full_text?: string;
  text?: string;
  created_at: string;
  in_reply_to_screen_name?: string | null;
  extended_entities?: { media?: TwitterMedia[] };
  entities?: { urls?: TwitterUrl[]; media?: TwitterMedia[] };
}
interface TimelineEntry {
  type: string;
  content?: { tweet?: TwitterTweet };
}

function parseSyndication(html: string, username: string): TwitterPost[] {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return [];

  const data = JSON.parse(m[1]);
  const entries: TimelineEntry[] = data?.props?.pageProps?.timeline?.entries ?? [];
  const results: TwitterPost[] = [];

  const candidates: TwitterPost[] = [];

  for (const entry of entries) {
    if (entry.type !== "tweet") continue;
    const t = entry.content?.tweet;
    if (!t) continue;

    const raw = t.full_text ?? t.text ?? "";
    if (raw.startsWith("RT @")) continue;
    if (t.in_reply_to_screen_name && t.in_reply_to_screen_name !== username) continue;

    const urls: TwitterUrl[] = t.entities?.urls ?? [];
    const text = expandUrls(raw, urls).replace(/\s+/g, " ").trim();
    if (!text || /^source:\s*https?:\/\//i.test(text)) continue;

    const media: TwitterMedia[] = t.extended_entities?.media ?? t.entities?.media ?? [];
    const photo = media.find((m) => m.type === "photo")?.media_url_https ?? null;
    const time = t.created_at ? new Date(t.created_at).toISOString() : "";
    const url = `https://x.com/${username}/status/${t.id_str}`;

    candidates.push({ id: t.id_str, text, photo, time, url });
  }

  // 핀 고정 트윗 무시 — snowflake ID 내림차순으로 실제 최신 글 1개 선택
  candidates.sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1));
  if (candidates[0]) results.push(candidates[0]);

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const now = Date.now();
  const entry = getCache(username);

  if (entry.posts.length && now - entry.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ posts: entry.posts });
  }

  if (now - entry.attemptedAt < RETRY_BACKOFF) {
    return NextResponse.json({ posts: entry.posts }, { headers: { "Cache-Control": "no-store" } });
  }

  cache.set(username, { ...entry, attemptedAt: now });

  try {
    const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`;
    const res = await fetch(syndicationUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const html = await res.text();
    const latest = parseSyndication(html, username);

    if (latest.length) {
      const translated = await Promise.all(
        latest.map(async (post) => ({
          ...post,
          text: post.text ? await translateToKorean(post.text) : post.text,
        }))
      );
      cache.set(username, { posts: translated, fetchedAt: now, attemptedAt: now });
    }
  } catch (e) {
    console.error(`[twitter-feed/${username}]`, e);
  }

  return NextResponse.json(
    { posts: getCache(username).posts },
    { headers: { "Cache-Control": "no-store" } }
  );
}
