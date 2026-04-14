import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit, getIp } from "@/lib/rate-limit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("post_views")
    .select("view_count")
    .eq("slug", slug)
    .single();

  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: data?.view_count ?? 0 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Rate limit: IP당 슬러그별 10분에 3회
  const ip = getIp(req);
  const { slug } = await params;
  if (!rateLimit(`views:${ip}:${slug}`, 3, 10 * 60_000)) {
    return NextResponse.json({ count: 0 }, { status: 429 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("increment_post_views", {
    post_slug: slug,
  });

  if (error) return NextResponse.json({ count: 0 }, { status: 500 });
  return NextResponse.json({ count: data ?? 0 });
}
