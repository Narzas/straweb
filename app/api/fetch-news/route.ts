import { NextRequest, NextResponse } from "next/server";

async function translateToKorean(text: string): Promise<string> {
  if (!text?.trim()) return text;
  // 문장 단위로 자른 뒤 ~1500자 청크로 묶어 순차 번역 (문장 중간 절단 방지)
  const sentences = text.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length + s.length > 1500) {
      if (cur) chunks.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());

  const results: string[] = [];
  for (const chunk of chunks) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) { results.push(chunk); continue; }
      const data = await res.json();
      results.push((data[0] as [string][]).map((seg) => seg[0]).join("") || chunk);
    } catch {
      results.push(chunk);
    }
  }
  return results.join("\n\n");
}

export async function GET(req: NextRequest) {
  const articleUrl = req.nextUrl.searchParams.get("url");
  const articleTitle = req.nextUrl.searchParams.get("title") ?? "";
  if (!articleUrl) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const jinaRes = await fetch(`https://r.jina.ai/${articleUrl}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
        "X-Target-Selector": "article",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!jinaRes.ok) throw new Error("jina failed");

    let raw = await jinaRes.text();

    raw = raw
      // 메타 헤더 줄 제거
      .replace(/^(Title:|URL Source:|Published Time:|Warning:).+$/gm, "")
      // 이미지 마크다운 제거
      .replace(/!\[.*?\]\(.*?\)/g, "")
      // Related/Magazine 블록 줄 제거
      .replace(/^_\*\*(Related|Magazine):?\*\*_.+$/gm, "")
      // 섹션 헤더 제거
      .replace(/^#+\s.+$/gm, "")
      // 바이라인·편집자 줄 제거
      .replace(/^By\s+.+$/gm, "")
      .replace(/^Edited by\s+.+$/gm, "")
      .replace(/^.+\s*\|\s*(CoinTelegraph|CT).*/gim, "")
      // 인라인 링크 → 텍스트만 유지
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // 볼드·이탤릭 마크다운 제거
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // 팟캐스트·소셜·뉴스레터·푸터 이후 내용 제거
      .replace(/Explore more articles[\s\S]*/i, "")
      .replace(/Cointelegraph is committed[\s\S]*/i, "")
      .replace(/Follow us[\s\S]*/i, "")
      .replace(/Social feed[\s\S]*/i, "")
      .replace(/Listen\s*\n[\s\S]*?0:\d\d[\s\S]*/i, "")
      // 팟캐스트 타임코드 줄 제거 (0:00 형태)
      .replace(/^\d+:\d{2}.*$/gm, "")
      // 빈 줄 정리
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // 본문 앞에 기사 제목이 중복 삽입된 경우 제거
    if (articleTitle) {
      const titleEsc = articleTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      raw = raw.replace(new RegExp(`^${titleEsc}\\s*`, "i"), "").trim();
    }

    // 최대 3000자 번역 (단락 청킹으로 품질 향상)
    const snippet = raw.slice(0, 3000);
    const translated = await translateToKorean(snippet);

    return NextResponse.json({ content: translated });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
