/**
 * 서버리스 환경용 인메모리 IP 기반 Rate Limiter
 * - 동일 Lambda 인스턴스 내에서 동작, cold start 시 초기화됨
 * - 개인 블로그 규모의 어뷰징 방지에 적합
 */

const store = new Map<string, { count: number; resetAt: number }>();

/**
 * @param key    구분 키 (e.g. "comments:1.2.3.4")
 * @param limit  windowMs 내 허용 요청 수
 * @param windowMs 윈도우 크기 (밀리초)
 * @returns true = 허용, false = 차단
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // 1% 확률로 만료된 항목 정리 (메모리 누수 방지)
  if (Math.random() < 0.01) {
    for (const [k, v] of store.entries()) {
      if (now > v.resetAt) store.delete(k);
    }
  }

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

export function getIp(req: Request): string {
  const fwd = (req as import("next/server").NextRequest).headers?.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() ?? "unknown";
}
