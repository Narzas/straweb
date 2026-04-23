export type FuturesPresetKey = "overall" | "earlyEntry" | "trendFollow" | "shortSqueeze" | "overheat";

export interface FuturesWeights {
  funding: number;
  priceOiCombo: number;
  volume: number;
  timing: number;
  penaltyScale: number;
}

export const FUTURES_PRESETS: Record<FuturesPresetKey, FuturesWeights> = {
  overall:      { funding: 1.0, priceOiCombo: 1.0, volume: 1.0, timing: 1.0, penaltyScale: 1.0 },
  earlyEntry:   { funding: 1.0, priceOiCombo: 0.8, volume: 0.8, timing: 2.5, penaltyScale: 1.2 },
  trendFollow:  { funding: 0.8, priceOiCombo: 2.0, volume: 1.5, timing: 0.5, penaltyScale: 1.0 },
  shortSqueeze: { funding: 0.5, priceOiCombo: 2.0, volume: 1.0, timing: 0.8, penaltyScale: 0.7 },
  overheat:     { funding: 0.3, priceOiCombo: 0.5, volume: 2.0, timing: 0.2, penaltyScale: 0.0 },
};

export const FUTURES_PRESET_LABELS: Record<FuturesPresetKey, string> = {
  overall:      "종합",
  earlyEntry:   "초기 유입",
  trendFollow:  "추세 추종",
  shortSqueeze: "숏 스퀴즈",
  overheat:     "과열 구간",
};

export interface FuturesCoin {
  symbol: string;
  fundingRate: number;
  priceChange1h: number;
  priceChange4h: number;
  oiChangePct: number;
  oiChangePct6h: number;
  volume4hUsd: number;
  volume4hRankPct: number;
  volumeSpike: number;
  marketCapUsd: number | null;
  score: number;
}

// 0~0.01% best | 0.01~0.03% caution | >0.03% overheated | negative = squeeze candidate
function fundingHealthScore(rate: number): number {
  const pct = rate * 100;
  if (pct >= 0 && pct <= 0.01) return 25;
  if (pct > 0.01 && pct <= 0.03) return 12;
  if (pct > 0.03) return 0;
  if (pct < 0 && pct >= -0.03) return 8; // mild short bias = squeeze candidate
  return 5;
}

// price ↓ + OI ↑ = 숏 쌓임(롱 기회) highest | price ↑ + OI ↑ = 추세
function priceOiComboScore(priceChange1h: number, oiChangePct: number): number {
  const priceUp   = priceChange1h > 1;
  const priceDown = priceChange1h < -1;
  const priceFlat = !priceUp && !priceDown;
  const oiUp      = oiChangePct > 3;
  const oiDown    = oiChangePct < -3;

  if (priceDown && oiUp)   return 30; // 🔥 숏 쌓임 = 스퀴즈 후보
  if (priceUp   && oiUp)   return 22; // 추세 (과열 별도 체크)
  if (priceFlat && oiUp)   return 15; // 포지션 쌓이는 구간
  if (priceUp   && oiDown) return 5;  // 단순 숏커버링
  if (priceDown && oiDown) return 0;  // 청산/이탈
  return 5;
}

function volumeRelScore(rankPct: number): number {
  if (rankPct <= 0.10) return 20;
  if (rankPct <= 0.25) return 14;
  if (rankPct <= 0.50) return 7;
  return 0;
}

// 막 터지기 직전: 4H 횡보 + OI 6H 서서히 증가 + 거래량 증가 시작
function timingScore(priceChange4h: number, oiChangePct6h: number, volumeSpike: number): number {
  const sideways   = Math.abs(priceChange4h) <= 2;
  const oiBuild    = oiChangePct6h > 5;
  const volStarting = volumeSpike >= 1.3 && volumeSpike <= 4;

  let score = 0;
  if (sideways)    score += 5;
  if (oiBuild)     score += 10;
  if (volStarting) score += 5;
  if (sideways && oiBuild && volStarting) score += 5; // 풀 콤보 보너스
  return score;
}

// 이미 터진 코인 필터: 1H +8%, 펀딩 과열, 거래량 5배 급증
function overheatPenalty(priceChange1h: number, fundingRate: number, volumeSpike: number): number {
  let penalty = 0;
  if (priceChange1h > 8)          penalty += 20;
  if (fundingRate * 100 > 0.03)   penalty += 15;
  if (volumeSpike > 5)            penalty += 15;
  return penalty;
}

// 시총 < $20M: 조작/덤핑 위험
function riskPenalty(marketCapUsd: number | null): number {
  if (marketCapUsd === null)              return 5;
  if (marketCapUsd < 20_000_000)         return 20;
  if (marketCapUsd < 50_000_000)         return 5;
  return 0;
}

export function getTopFutures(
  data: FuturesCoin[],
  weights: FuturesWeights,
  n = 10,
): FuturesCoin[] {
  if (data.length === 0) return [];
  return data
    .map((coin) => ({
      ...coin,
      score:
        fundingHealthScore(coin.fundingRate)                                        * weights.funding
        + priceOiComboScore(coin.priceChange1h, coin.oiChangePct)                  * weights.priceOiCombo
        + volumeRelScore(coin.volume4hRankPct)                                     * weights.volume
        + timingScore(coin.priceChange4h, coin.oiChangePct6h, coin.volumeSpike)    * weights.timing
        - overheatPenalty(coin.priceChange1h, coin.fundingRate, coin.volumeSpike)  * weights.penaltyScale
        - riskPenalty(coin.marketCapUsd),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// 프리셋별 이론 최고점 (score bar 정규화용)
export function getPresetMaxScore(weights: FuturesWeights): number {
  return (
    25 * weights.funding +
    30 * weights.priceOiCombo +
    20 * weights.volume +
    25 * weights.timing
  );
}
