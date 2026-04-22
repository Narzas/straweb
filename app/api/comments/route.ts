import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit, getIp } from "@/lib/rate-limit";
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
  // Rate limit: IP당 1분에 5개
  const ip = getIp(req);
  if (!rateLimit(`comments:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const post_slug = body.post_slug as string | undefined;
  const author    = body.author    as string | undefined;
  const content   = body.content   as string | undefined;
  const is_secret = body.is_secret as boolean | undefined;
  const password  = body.password  as string | undefined;

  if (!post_slug || !author?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "필수 항목을 입력해 주세요." }, { status: 400 });
  }
  if (author.trim().length > 30) {
    return NextResponse.json({ error: "이름은 30자 이하로 입력해 주세요." }, { status: 400 });
  }
  if (content.trim().length > 1000) {
    return NextResponse.json({ error: "댓글은 1000자 이하로 입력해 주세요." }, { status: 400 });
  }
  if (is_secret && !password?.trim()) {
    return NextResponse.json({ error: "비밀글은 비밀번호가 필요합니다." }, { status: 400 });
  }

  const password_hash = is_secret ? await bcrypt.hash(password as string, 10) : null;

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
    return NextResponse.json({ error: "댓글 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
