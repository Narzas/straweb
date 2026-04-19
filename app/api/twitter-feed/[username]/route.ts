import { NextResponse } from "next/server";

export const runtime = "edge";

export type TwitterPost = {
  id: string;
  text: string;
  photo: string | null;
  time: string;
  url: string;
};

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
  note_tweet?: { note_tweet_results?: { result?: { text?: string } } };
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
  const candidates: TwitterPost[] = [];

  for (const entry of entries) {
    if (entry.type !== "tweet") continue;
    const t = entry.content?.tweet;
    if (!t) continue;

    const raw = t.note_tweet?.note_tweet_results?.result?.text ?? t.full_text ?? t.text ?? "";
    if (raw.startsWith("RT @")) continue;
    if (t.in_reply_to_screen_name) continue;

    const urls: TwitterUrl[] = t.entities?.urls ?? [];
    const text = expandUrls(raw, urls).replace(/\s+/g, " ").trim();
    if (!text || /^source:\s*https?:\/\//i.test(text)) continue;

    const media: TwitterMedia[] = t.extended_entities?.media ?? t.entities?.media ?? [];
    const photo = media.find((m) => m.type === "photo")?.media_url_https ?? null;
    const time = t.created_at ? new Date(t.created_at).toISOString() : "";

    candidates.push({ id: t.id_str, text, photo, time, url: `https://x.com/${username}/status/${t.id_str}` });
  }

  candidates.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return candidates[0] ? [candidates[0]] : [];
}

async function translateToKorean(text: string): Promise<string> {
  if (!text.trim()) return text;
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return text;
  try {
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `DeepL-Auth-Key ${apiKey}` },
      body: JSON.stringify({ text: [text], source_lang: "EN", target_lang: "KO" }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.translations?.[0]?.text || text;
  } catch {
    return text;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`;
    const res = await fetch(syndicationUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 180 },
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
      return NextResponse.json({ posts: translated });
    }
  } catch (e) {
    console.error(`[twitter-feed/${username}]`, e);
  }

  return NextResponse.json({ posts: [] });
}
