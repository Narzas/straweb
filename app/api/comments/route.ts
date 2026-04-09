import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase";
import type { PublicComment } from "@/lib/comments";

// GET /api/comments?slug=...
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_slug, author, content, is_secret, created_at")
    .eq("post_slug", slug)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 비밀글은 내용을 가림
  const comments: PublicComment[] = (data ?? []).map((c) => ({
    ...c,
    content: c.is_secret ? "🔒 비밀 댓글입니다." : c.content,
  }));

  return NextResponse.json(comments);
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { post_slug, author, content, is_secret, password } = body;

  if (!post_slug || !author?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "필수 항목을 입력해 주세요." }, { status: 400 });
  }
  if (is_secret && !password?.trim()) {
    return NextResponse.json({ error: "비밀글은 비밀번호가 필요합니다." }, { status: 400 });
  }

  const password_hash = is_secret ? await bcrypt.hash(password, 10) : null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_slug,
      author: author.trim(),
      content: content.trim(),
      is_secret: !!is_secret,
      password_hash,
    })
    .select("id, post_slug, author, content, is_secret, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
