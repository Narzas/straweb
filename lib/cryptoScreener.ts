export type PresetKey = "overall" | "rsi" | "smartmoney" | "momentum";

export interface Weights {
  rsi: number;
  smartMoney: number;
  momentum: number;
}

export const PRESETS: Record<PresetKey, Weights> = {
  overall:    { rsi: 1.0, smartMoney: 1.0, momentum: 1.0 },
  rsi:        { rsi: 2.0, smartMoney: 0.5, momentum: 0.8 },
  smartmoney: { rsi: 0.5, smartMoney: 2.5, momentum: 0.8 },
  momentum:   { rsi: 0.8, smartMoney: 0.8, momentum: 2.0 },
};

export type TagColor = "green" | "yellow" | "red";

export interface SignalTag {
  label: string;
  color: TagColor;
  detail: string;
}

export interface CoinInput {
  symbol: string;
  name: string;
  rsi1d: number | null;
  netFlow24h: number | null;
  change24h: number | null;
  change7d: number | null;
  isTrending: boolean;
}

export interface ScoredCoin extends CoinInput {
  score: number;
  tags: SignalTag[];
}

function rsiScore(rsi: number | null): number {
  if (rsi === null) return 0;
  if (rsi < 30)  return 40;
  if (rsi < 40)  return 25;
  if (rsi < 50)  return 10;
  if (rsi < 70)  return 0;
  return -20;
}

function smartMoneyScore(flow: number | null): number {
  if (flow === null)     return 0;
  if (flow > 1_000_000) return 35;
  if (flow > 100_000)   return 20;
  if (flow > 0)         return 10;
  return -15;
}

function momentumScore(change24h: number | null, change7d: number | null): number {
  const d = change24h ?? 0;
  const w = change7d  ?? 0;
  if (d < 0 && w > 0) return 25;
  if (d > 0 && w > 0) return 15;
  if (d > 0 && w < 0) return 5;
  return 0;
}

export function getSignalTags(coin: CoinInput): SignalTag[] {
  const tags: SignalTag[] = [];

  if (coin.rsi1d !== null) {
    if (coin.rsi1d < 30) {
      tags.push({ label: "RSI 과매도", color: "green",  detail: `RSI ${coin.rsi1d.toFixed(0)}` });
    } else if (coin.rsi1d < 40) {
      tags.push({ label: "RSI 저점권", color: "yellow", detail: `RSI ${coin.rsi1d.toFixed(0)}` });
    } else if (coin.rsi1d >= 70) {
      tags.push({ label: "RSI 과매수", color: "red",    detail: `RSI ${coin.rsi1d.toFixed(0)}` });
    }
  }

  if (coin.netFlow24h !== null) {
    const m = coin.netFlow24h / 1_000_000;
    if (coin.netFlow24h > 1_000_000) {
      tags.push({ label: "고래 대량 유입", color: "green",  detail: `+$${m.toFixed(1)}M` });
    } else if (coin.netFlow24h > 100_000) {
      tags.push({ label: "고래 유입",     color: "green",  detail: `+$${(coin.netFlow24h / 1000).toFixed(0)}K` });
    } else if (coin.netFlow24h > 0) {
      tags.push({ label: "소폭 유입",     color: "yellow", detail: `+$${(coin.netFlow24h / 1000).toFixed(0)}K` });
    } else {
      tags.push({ label: "고래 유출",     color: "red",    detail: `$${m.toFixed(1)}M` });
    }
  }

  const d = coin.change24h, w = coin.change7d;
  if (d !== null && w !== null) {
    if (d < 0 && w > 0) {
      tags.push({ label: "눌림목", color: "green",
        detail: `${d.toFixed(1)}% / +${w.toFixed(1)}%` });
    } else if (d > 0 && w > 0) {
      tags.push({ label: "상승 추세", color: "yellow",
        detail: `+${d.toFixed(1)}% / +${w.toFixed(1)}%` });
    }
  }

  if (coin.isTrending) {
    tags.push({ label: "트렌딩", color: "yellow", detail: "CoinGecko" });
  }

  return tags;
}

export function scoreCoin(coin: CoinInput, weights: Weights): number {
  const r = rsiScore(coin.rsi1d)                         * weights.rsi;
  const s = smartMoneyScore(coin.netFlow24h)             * weights.smartMoney;
  const m = momentumScore(coin.change24h, coin.change7d) * weights.momentum;
  const t = coin.isTrending ? 10 : 0;
  return r + s + m + t;
}

export function getTopCandidates(
  rsiAll:   Array<{ symbol: string; rsi_4h: number | null; rsi_1d: number | null; rsi_1w: number | null }> | undefined | null,
  netflows: Array<{ token_symbol: string; net_flow_24h_usd: number }> | undefined | null,
  coins:    Array<{ symbol: string; name: string; price_change_percentage_24h: number; price_change_percentage_7d_in_currency: number }> | undefined | null,
  trendingSymbols: string[],
  weights: Weights,
  n = 5,
): ScoredCoin[] {
  const rsiMap = new Map<string, number | null>();
  for (const r of rsiAll ?? []) {
    rsiMap.set(r.symbol.toUpperCase(), r.rsi_1d);
  }

  const flowMap = new Map<string, number>();
  for (const f of netflows ?? []) {
    flowMap.set(f.token_symbol.toUpperCase(), f.net_flow_24h_usd);
  }

  const coinMap = new Map<string, { name: string; change24h: number; change7d: number }>();
  for (const c of coins ?? []) {
    coinMap.set(c.symbol.toUpperCase(), {
      name:      c.name,
      change24h: c.price_change_percentage_24h,
      change7d:  c.price_change_percentage_7d_in_currency,
    });
  }

  const trendingSet = new Set(trendingSymbols.map(s => s.toUpperCase()));
  const universe    = new Set([
    ...(coins ?? []).map(c => c.symbol.toUpperCase()),
    ...rsiMap.keys(),
    ...flowMap.keys(),
  ]);

  const scored: ScoredCoin[] = [];
  for (const sym of universe) {
    const coinData = coinMap.get(sym);
    const input: CoinInput = {
      symbol:     sym,
      name:       coinData?.name ?? sym,
      rsi1d:      rsiMap.has(sym) ? rsiMap.get(sym)! : null,
      netFlow24h: flowMap.has(sym) ? flowMap.get(sym)! : null,
      change24h:  coinData?.change24h ?? null,
      change7d:   coinData?.change7d  ?? null,
      isTrending: trendingSet.has(sym),
    };
    scored.push({ ...input, score: scoreCoin(input, weights), tags: getSignalTags(input) });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, n);
}
