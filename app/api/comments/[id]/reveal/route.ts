import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase";

// POST /api/comments/:id/reveal  { password }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const { password } = body as { password?: string };

  if (!password) {
    return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("comments")
    .select("content, password_hash")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!data.password_hash) {
    return NextResponse.json({ error: "비밀글이 아닙니다." }, { status: 400 });
  }
  const match = await bcrypt.compare(password, data.password_hash);
  if (!match) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 403 });
  }

  return NextResponse.json({ content: data.content });
}
