import { createServiceClient } from "@/lib/supabase";
import type { Metadata } from "next";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";
import MarketSentimentSection from "@/components/MarketSentimentSection";
import SmartMoneyDashboardSection from "@/components/SmartMoneyDashboardSection";
import PredictionMarketsSection from "@/components/PredictionMarketsSection";
import { CryptoTicker } from "@/components/CryptoTicker";
import SectorPerformanceSection from "@/components/SectorPerformanceSection";
import GainersLosersSection from "@/components/GainersLosersSection";
import RsiHeatmapSection from "@/components/RsiHeatmapSection";

export const revalidate = 3600;

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

export const metadata: Metadata = {
  title: "크립토 브리핑",
  description: "매일 업데이트되는 크립토 시장 현황, 트렌딩 코인, DeFi 동향, 주요 뉴스",
};

type Coin = {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  market_cap: number;
};

type TrendingCoin = {
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string | null;
};

type FearGreed = {
  value: number;
  classification: string;
  classification_ko: string;
};

type DexChain = {
  chain: string;
  tvl: number;
  change_1d: number;
  flow_usd: number;
};

type NewsItem = {
  title: string;
  url: string;
  description: string;
  image: string | null;
  pubDate: string;
};

type NetflowItem = {
  chain: string;
  token_symbol: string;
  token_address: string;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number | null;
  price_usd: number | null;
  smart_money_inflow_24h: number | null;
  smart_money_outflow_24h: number | null;
};

type PredictionMarketItem = {
  market_id: string;
  question: string;
  yes_price: number | null;
  volume_24hr: number;
  total_volume: number;
  end_date: string | null;
  platform: string;
  market_url?: string | null;
};

type HyperliquidPerpItem = {
  token_symbol: string;
  volume: number;
  buy_volume: number | null;
  sell_volume: number | null;
  buy_sell_ratio: number | null;
  buy_sell_pressure: number | null;
  funding_rate: number | null;
  open_interest: number | null;
  mark_price: number | null;
};

type SectorItem = {
  id: string;
  name: string;
  market_cap_change_24h: number;
  volume_24h: number | null;
};

type Editorial = {
  sentiment: string;
  summary: string;
  highlights: string[];
  market_comment: string | null;
  coin_comment: string | null;
  trending_comment: string | null;
  dex_comment: string | null;
  fng_comment: string | null;
  altcoin_season?: number | null;
  long_short_ratio?: number | null;
  netflows?: NetflowItem[] | null;
  prediction_markets?: PredictionMarketItem[] | null;
  hyperliquid_perps?: HyperliquidPerpItem[] | null;
  coin_categories?: SectorItem[] | null;
  rsi_heatmap?: {
    overbought: Array<{ symbol: string; rsi_4h: number | null; rsi_1d: number | null; rsi_1w: number | null }>;
    oversold:   Array<{ symbol: string; rsi_4h: number | null; rsi_1d: number | null; rsi_1w: number | null }>;
  } | null;
  gainers_losers?: {
    gainers: Array<{ symbol: string; name: string; current_price: number; price_change_percentage_24h: number; image?: string | null }>;
    losers:  Array<{ symbol: string; name: string; current_price: number; price_change_percentage_24h: number; image?: string | null }>;
  } | null;
};

type CryptoDaily = {
  date: string;
  market: {
    total_market_cap_usd: number | null;
    market_cap_change_24h: number | null;
    btc_dominance: number | null;
    eth_dominance: number | null;
    active_cryptocurrencies: number | null;
    coins: Coin[];
  } | null;
  trending: TrendingCoin[];
  fearGreed: FearGreed | null;
  dexChains: DexChain[];
  news: NewsItem[];
  editorial: Editorial | null;
};

function fmt(n: number | null | undefined, digits = 2) {
  if (n == null) return "–";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtUsd(n: number | null | undefined) {
  if (n == null) return "–";
  if (n >= 1e12) return `$${fmt(n / 1e12)}T`;
  if (n >= 1e9) return `$${fmt(n / 1e9)}B`;
  if (n >= 1e6) return `$${fmt(n / 1e6)}M`;
  return `$${fmt(n)}`;
}

function Change({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="text-gray-400">–</span>;
  const pos = v >= 0;
  return (
    <span className={pos ? "text-emerald-500" : "text-red-500"}>
      {pos ? "▲" : "▼"} {Math.abs(v).toFixed(2)}%
    </span>
  );
}

const SENTIMENT_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "강한 상승장": { bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  "상승세":      { bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-400" },
  "보합 상승":   { bg: "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700", text: "text-gray-600 dark:text-gray-300", dot: "bg-gray-400" },
  "보합 하락":   { bg: "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700", text: "text-gray-600 dark:text-gray-300", dot: "bg-gray-400" },
  "하락세":      { bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900", text: "text-red-700 dark:text-red-300", dot: "bg-red-400" },
  "강한 하락장": { bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
};

async function getData(date?: string): Promise<CryptoDaily | null> {
  try {
    const sb = createServiceClient();
    const q = sb.from("crypto_daily").select("*");
    if (date) {
      q.eq("date", date);
    } else {
      q.order("date", { ascending: false }).limit(1);
    }
    const { data } = await q.maybeSingle();
    return data as CryptoDaily | null;
  } catch {
    return null;
  }
}

async function getAdjacentDates(currentDate: string): Promise<{ prev: string | null; next: string | null }> {
  try {
    const sb = createServiceClient();
    const [prevRes, nextRes] = await Promise.all([
      sb.from("crypto_daily").select("date").lt("date", currentDate).order("date", { ascending: false }).limit(1).maybeSingle(),
      sb.from("crypto_daily").select("date").gt("date", currentDate).order("date", { ascending: true }).limit(1).maybeSingle(),
    ]);
    return {
      prev: (prevRes.data as { date: string } | null)?.date ?? null,
      next: (nextRes.data as { date: string } | null)?.date ?? null,
    };
  } catch {
    return { prev: null, next: null };
  }
}

export default async function CryptoPage({ searchParams }: PageProps) {
  const { date: dateParam } = await searchParams;
  const data = await getData(dateParam);

  if (!data) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
        데이터가 없습니다. 스크립트를 먼저 실행해주세요.
      </main>
    );
  }

  const { market, trending, fearGreed, dexChains, news, date, editorial } = data;
  const adjacent = await getAdjacentDates(date);
  const [y, m, d] = date.split("-");
  const dateLabel = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  const sentimentStyle = SENTIMENT_STYLE[editorial?.sentiment ?? ""] ?? SENTIMENT_STYLE["보합 상승"];

  return (
    <div className="relative z-[1] lg:grid lg:grid-cols-[240px_1fr_220px] lg:gap-6 xl:gap-8">
      <Sidebar />
      <main className="min-w-0 space-y-8">

        {/* 헤더 */}
        <div>
          <p className="text-xs text-indigo-400 font-semibold uppercase tracking-widest mb-1">
            Daily Crypto Briefing
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            크립토 브리핑 — {dateLabel}
          </h1>
          <div className="flex items-center gap-3 mt-3">
            {adjacent.prev ? (
              <Link href={`/crypto?date=${adjacent.prev}`} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
                ← {adjacent.prev}
              </Link>
            ) : (
              <span className="text-xs text-gray-300 dark:text-gray-600">← 이전 없음</span>
            )}
            <span className="text-gray-300 dark:text-gray-700">|</span>
            {adjacent.next ? (
              <Link href={`/crypto?date=${adjacent.next}`} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
                {adjacent.next} →
              </Link>
            ) : (
              <span className="text-xs text-gray-300 dark:text-gray-600">최신글</span>
            )}
          </div>
        </div>

        {/* 시장 개요 */}
        {market && (
          <section>
            <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
              전체 시장 개요
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "시가총액", value: fmtUsd(market.total_market_cap_usd) },
                { label: "24h 변동", value: <Change v={market.market_cap_change_24h} /> },
                { label: "BTC 도미넌스", value: `${fmt(market.btc_dominance)}%` },
                { label: "ETH 도미넌스", value: `${fmt(market.eth_dominance)}%` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-4 py-3">
                  <p className="text-[11px] text-gray-400 mb-1">{item.label}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
            {editorial?.market_comment && (
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2">
                💡 {editorial.market_comment}
              </p>
            )}

            {/* 주요 코인 */}
            {market.coins?.length > 0 && (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-gray-500 border-b border-gray-300 dark:border-slate-700">
                        <th className="text-left py-2 font-medium">코인</th>
                        <th className="text-right py-2 font-medium">가격</th>
                        <th className="text-right py-2 font-medium">24h</th>
                        <th className="text-right py-2 font-medium hidden sm:table-cell">7d</th>
                        <th className="text-right py-2 font-medium hidden sm:table-cell">시가총액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {market.coins.map((c) => (
                        <tr key={c.id} className="border-b border-gray-200 dark:border-slate-800 last:border-0">
                          <td className="py-2 font-medium text-gray-800 dark:text-gray-200">
                            {c.name}{" "}
                            <span className="text-[11px] text-gray-400 font-normal">{c.symbol.toUpperCase()}</span>
                          </td>
                          <td className="py-2 text-right tabular-nums text-gray-800 dark:text-gray-200">${fmt(c.current_price)}</td>
                          <td className="py-2 text-right tabular-nums"><Change v={c.price_change_percentage_24h} /></td>
                          <td className="py-2 text-right tabular-nums hidden sm:table-cell"><Change v={c.price_change_percentage_7d_in_currency} /></td>
                          <td className="py-2 text-right tabular-nums text-gray-500 hidden sm:table-cell">{fmtUsd(c.market_cap)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {editorial?.coin_comment && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2">
                    💡 {editorial.coin_comment}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {editorial?.gainers_losers && (
          <GainersLosersSection data={editorial.gainers_losers} />
        )}

        {editorial?.coin_categories?.length && (
          <SectorPerformanceSection sectors={editorial.coin_categories} />
        )}

        {/* 트렌딩 코인 */}
        {trending?.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
              🔥 오늘의 트렌딩 코인
            </h2>
            <div className="flex flex-wrap gap-2">
              {trending.map((c, i) => (
                <div key={c.symbol} className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                  <span className="text-[11px] text-indigo-400 font-bold">#{i + 1}</span>
                  {c.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumb} alt={c.name} className="w-4 h-4 rounded-full" />
                  )}
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                  <span className="text-[11px] text-gray-400">{c.symbol}</span>
                </div>
              ))}
            </div>
            {editorial?.trending_comment && (
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2">
                💡 {editorial.trending_comment}
              </p>
            )}
          </section>
        )}

        <CryptoTicker />

        {editorial?.rsi_heatmap && (
          <RsiHeatmapSection data={editorial.rsi_heatmap} />
        )}

        <MarketSentimentSection
          fearGreed={fearGreed}
          dexChains={dexChains ?? []}
          fngComment={editorial?.fng_comment}
          dexComment={editorial?.dex_comment}
          altcoinSeason={editorial?.altcoin_season}
          longShortRatio={editorial?.long_short_ratio}
        />

        {(editorial?.netflows?.length || editorial?.hyperliquid_perps?.length) && (
          <SmartMoneyDashboardSection
            netflows={editorial.netflows ?? []}
            perps={editorial.hyperliquid_perps ?? []}
          />
        )}

        {editorial?.prediction_markets?.length && (
          <PredictionMarketsSection items={editorial.prediction_markets} />
        )}


        <p className="text-[11px] text-gray-300 dark:text-gray-600 border-t border-gray-300 dark:border-slate-800 pt-4">
          매일 자동 갱신됩니다. 정보 제공 목적이며 투자 권유가 아닙니다.
        </p>
      </main>
      <RightSidebar />
    </div>
  );
}
