import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { logVisitor, getCountry } from "@/lib/visitor-tracking";

export async function GET() {
  const supabase = createServiceClient();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [statsRes, dailyRes] = await Promise.all([
    supabase.from("site_stats").select("visitor_count").eq("id", 1).single(),
    supabase.from("daily_visitors").select("count").eq("date", today).single(),
  ]);

  return NextResponse.json(
    {
      total: statsRes.data?.visitor_count ?? 0,
      today: dailyRes.data?.count ?? 0,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
  );
}

export async function POST(req: Request) {
  // Rate limit: IP당 1시간에 1회 (방문자 카운터 어뷰징 방지)
  const ip = getIp(req);
  if (!rateLimit(`visitors:${ip}`, 1, 60 * 60_000)) {
    // 차단이지만 에러처럼 보이면 안됨 — 조용히 무시
    return NextResponse.json({ count: 0, total: 0, today: 0 });
  }

  const supabase = createServiceClient();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data, error } = await supabase.rpc("increment_visitors");

  if (error) return NextResponse.json({ count: 0, total: 0, today: 0 }, { status: 500 });

  // visitor_logs 적재 (best-effort) — 첫 진입 1회만 기록되므로 유입 경로 추적용
  let referrer: string | null = null;
  let path: string | null = null;
  try {
    const body = await req.json();
    referrer = typeof body?.referrer === "string" ? body.referrer : null;
    path = typeof body?.path === "string" ? body.path : null;
  } catch {
    referrer = req.headers.get("referer");
  }
  void logVisitor(supabase, {
    ip,
    ua: req.headers.get("user-agent") ?? "",
    referrer,
    slug: null,
    path,
    country: getCountry(req),
  });

  const [statsRes, dailyRes] = await Promise.all([
    supabase.from("site_stats").select("visitor_count").eq("id", 1).single(),
    supabase.from("daily_visitors").select("count").eq("date", today).single(),
  ]);

  return NextResponse.json({
    count: data ?? 0,
    total: statsRes.data?.visitor_count ?? 0,
    today: dailyRes.data?.count ?? 0,
  });
}
