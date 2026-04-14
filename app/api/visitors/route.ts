import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { rateLimit, getIp } from "@/lib/rate-limit";

export async function GET() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

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
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase.rpc("increment_visitors");

  if (error) return NextResponse.json({ count: 0, total: 0, today: 0 }, { status: 500 });

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
