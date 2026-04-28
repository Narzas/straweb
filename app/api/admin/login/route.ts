import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { setSessionCookie } from "@/lib/admin-auth";

export async function POST(req: Request) {
  // Rate limit: 같은 IP가 5분에 5번까지만 로그인 시도
  const ip = getIp(req);
  if (!rateLimit(`admin-login:${ip}`, 5, 5 * 60_000)) {
    return NextResponse.json({ ok: false, error: "too many attempts" }, { status: 429 });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const match = await bcrypt.compare(password, hash);
  if (!match) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
