import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

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
