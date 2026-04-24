import { createServiceClient } from "@/lib/supabase";

export interface FuturesOverallStats {
  totalSignals: number;
  hitRate: number;       // 24h 기준 +5% 이상 도달 비율 (%)
  avgReturn24h: number;  // 평균 24h 수익률 (%)
  maxReturn24h: number;  // 최고 24h 수익률 (%)
  daysCovered: number;   // 데이터 수집 기간 (일)
  isMock: boolean;
}

export interface FuturesCoinStats {
  count: number;
  hitRate: number;
  avgReturn24h: number;
  maxReturn24h: number;
  lastSignalHoursAgo: number;
}

export interface FuturesStats {
  overall: FuturesOverallStats;
  byCoin: Record<string, FuturesCoinStats>;
}

const HIT_THRESHOLD = 5; // % 이상 = 적중
const LOOKBACK_DAYS = 7;
const MIN_REAL_SIGNALS = 500; // 미만이면 mock (통계 오차 ±4% 수준)

function pct(curr: number, entry: number): number {
  if (!entry) return 0;
  return ((curr - entry) / entry) * 100;
}

function makeMock(): FuturesStats {
  const symbols = ["PEPE", "DOGE", "WIF", "BONK", "SUI", "ARB", "OP", "INJ", "TAO", "FET"];
  const byCoin: Record<string, FuturesCoinStats> = {};
  for (const s of symbols) {
    byCoin[s] = {
      count: 4 + Math.floor(Math.random() * 8),
      hitRate: 50 + Math.floor(Math.random() * 30),
      avgReturn24h: 4 + Math.random() * 10,
      maxReturn24h: 15 + Math.random() * 35,
      lastSignalHoursAgo: Math.floor(Math.random() * 72),
    };
  }
  return {
    overall: {
      totalSignals: 128,
      hitRate: 64,
      avgReturn24h: 8.2,
      maxReturn24h: 47.3,
      daysCovered: 7,
      isMock: true,
    },
    byCoin,
  };
}

export async function getFuturesStats(): Promise<FuturesStats> {
  try {
    const sb = createServiceClient();
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
    const { data, error } = await sb
      .from("futures_signals")
      .select("symbol, recorded_at, entry_price, price_24h")
      .gte("recorded_at", since)
      .not("price_24h", "is", null);

    if (error || !data || data.length < MIN_REAL_SIGNALS) {
      return makeMock();
    }

    // 전체 통계
    const returns = data
      .map((r: { entry_price: number; price_24h: number }) => pct(r.price_24h, r.entry_price))
      .filter((v: number) => Number.isFinite(v));
    const hits = returns.filter((r: number) => r >= HIT_THRESHOLD).length;
    const avg = returns.reduce((a: number, b: number) => a + b, 0) / (returns.length || 1);
    const max = Math.max(...returns, 0);

    // 코인별 통계
    const bySymbol = new Map<
      string,
      { rets: number[]; lastAt: number }
    >();
    const now = Date.now();
    for (const row of data as Array<{
      symbol: string;
      recorded_at: string;
      entry_price: number;
      price_24h: number;
    }>) {
      const r = pct(row.price_24h, row.entry_price);
      if (!Number.isFinite(r)) continue;
      const s = row.symbol.toUpperCase();
      const prev = bySymbol.get(s);
      const ts = new Date(row.recorded_at).getTime();
      if (prev) {
        prev.rets.push(r);
        if (ts > prev.lastAt) prev.lastAt = ts;
      } else {
        bySymbol.set(s, { rets: [r], lastAt: ts });
      }
    }

    const byCoin: Record<string, FuturesCoinStats> = {};
    for (const [sym, { rets, lastAt }] of bySymbol) {
      const hitsC = rets.filter((r) => r >= HIT_THRESHOLD).length;
      byCoin[sym] = {
        count: rets.length,
        hitRate: (hitsC / rets.length) * 100,
        avgReturn24h: rets.reduce((a, b) => a + b, 0) / rets.length,
        maxReturn24h: Math.max(...rets),
        lastSignalHoursAgo: Math.round((now - lastAt) / 3600_000),
      };
    }

    return {
      overall: {
        totalSignals: data.length,
        hitRate: (hits / returns.length) * 100,
        avgReturn24h: avg,
        maxReturn24h: max,
        daysCovered: LOOKBACK_DAYS,
        isMock: false,
      },
      byCoin,
    };
  } catch {
    return makeMock();
  }
}
