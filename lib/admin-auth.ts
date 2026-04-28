import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET not set");
  return secret;
}

/**
 * 쿠키 값 형식: "{expiresAt}.{HMAC(secret, expiresAt + 'admin')}"
 * JWT 라이브러리 없이 HMAC 서명만으로 변조 방지
 */
export function signSession(expiresAt: number): string {
  const sig = createHmac("sha256", getSecret())
    .update(`${expiresAt}.admin`)
    .digest("hex");
  return `${expiresAt}.${sig}`;
}

export function verifySession(value: string | undefined): boolean {
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  if (!expStr || !sig) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = createHmac("sha256", getSecret())
    .update(`${exp}.admin`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function isAuthed(): Promise<boolean> {
  const c = await cookies();
  return verifySession(c.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const c = await cookies();
  c.set(COOKIE_NAME, signSession(expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
