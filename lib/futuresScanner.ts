export type FuturesPresetKey = "overall" | "highFunding" | "oiSurge" | "volumeBlast";

export interface FuturesWeights {
  volume: number;
  funding: number;
  oi: number;
}

export const FUTURES_PRESETS: Record<FuturesPresetKey, FuturesWeights> = {
  overall:     { volume: 1.0, funding: 1.0, oi: 1.0 },
  highFunding: { volume: 0.5, funding: 3.0, oi: 0.8 },
  oiSurge:     { volume: 0.5, funding: 0.8, oi: 3.0 },
  volumeBlast: { volume: 3.0, funding: 0.5, oi: 0.5 },
};

export const FUTURES_PRESET_LABELS: Record<FuturesPresetKey, string> = {
  overall:     "종합",
  highFunding: "고펀딩비",
  oiSurge:     "OI 급증",
  volumeBlast: "거래량 폭발",
};

export interface FuturesCoin {
  symbol: string;
  fundingRate: number;
  oiChangePct: number;
  volume4hUsd: number;
  volume4hRankPct: number;
  marketCapUsd: number | null;
  score: number;
}

function volumeScore(rankPct: number): number {
  if (rankPct <= 0.10) return 30;
  if (rankPct <= 0.25) return 20;
  if (rankPct <= 0.50) return 10;
  return 0;
}

function fundingScore(rate: number): number {
  if (rate > 0.0001)  return 20;
  if (rate > 0.00005) return 12;
  return 5;
}

function oiScore(changePct: number): number {
  if (changePct > 20) return 30;
  if (changePct > 10) return 20;
  if (changePct > 5)  return 10;
  if (changePct > 0)  return 3;
  return 0;
}

function marketCapBonus(capUsd: number | null): number {
  if (capUsd === null)       return 0;
  if (capUsd < 50_000_000)  return 20;
  if (capUsd < 100_000_000) return 10;
  return 0;
}

export function getTopFutures(
  data: FuturesCoin[],
  weights: FuturesWeights,
  n = 10,
): FuturesCoin[] {
  const total = data.length;
  if (total === 0) return [];
  return data
    .map((coin) => ({
      ...coin,
      score:
        volumeScore(coin.volume4hRankPct) * weights.volume +
        fundingScore(coin.fundingRate) * weights.funding +
        oiScore(coin.oiChangePct) * weights.oi +
        marketCapBonus(coin.marketCapUsd),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
