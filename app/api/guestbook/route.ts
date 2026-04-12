import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const BLOCKED = [
  // 욕설
  "씨발","시발","ㅅㅂ","개새끼","개색끼","새끼","놈","년","미친","미친놈","미친년",
  "병신","ㅂㅅ","지랄","꺼져","죽어","죽어라","뒤져","뒤져라","꼴통","찐따","바보",
  "멍청","등신","존나","좆","좆같","ㅈ같","개좆","개년","개놈","개씨","쓰레기",
  "창녀","보지","자지","섹스","섹쓰","성교","강간","윤간","변태",
  // 야한 단어
  "야동","야설","포르노","porn","sex","섹","av","ㅅㅔㄱ스",
  "가슴","음란","음부","항문","페니스","클리토","오르가","자위","딸딸","떡",
];

function containsBlocked(text: string): boolean {
  const lower = text.toLowerCase().replace(/\s/g, "");
  return BLOCKED.some((w) => lower.includes(w.toLowerCase()));
}

function maskIp(ip: string | null): string {
  if (!ip) return "xxx";
  const parts = ip.split(".");
  if (parts.length !== 4) return "xxx";
  return `${parts[0]}.*.*.${parts[3]}`;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("guestbook")
    .select("id, author, message, created_at, ip")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const masked = (data ?? []).map((row) => ({
    ...row,
    ip: maskIp(row.ip),
  }));

  return NextResponse.json(masked, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
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
  if (containsBlocked(author) || containsBlocked(message)) {
    return NextResponse.json({ error: "부적절한 표현이 포함되어 있습니다." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("guestbook")
    .insert({ author, message, ip })
    .select("id, author, message, created_at, ip")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...data, ip: maskIp(data.ip) }, { status: 201 });
}
