import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

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
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("increment_post_views", {
    post_slug: slug,
  });

  if (error) return NextResponse.json({ count: 0 }, { status: 500 });
  return NextResponse.json({ count: data ?? 0 });
}
