import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

let fontCache: ArrayBuffer[] | null = null;

async function getKoreanFont(): Promise<ArrayBuffer[]> {
  if (fontCache) return fontCache;
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700",
      {
        headers: {
          // IE11 UA → Google serves WOFF (not WOFF2), which Satori supports
          "User-Agent":
            "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; Touch; rv:11.0) like Gecko",
        },
      }
    ).then((r) => r.text());

    const urls = [
      ...css.matchAll(/src: url\(([^)]+)\) format\('woff'\)/g),
    ].map((m) => m[1]);

    if (!urls.length) return [];

    fontCache = await Promise.all(
      urls.map((url) => fetch(url).then((r) => r.arrayBuffer()))
    );
    return fontCache;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") ?? "StraWeb";
  const category = searchParams.get("category") ?? "";
  const date = searchParams.get("date") ?? "";

  const fontDatas = await getKoreanFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          padding: "60px 72px",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        {/* 상단: 블로그명 */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              borderRadius: "12px",
              padding: "8px 16px",
              fontSize: "20px",
              fontWeight: 700,
              color: "white",
            }}
          >
            StraWeb
          </div>
          {category && (
            <div
              style={{
                background: "rgba(99,102,241,0.2)",
                border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: "999px",
                padding: "6px 14px",
                fontSize: "16px",
                color: "#a5b4fc",
                fontWeight: 600,
              }}
            >
              {category}
            </div>
          )}
        </div>

        {/* 중앙: 제목 */}
        <div
          style={{
            fontSize: title.length > 30 ? "48px" : "60px",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            maxWidth: "960px",
          }}
        >
          {title}
        </div>

        {/* 하단: 날짜 + 장식 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "18px", color: "#64748b" }}>{date}</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["#6366f1", "#a855f7", "#ec4899"].map((color, i) => (
              <div
                key={i}
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: color,
                  opacity: 1 - i * 0.25,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fontDatas.map((data) => ({
        name: "Noto Sans KR",
        data,
        style: "normal" as const,
        weight: 700 as const,
      })),
      headers: {
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
