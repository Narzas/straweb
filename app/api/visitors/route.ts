import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

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

export async function POST() {
  const supabase = createServiceClient();

  // upsert — id=1 행이 없으면 생성, 있으면 +1
  const { data, error } = await supabase.rpc("increment_visitors");

  if (error) return NextResponse.json({ count: 0 }, { status: 500 });
  return NextResponse.json({ count: data ?? 0 });
}
