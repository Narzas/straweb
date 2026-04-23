import { createServiceClient } from "@/lib/supabase";
import type { Metadata } from "next";
import type { FuturesCoin } from "@/lib/futuresScanner";
import Link from "next/link";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";
import AnimatedSection from "@/components/AnimatedSection";

function SectionSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />;
}

const MarketSentimentSection = dynamic(() => import("@/components/MarketSentimentSection"), { loading: () => <SectionSkeleton /> });
const GainersLosersSection    = dynamic(() => import("@/components/GainersLosersSection"),    { loading: () => <SectionSkeleton /> });
const SectorPerformanceSection = dynamic(() => import("@/components/SectorPerformanceSection"), { loading: () => <SectionSkeleton /> });
const RsiHeatmapSection        = dynamic(() => import("@/components/RsiHeatmapSection"),        { loading: () => <SectionSkeleton /> });
const DexChainsSection         = dynamic(() => import("@/components/DexChainsSection"),         { loading: () => <SectionSkeleton /> });
const SmartMoneyDashboardSection = dynamic(() => import("@/components/SmartMoneyDashboardSection"), { loading: () => <SectionSkeleton /> });
const PredictionMarketsSection   = dynamic(() => import("@/components/PredictionMarketsSection"),   { loading: () => <SectionSkeleton /> });
const FuturesScannerSection  = dynamic(() => import("@/components/FuturesScannerSection"),  { loading: () => <SectionSkeleton /> });
const FuturesTrackingSection = dynamic(() => import("@/components/FuturesTrackingSection"), { loading: () => <SectionSkeleton /> });

export const revalidate = 3600;

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

export const metadata: Metadata = {
  title: "크립토 브리핑",
  description: "매일 업데이트되는 크립토 시장 현황, 트렌딩 코인, DeFi 동향, 주요 뉴스",
  alternates: { canonical: "/crypto" },
  openGraph: {
    title: "크립토 브리핑 — StraWeb",
    description: "매일 업데이트되는 크립토 시장 현황, 트렌딩 코인, DeFi 동향, 주요 뉴스",
    locale: "ko_KR",
    url: "https://www.stragos.xyz/crypto",
    images: [{ url: "https://www.stragos.xyz/og?title=%ED%81%AC%EB%A6%BD%ED%86%A0+%EB%B8%8C%EB%A6%AC%ED%95%91", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "크립토 브리핑 — StraWeb",
    description: "매일 업데이트되는 크립토 시장 현황, 트렌딩 코인, DeFi 동향, 주요 뉴스",
    images: ["https://www.stragos.xyz/og?title=%ED%81%AC%EB%A6%BD%ED%86%A0+%EB%B8%8C%EB%A6%AC%ED%95%91"],
  },
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
  price: number | null;
  price_change_24h: number | null;
  price_change_7d: number | null;
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

type FuturesCoinStored = {
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
    all?:       Array<{ symbol: string; rsi_4h: number | null; rsi_1d: number | null; rsi_1w: number | null }>;
  } | null;
  gainers_losers?: {
    gainers: Array<{ symbol: string; name: string; current_price: number; price_change_percentage_24h: number; image?: string | null }>;
    losers:  Array<{ symbol: string; name: string; current_price: number; price_change_percentage_24h: number; image?: string | null }>;
  } | null;
  coins_top250?: Array<{
    symbol: string;
    name: string;
    price_change_percentage_24h: number;
    price_change_percentage_7d_in_currency: number;
  }> | null;
  futures_scanner?: FuturesCoinStored[] | null;
};

type CryptoDaily = {
  date: string;
  market: {
    total_market_cap_usd: number | null;
    market_cap_change_24h: number | null;
    btc_dominance: number | null;
    usdt_dominance: number | null;
    active_cryptocurrencies: number | null;
    coins: Coin[];
  } | null;
  trending: TrendingCoin[];
  fearGreed: FearGreed | null;
  dexChains: DexChain[];
  editorial: Editorial | null;
};

function fmtPct(n: number) {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "▲" : "▼";
  let val: string;
  if (abs >= 1_000_000) val = `${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) val = `${(abs / 1_000).toFixed(1)}K`;
  else val = abs.toFixed(1);
  return `${sign}${val}%`;
}

function fmtPrice(n: number | null | undefined) {
  if (n == null) return "–";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

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

async function getFuturesSignals() {
  try {
    const sb = createServiceClient();
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const { data } = await sb
      .from("futures_signals")
      .select("id, recorded_at, symbol, rank, entry_price, score, price_1h, price_4h, price_24h")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(500);
    return data ?? [];
  } catch {
    return [];
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
  const [data, futuresSignals] = await Promise.all([
    getData(dateParam),
    getFuturesSignals(),
  ]);

  if (!data) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
        데이터가 없습니다. 스크립트를 먼저 실행해주세요.
      </main>
    );
  }

  const { market, trending, fearGreed, dexChains, date, editorial } = data;
  const adjacent = await getAdjacentDates(date);
  const [y, m, d] = date.split("-");
  const dateLabel = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  const sentimentStyle = SENTIMENT_STYLE[editorial?.sentiment ?? ""] ?? SENTIMENT_STYLE["보합 상승"];

  return (
    <div className="relative z-[1] lg:grid lg:grid-cols-[240px_1fr_220px] lg:gap-6 xl:gap-8">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>
      <main className="min-w-0 space-y-8">

        {/* 헤더 */}
        <div>
          <p className="text-xs text-indigo-400 font-semibold uppercase tracking-widest mb-1">
            Daily Crypto Briefing
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            크립토 브리핑 — {dateLabel}
          </h1>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
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
            <span className="text-[11px] text-gray-400 dark:text-gray-500">🔄 매시간 갱신</span>
          </div>
        </div>

        {/* 섹션 앵커 nav */}
        <div className="sticky top-[73px] z-10 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0 py-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-slate-800 lg:border-0 lg:bg-transparent lg:dark:bg-transparent lg:backdrop-blur-none lg:py-0">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {[
            { id: "overview",    label: "시장개요" },
            { id: "sentiment",   label: "심리지표" },
            { id: "trending",    label: "트렌딩" },
            { id: "gainers",     label: "급등/락" },
            { id: "rsi",         label: "RSI" },
            { id: "futures",     label: "선물" },
            { id: "dex",         label: "DEX" },
            { id: "smartmoney",  label: "스마트머니" },
            { id: "prediction",  label: "예측시장" },
          ].map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
        </div>

        {/* 시장 개요 */}
        {market && (
          <section id="overview" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pl-3 border-l-2 border-indigo-500">
              전체 시장 개요
            </h2>
            {(() => {
              const STAT_COLORS = {
                "시가총액": { from: "from-blue-500/10", border: "border-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
                "24h 변동": { from: "from-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
                "BTC 도미넌스": { from: "from-orange-500/10", border: "border-orange-500/20", text: "text-orange-600 dark:text-orange-400" },
                "USDT 도미넌스": { from: "from-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400" },
              };
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "시가총액", value: fmtUsd(market.total_market_cap_usd) },
                    { label: "24h 변동", value: <Change v={market.market_cap_change_24h} /> },
                    { label: "BTC 도미넌스", value: `${fmt(market.btc_dominance)}%` },
                    { label: "USDT 도미넌스", value: `${fmt(market.usdt_dominance)}%` },
                  ].map((item) => {
                    const c = STAT_COLORS[item.label as keyof typeof STAT_COLORS];
                    return (
                      <div key={item.label} className={`rounded-xl bg-gradient-to-br ${c.from} border ${c.border} px-4 py-3`}>
                        <p className={`text-[11px] ${c.text} mb-1 font-semibold`}>{item.label}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{item.value}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {editorial?.market_comment && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 leading-relaxed">
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
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-[9px] text-gray-500 dark:text-slate-300 font-bold shrink-0">
                                {c.symbol[0].toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{c.name}</span>
                              <span className="text-[10px] text-gray-400">{c.symbol.toUpperCase()}</span>
                            </div>
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
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 leading-relaxed">
                    💡 {editorial.coin_comment}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        <AnimatedSection delay={0.05}>
          <div id="sentiment" className="scroll-mt-24">
            <MarketSentimentSection
              fearGreed={fearGreed}
              fngComment={editorial?.fng_comment}
              altcoinSeason={editorial?.altcoin_season}
              longShortRatio={editorial?.long_short_ratio}
            />
          </div>
        </AnimatedSection>

        {/* 트렌딩 코인 */}
        {trending?.length > 0 && (
          <AnimatedSection delay={0.05}>
            <section id="trending" className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pl-3 border-l-2 border-indigo-500">
                🔥 오늘의 트렌딩 코인
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {trending.map((c, i) => (
                  <div key={c.symbol} title={c.name} className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/50 hover:border-indigo-400/60 dark:hover:border-indigo-500/40 transition-colors cursor-default">
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-black w-4 shrink-0">#{i + 1}</span>
                    {c.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumb} alt={c.name} loading="lazy" className="w-5 h-5 rounded-full shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{c.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">{c.symbol.toUpperCase()}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{fmtPrice(c.price)}</p>
                      <div className="flex items-center gap-1 justify-end">
                        {c.price_change_24h != null && (
                          <span className={`text-[10px] tabular-nums ${c.price_change_24h >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {fmtPct(c.price_change_24h)}
                          </span>
                        )}
                        {c.price_change_7d != null && (
                          <>
                            <span className="text-[9px] text-gray-300 dark:text-slate-600">·</span>
                            <span className={`text-[10px] tabular-nums ${c.price_change_7d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              7d {fmtPct(c.price_change_7d)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {editorial?.trending_comment && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 leading-relaxed">
                  💡 {editorial.trending_comment}
                </p>
              )}
            </section>
          </AnimatedSection>
        )}

        <AnimatedSection delay={0.05}>
          <div id="gainers" className="grid gap-6 lg:grid-cols-2 lg:items-stretch scroll-mt-24">
            {editorial?.gainers_losers && (
              <GainersLosersSection data={editorial.gainers_losers} />
            )}
            {editorial?.coin_categories?.length && (
              <SectorPerformanceSection sectors={editorial.coin_categories} />
            )}
          </div>
        </AnimatedSection>

        {editorial?.rsi_heatmap && (
          <AnimatedSection delay={0.05}>
            <div id="rsi" className="scroll-mt-24">
              <RsiHeatmapSection data={editorial.rsi_heatmap} />
            </div>
          </AnimatedSection>
        )}

        {/* 선물 스캐너 */}
        {editorial?.futures_scanner && editorial.futures_scanner.length > 0 && (
          <AnimatedSection delay={0.05}>
            <div id="futures" className="scroll-mt-24">
              <FuturesScannerSection data={editorial.futures_scanner as FuturesCoin[]} />
            </div>
          </AnimatedSection>
        )}

        {/* 선물 신호 트래킹 */}
        <AnimatedSection delay={0.05}>
          <FuturesTrackingSection signals={futuresSignals} />
        </AnimatedSection>

        <AnimatedSection delay={0.05}>
          <div id="dex" className="scroll-mt-24">
            <DexChainsSection
              dexChains={dexChains ?? []}
              dexComment={editorial?.dex_comment}
            />
          </div>
        </AnimatedSection>

        {(editorial?.netflows?.length || editorial?.hyperliquid_perps?.length) && (
          <AnimatedSection delay={0.05}>
            <div id="smartmoney" className="scroll-mt-24">
              <SmartMoneyDashboardSection
                netflows={editorial.netflows ?? []}
                perps={editorial.hyperliquid_perps ?? []}
              />
            </div>
          </AnimatedSection>
        )}

        {editorial?.prediction_markets?.length && (
          <AnimatedSection delay={0.05}>
            <div id="prediction" className="scroll-mt-24">
              <PredictionMarketsSection items={editorial.prediction_markets} />
            </div>
          </AnimatedSection>
        )}


        <div className="border-t border-gray-200 dark:border-slate-700 pt-5 mt-2">
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 font-medium">
            <span className="text-base leading-none">⚠️</span>
            본 페이지는 정보 제공 목적이며 투자 권유가 아닙니다. 매시간 자동 갱신됩니다.
          </p>
        </div>

        {/* 모바일 사이드바 */}
        <div className="lg:hidden space-y-6">
          <Sidebar />
          <RightSidebar />
        </div>
      </main>
      <aside className="hidden lg:block">
        <RightSidebar />
      </aside>
    </div>
  );
}


