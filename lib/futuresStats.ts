import { createServiceClient } from "@/lib/supabase";

export interface FuturesOverallStats {
  totalSignals: number;
  hitRate: number;          // 24h 종가 +5% 이상 (%)
  hitRateMaxIntraday: number; // 24h 안에 한 번이라도 +5% 도달 (%)
  avgReturn24h: number;     // 24h 종가 평균 (%)
  avgMaxReturn: number;     // 24h 내 최고가 평균 (%)
  maxReturn24h: number;
  hitRate3d: number | null; // 최근 3일 24h 종가 적중률 (추세용)
  daysCovered: number;
  isMock: boolean;
}

export interface FuturesCoinStats {
  count: number;
  hitRate: number;
  hitRateMaxIntraday: number;
  avgReturn24h: number;
  avgMaxReturn: number;
  maxReturn24h: number;
  lastSignalHoursAgo: number;
}

export interface FuturesStats {
  overall: FuturesOverallStats;
  byCoin: Record<string, FuturesCoinStats>;
}

const HIT_THRESHOLD = 5;
const LOOKBACK_DAYS = 7;
const RECENT_DAYS = 3;
const MIN_REAL_SIGNALS = 500;

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
      hitRateMaxIntraday: 60 + Math.floor(Math.random() * 35),
      avgReturn24h: 4 + Math.random() * 10,
      avgMaxReturn: 8 + Math.random() * 14,
      maxReturn24h: 15 + Math.random() * 35,
      lastSignalHoursAgo: Math.floor(Math.random() * 72),
    };
  }
  return {
    overall: {
      totalSignals: 128,
      hitRate: 64,
      hitRateMaxIntraday: 78,
      avgReturn24h: 8.2,
      avgMaxReturn: 14.7,
      maxReturn24h: 47.3,
      hitRate3d: 67,
      daysCovered: LOOKBACK_DAYS,
      isMock: true,
    },
    byCoin,
  };
}

type SignalRow = {
  symbol: string;
  recorded_at: string;
  entry_price: number;
  price_1h: number | null;
  price_4h: number | null;
  price_24h: number | null;
};

function intradayMax(r: SignalRow): number {
  // entry 대비 1h/4h/24h 가격 중 가장 높은 수익률
  const candidates: number[] = [];
  if (r.price_1h != null) candidates.push(pct(r.price_1h, r.entry_price));
  if (r.price_4h != null) candidates.push(pct(r.price_4h, r.entry_price));
  if (r.price_24h != null) candidates.push(pct(r.price_24h, r.entry_price));
  return candidates.length ? Math.max(...candidates) : 0;
}

export async function getFuturesStats(): Promise<FuturesStats> {
  try {
    const sb = createServiceClient();
    const since7d = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
    const since3d = new Date(Date.now() - RECENT_DAYS * 86400_000).toISOString();

    const { data, error } = await sb
      .from("futures_signals")
      .select("symbol, recorded_at, entry_price, price_1h, price_4h, price_24h")
      .gte("recorded_at", since7d)
      .not("price_24h", "is", null)
      .range(0, 9999);

    if (error || !data || data.length < MIN_REAL_SIGNALS) {
      return makeMock();
    }

    const rows = data as SignalRow[];

    // 전체 통계 (24h 종가)
    const ret24 = rows.map((r) => pct(r.price_24h!, r.entry_price)).filter(Number.isFinite);
    const retMax = rows.map(intradayMax).filter(Number.isFinite);
    const hits24 = ret24.filter((r) => r >= HIT_THRESHOLD).length;
    const hitsMax = retMax.filter((r) => r >= HIT_THRESHOLD).length;
    const avg24 = ret24.reduce((a, b) => a + b, 0) / (ret24.length || 1);
    const avgMx = retMax.reduce((a, b) => a + b, 0) / (retMax.length || 1);
    const max24 = Math.max(...ret24, 0);

    // 최근 3일 적중률 (추세)
    const recent = rows.filter((r) => r.recorded_at >= since3d);
    const recentRets = recent.map((r) => pct(r.price_24h!, r.entry_price)).filter(Number.isFinite);
    const recentHits = recentRets.filter((r) => r >= HIT_THRESHOLD).length;
    const hitRate3d = recentRets.length >= 50
      ? (recentHits / recentRets.length) * 100
      : null;

    // 코인별
    type CoinAgg = { rets24: number[]; retsMax: number[]; lastAt: number };
    const bySymbol = new Map<string, CoinAgg>();
    const now = Date.now();
    for (const row of rows) {
      const r24 = pct(row.price_24h!, row.entry_price);
      const rMax = intradayMax(row);
      if (!Number.isFinite(r24)) continue;
      const s = row.symbol.toUpperCase();
      const ts = new Date(row.recorded_at).getTime();
      const prev = bySymbol.get(s);
      if (prev) {
        prev.rets24.push(r24);
        prev.retsMax.push(rMax);
        if (ts > prev.lastAt) prev.lastAt = ts;
      } else {
        bySymbol.set(s, { rets24: [r24], retsMax: [rMax], lastAt: ts });
      }
    }

    const byCoin: Record<string, FuturesCoinStats> = {};
    for (const [sym, { rets24, retsMax, lastAt }] of bySymbol) {
      const hits24c = rets24.filter((r) => r >= HIT_THRESHOLD).length;
      const hitsMaxc = retsMax.filter((r) => r >= HIT_THRESHOLD).length;
      byCoin[sym] = {
        count: rets24.length,
        hitRate: (hits24c / rets24.length) * 100,
        hitRateMaxIntraday: (hitsMaxc / retsMax.length) * 100,
        avgReturn24h: rets24.reduce((a, b) => a + b, 0) / rets24.length,
        avgMaxReturn: retsMax.reduce((a, b) => a + b, 0) / retsMax.length,
        maxReturn24h: Math.max(...rets24),
        lastSignalHoursAgo: Math.round((now - lastAt) / 3600_000),
      };
    }

    return {
      overall: {
        totalSignals: rows.length,
        hitRate: (hits24 / ret24.length) * 100,
        hitRateMaxIntraday: (hitsMax / retMax.length) * 100,
        avgReturn24h: avg24,
        avgMaxReturn: avgMx,
        maxReturn24h: max24,
        hitRate3d,
        daysCovered: LOOKBACK_DAYS,
        isMock: false,
      },
      byCoin,
    };
  } catch {
    return makeMock();
  }
}
