import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 방문자 로그 트래킹 — IP는 해시만, UA는 파싱해서 카테고리만 저장
 * 한국 개인정보보호법 + GDPR 회피용 최소 수집
 */

const HASH_SALT = process.env.IP_HASH_SALT ?? "stragos-fallback-salt-2026";

export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(HASH_SALT + ip)
    .digest("hex")
    .slice(0, 16); // 16 char prefix면 동일성 식별엔 충분
}

const SITE_HOSTS = new Set([
  "stragos.xyz",
  "www.stragos.xyz",
  "localhost",
  "localhost:3000",
]);

/**
 * Referrer URL을 그룹용 호스트명으로 정규화
 * - 빈값 → "(direct)"
 * - 자기 사이트 → "(internal)"
 * - 그 외 → "naver.com" / "google.com" 등 호스트만
 */
export function normalizeReferrer(raw: string | null | undefined): string {
  if (!raw) return "(direct)";
  try {
    const url = new URL(raw);
    if (SITE_HOSTS.has(url.host)) return "(internal)";
    return url.host.replace(/^www\./, "");
  } catch {
    return "(direct)";
  }
}

/**
 * User-Agent 문자열을 browser/os/device 카테고리로 분해
 * 정확도보다 그룹화 가능성 우선 — Chrome/Safari/Firefox/Edge/Samsung 정도 잡으면 충분
 */
export function parseUa(ua: string): {
  browser: string;
  os: string;
  device: string;
} {
  if (!ua) return { browser: "unknown", os: "unknown", device: "unknown" };

  // Browser — 순서 중요: Edge가 Chrome보다 먼저, Samsung이 Chrome보다 먼저
  let browser = "other";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox/.test(ua)) browser = "Firefox";
  else if (/Chrome/.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Safari/.test(ua) && /Mobile/.test(ua)) browser = "Safari";
  else if (/Safari/.test(ua)) browser = "Safari";
  else if (/bot|crawler|spider|crawling/i.test(ua)) browser = "Bot";

  // OS
  let os = "other";
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  // Device
  let device = "desktop";
  if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = "tablet";
  else if (/Mobile|iPhone|Android/.test(ua)) device = "mobile";

  return { browser, os, device };
}

/**
 * Vercel/Cloudflare 헤더에서 국가 코드 추출 (ISO-3166 alpha-2)
 */
export function getCountry(req: Request): string {
  const h = (req as import("next/server").NextRequest).headers;
  return (
    h?.get("x-vercel-ip-country") ??
    h?.get("cf-ipcountry") ??
    h?.get("x-country-code") ??
    "XX"
  );
}

/**
 * visitor_logs 테이블에 best-effort 인서트
 * 실패해도 방문자 카운트는 정상 처리되도록 try/catch로 감쌈
 */
export async function logVisitor(
  supabase: SupabaseClient,
  payload: {
    ip: string;
    ua: string;
    referrer: string | null;
    slug: string | null;
    path: string | null;
    country: string;
  }
): Promise<void> {
  try {
    const { browser, os, device } = parseUa(payload.ua);
    const { error } = await supabase.from("visitor_logs").insert({
      slug: payload.slug,
      path: payload.path,
      referrer: normalizeReferrer(payload.referrer),
      ua_browser: browser,
      ua_os: os,
      ua_device: device,
      country: payload.country,
      ip_hash: hashIp(payload.ip),
    });
    // 23505 = unique_violation (visitor_logs_hourly_dedup_idx) — 같은 IP가 시간당 재방문 시 무시
    if (error && error.code !== "23505") {
      console.warn("[visitor_logs] insert error:", error.message);
    }
  } catch (e) {
    console.warn("[visitor_logs] unexpected error:", e);
  }
}
