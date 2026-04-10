import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("guestbook")
    .select("id, author, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const author = body.author?.trim();
  const message = body.message?.trim();

  if (!author || !message) {
    return NextResponse.json({ error: "이름과 내용을 입력해 주세요." }, { status: 400 });
  }
  if (author.length > 20) {
    return NextResponse.json({ error: "이름은 20자 이하로 입력해 주세요." }, { status: 400 });
  }
  if (message.length > 200) {
    return NextResponse.json({ error: "내용은 200자 이하로 입력해 주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("guestbook")
    .insert({ author, message })
    .select("id, author, message, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
