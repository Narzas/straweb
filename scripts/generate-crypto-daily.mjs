#!/usr/bin/env node
/**
 * 매일 크립토 데이터를 수집해 Supabase crypto_daily 테이블에 저장합니다.
 * 실행: node scripts/generate-crypto-daily.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local 수동 파싱 (로컬 개발용, 없으면 무시)
try {
  const envPath = resolve(__dirname, "../.env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
} catch { /* CI 환경에서는 Secrets로 주입됨 */ }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── 유틸 ─────────────────────────────────────────────────────────────────────

async function translateToKorean(text) {
  if (!text?.trim()) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return text;
    const data = await res.json();
    return data[0].map((seg) => seg[0]).join("") || text;
  } catch {
    return text;
  }
}

async function safeFetch(url, headers = {}, timeoutMs = 10_000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CryptoBriefBot/1.0", ...headers },
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    clearTimeout(tid);
    console.warn(`  [skip] ${url} — ${e.message}`);
    return null;
  }
}

function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
  for (const block of itemBlocks) {
    const get = (tag) => {
      const m =
        block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")) ||
        block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };
    const imgMatch = block.match(/media:content[^>]+url="([^"]+)"/i);
    const linkMatch = block.match(/<link>(?:<!\[CDATA\[)?(https?:\/\/[^\]<]+)/i);
    items.push({
      title: get("title"),
      url: linkMatch ? linkMatch[1].split("?")[0] : "",
      description: get("description").replace(/<[^>]+>/g, "").slice(0, 200).trim(),
      image: imgMatch ? imgMatch[1] : null,
      pubDate: get("pubDate"),
    });
  }
  return items;
}

// ── 추가 지표 ─────────────────────────────────────────────────────────────────

async function fetchMarketsTop250() {
  // top 250 by market cap, 24h + 7d — used for altcoin season + gainers/losers (1 CoinGecko call)
  const res = await safeFetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h,7d"
  );
  if (!res) return null;
  try {
    const coins = await res.json();
    return Array.isArray(coins) && coins.length ? coins : null;
  } catch { return null; }
}

function calcAltcoinSeason(coins) {
  if (!coins || coins.length < 10) return null;
  const btc = coins.find((c) => c.id === "bitcoin");
  const btc7d = btc?.price_change_percentage_7d_in_currency;
  if (btc7d == null) return null;
  const alts = coins.filter((c) => c.id !== "bitcoin");
  const outperformed = alts.filter(
    (c) => (c.price_change_percentage_7d_in_currency ?? -Infinity) > btc7d
  );
  return Math.round((outperformed.length / alts.length) * 100);
}

function calcGainersLosers(coins) {
  if (!coins || !coins.length) return null;
  const sorted = coins
    .filter((c) => c.price_change_percentage_24h != null)
    .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  const mapItem = (c) => ({
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    current_price: c.current_price ?? 0,
    price_change_percentage_24h: c.price_change_percentage_24h,
    image: c.image ?? null,
  });
  return {
    gainers: sorted.slice(0, 5).map(mapItem),
    losers: sorted.slice(-5).reverse().map(mapItem),
  };
}

async function fetchLongShortRatio() {
  try {
    const res = await safeFetch(
      "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1d&limit=1"
    );
    if (!res) return null;
    const data = await res.json();
    const longPct = parseFloat(data[0]?.longAccount);
    if (isNaN(longPct)) return null;
    return Math.round(longPct * 100);
  } catch {
    return null;
  }
}

async function fetchSmartMoneyNetflows() {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) return null;

  const callNetflow = async (direction) => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch("https://api.nansen.ai/api/v1/smart-money/netflow", {
        method: "POST",
        headers: { apiKey, "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          chains: ["ethereum", "solana", "base"],
          filters: { include_stablecoins: false },
          pagination: { page: 1, per_page: 8 },
          order_by: [{ field: "net_flow_24h_usd", direction }],
        }),
      });
      clearTimeout(tid);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? [])
        .filter((r) => r.token_symbol && r.net_flow_24h_usd !== 0)
        .slice(0, 8)
        .map((r) => ({
          chain: r.chain,
          token_symbol: r.token_symbol,
          token_address: r.token_address,
          net_flow_24h_usd: r.net_flow_24h_usd,
          net_flow_7d_usd: r.net_flow_7d_usd ?? null,
          price_usd: r.price_usd ?? null,
          smart_money_inflow_24h: r.smart_money_inflow_24h_usd ?? null,
          smart_money_outflow_24h: r.smart_money_outflow_24h_usd ?? null,
        }));
    } catch (e) {
      clearTimeout(tid);
      return [];
    }
  };

  try {
    const [acc, dist] = await Promise.all([callNetflow("DESC"), callNetflow("ASC")]);
    const seen = new Set();
    const merged = [];
    for (const item of [...acc, ...dist]) {
      const key = `${item.chain}-${item.token_address}`;
      if (!seen.has(key)) { seen.add(key); merged.push(item); }
    }
    return merged.length ? merged : null;
  } catch (e) {
    console.warn("  스마트머니 넷플로우 수집 실패:", e.message);
    return null;
  }
}

async function fetchBtcEtfFlows() {
  // IBIT, FBTC, GBTC, ARKB, BITB — top BTC spot ETFs
  const symbols = ["IBIT", "FBTC", "GBTC", "ARKB", "BITB"];
  const res = await safeFetch(
    `https://query2.finance.yahoo.com/v8/finance/chart/${symbols[0]}?interval=1d&range=5d`,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "application/json" } }
  );
  const allRes = await Promise.all(
    symbols.map((s) =>
      safeFetch(`https://query2.finance.yahoo.com/v8/finance/chart/${s}?interval=1d&range=3d`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "application/json" },
      })
        .then((r) => r?.json())
        .catch(() => null)
    )
  );
  try {
    const etfs = [];
    for (let i = 0; i < symbols.length; i++) {
      const j = allRes[i];
      const result = j?.chart?.result?.[0];
      if (!result) continue;
      const meta = result.meta;
      const quotes = result.indicators?.quote?.[0];
      const closes = quotes?.close ?? [];
      const volumes = quotes?.volume ?? [];
      const latestPrice = closes[closes.length - 1];
      const prevPrice = closes[closes.length - 2];
      const latestVol = volumes[volumes.length - 1];
      if (!latestPrice) continue;
      const changePct = prevPrice ? ((latestPrice - prevPrice) / prevPrice) * 100 : null;
      etfs.push({
        symbol: symbols[i],
        price_usd: latestPrice,
        change_pct_1d: changePct != null ? Math.round(changePct * 100) / 100 : null,
        volume_usd: latestVol ? Math.round(latestVol * latestPrice) : null,
      });
    }
    return etfs.length ? etfs : null;
  } catch (e) {
    console.warn("  BTC ETF 파싱 오류:", e.message);
    return null;
  }
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 2) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 10) / 10;
}

function resampleCloses(prices, intervalHours) {
  const ms = intervalHours * 3600000;
  const buckets = new Map();
  for (const [t, c] of prices) {
    const key = Math.floor(t / ms);
    buckets.set(key, c);
  }
  return [...buckets.keys()].sort((a, b) => a - b).map((k) => buckets.get(k));
}

async function fetchRsiHeatmap() {
  // Binance 전체 USDT 스팟 심볼 동적 취득 → RSI 정렬로 과매수/과매도 추출
  const infoRes = await safeFetch("https://api.binance.com/api/v3/exchangeInfo", {}, 30_000);
  if (!infoRes) return null;
  const infoData = await infoRes.json();
  const symbols = infoData.symbols
    .filter((s) => s.quoteAsset === "USDT" && s.status === "TRADING")
    .map((s) => s.symbol);
  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const res = await safeFetch(
          `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=4h&limit=700`,
          {},
          20_000
        );
        if (!res) return null;
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length < 30) return null;
        const c4h = klines.map((k) => parseFloat(k[4]));
        const c1d = c4h.filter((_, i) => (i + 1) % 6 === 0);
        const c1w = c4h.filter((_, i) => (i + 1) % 42 === 0);
        const label = sym.replace("USDT", "");
        return {
          symbol: label,
          rsi_4h: calcRSI(c4h),
          rsi_1d: calcRSI(c1d),
          rsi_1w: calcRSI(c1w),
        };
      } catch {
        return null;
      }
    })
  );
  const valid = results.filter((r) => r && r.rsi_4h != null);
  if (!valid.length) return null;
  const overbought = valid.filter((r) => r.rsi_4h >= 70).sort((a, b) => b.rsi_4h - a.rsi_4h).slice(0, 8);
  const oversold   = valid.filter((r) => r.rsi_4h <= 30).sort((a, b) => a.rsi_4h - b.rsi_4h).slice(0, 8);
  return { overbought, oversold };
}

async function fetchCoinCategories() {
  const res = await safeFetch(
    "https://api.coingecko.com/api/v3/coins/categories?order=market_cap_change_24h_desc"
  );
  if (!res) return null;
  try {
    const json = await res.json();
    if (!Array.isArray(json) || !json.length) return null;
    return json
      .filter((c) => c.market_cap_change_24h != null)
      .map((c) => ({
        id: String(c.id),
        name: c.name,
        market_cap_change_24h: c.market_cap_change_24h ?? 0,
        volume_24h: c.volume_24h ?? null,
      }));
  } catch {
    return null;
  }
}

async function fetchPredictionMarkets() {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) return null;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch("https://api.nansen.ai/api/v1/prediction-market/market-screener", {
      method: "POST",
      headers: { apiKey, "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        status: "active",
        tags: ["Crypto"],
        pagination: { page: 1, per_page: 5 },
        order_by: [{ field: "volume", direction: "DESC" }],
        min_volume_24hr: 1000,
      }),
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const json = await res.json();
    const rows = json.data ?? [];
    return rows.slice(0, 5).map((r) => ({
      market_id: r.market_id ?? r.id,
      question: r.question ?? r.title,
      yes_price: r.yes_price ?? r.last_trade_price ?? r.outcome_prices?.[0] ?? null,
      volume_24hr: r.volume_24hr,
      total_volume: r.total_volume ?? r.volume,
      end_date: r.end_date ?? r.end_date_iso ?? null,
      platform: r.platform ?? "Polymarket",
      market_url: r.market_url ?? r.url ?? (r.slug ? `https://polymarket.com/event/${r.slug}` : null),
    }));
  } catch (e) {
    clearTimeout(tid);
    console.warn("  예측 시장 수집 실패:", e.message);
    return null;
  }
}

async function fetchHyperliquidPerps() {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) return null;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const now = new Date();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);
    const toDate = now.toISOString().slice(0, 10);
    const fromDate = yesterday.toISOString().slice(0, 10);
    const res = await fetch("https://api.nansen.ai/api/v1/perp-screener", {
      method: "POST",
      headers: { apiKey, "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        date: { from: fromDate, to: toDate },
        pagination: { page: 1, per_page: 12 },
        order_by: [{ field: "volume", direction: "DESC" }],
      }),
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const json = await res.json();
    const rows = json.data ?? [];
    return rows
      .filter((r) => !r.token_symbol?.startsWith("xyz:") && r.token_symbol)
      .slice(0, 8)
      .map((r) => ({
        token_symbol: r.token_symbol,
        volume: r.volume,
        buy_volume: r.buy_volume ?? null,
        sell_volume: r.sell_volume ?? null,
        buy_sell_ratio: r.buy_volume && r.sell_volume
          ? Math.round((r.buy_volume / (r.buy_volume + r.sell_volume)) * 100)
          : null,
        buy_sell_pressure: r.buy_sell_pressure ?? null,
        funding_rate: r.funding ?? null,
        open_interest: r.open_interest ?? null,
        mark_price: r.mark_price ?? null,
      }));
  } catch (e) {
    clearTimeout(tid);
    console.warn("  하이퍼리퀴드 퍼프 수집 실패:", e.message);
    return null;
  }
}



// ── 데이터 수집 ───────────────────────────────────────────────────────────────

async function fetchAll() {
  console.log("데이터 수집 중...");

  const [globalRes, trendingRes, marketsRes, ctRes, fngRes, dexRes] = await Promise.all([
    safeFetch("https://api.coingecko.com/api/v3/global"),
    safeFetch("https://api.coingecko.com/api/v3/search/trending"),
    safeFetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,bnb,xrp&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d"
    ),
    safeFetch("https://cointelegraph.com/rss"),
    safeFetch("https://api.alternative.me/fng/?limit=1"),
    safeFetch("https://api.llama.fi/v2/chains"),   // chain list
  ]);

  const global_ = globalRes ? await globalRes.json() : null;
  const trending = trendingRes ? await trendingRes.json() : null;
  const markets = marketsRes ? await marketsRes.json() : null;
  const fngRaw = fngRes ? await fngRes.json() : null;
  const dexRaw = dexRes ? await dexRes.json() : null;

  // CoinTelegraph RSS 파싱 + 번역
  let news = [];
  if (ctRes) {
    const xml = await ctRes.text();
    const raw = parseRssItems(xml).slice(0, 8);
    console.log("  뉴스 번역 중...");
    news = await Promise.all(
      raw.map(async (item) => ({
        ...item,
        title: await translateToKorean(item.title),
        description: item.description ? await translateToKorean(item.description) : item.description,
      }))
    );
  }

  // 공포·탐욕 지수
  const FNG_KO = {
    "Extreme Fear": "극도의 공포",
    "Fear": "공포",
    "Neutral": "중립",
    "Greed": "탐욕",
    "Extreme Greed": "극도의 탐욕",
  };
  const fngItem = fngRaw?.data?.[0] ?? null;
  const fearGreed = fngItem
    ? {
        value: parseInt(fngItem.value, 10),
        classification: fngItem.value_classification,
        classification_ko: FNG_KO[fngItem.value_classification] ?? fngItem.value_classification,
      }
    : null;

  // 체인별 TVL 24h 자금 흐름 — 히스토리 데이터로 직접 계산
  const topChainNames = (dexRaw ?? [])
    .filter((c) => c.tvl > 1_000_000_000)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 10)
    .map((c) => c.name);

  const histResList = await Promise.all(
    topChainNames.map((name) =>
      safeFetch(`https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(name)}`, {}, 25_000)
    )
  );

  const dexChains = [];
  for (let i = 0; i < topChainNames.length; i++) {
    if (!histResList[i]) continue;
    const hist = await histResList[i].json();
    if (!Array.isArray(hist) || hist.length < 2) continue;
    const prev = hist[hist.length - 2].tvl;
    const curr = hist[hist.length - 1].tvl;
    if (!prev) continue;
    const flow_usd = curr - prev;
    const change_1d = ((curr - prev) / prev) * 100;
    dexChains.push({ chain: topChainNames[i], tvl: curr, change_1d, flow_usd });
  }
  dexChains.sort((a, b) => Math.abs(b.flow_usd) - Math.abs(a.flow_usd));

  // top 250 (1 CoinGecko call) → altcoin season + gainers/losers
  const marketsTop250 = await fetchMarketsTop250();
  const altcoinSeason = calcAltcoinSeason(marketsTop250);
  const gainersLosers = calcGainersLosers(marketsTop250);

  const [longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, btcEtfFlows] = await Promise.all([
    fetchLongShortRatio(),
    fetchSmartMoneyNetflows(),
    fetchPredictionMarkets(),
    fetchHyperliquidPerps(),
    fetchCoinCategories(),
    fetchBtcEtfFlows(),
  ]);
  // RSI는 순차 호출(CoinGecko rate limit)
  const rsiHeatmap = await fetchRsiHeatmap();

  // 예측시장 질문 한국어 번역
  if (predictionMarkets?.length) {
    for (const p of predictionMarkets) {
      p.question = await translateToKorean(p.question);
    }
  }

  console.log(`  알트코인 시즌: ${altcoinSeason}, 롱/숏: ${longShortRatio}, 넷플로우: ${netflows?.length ?? 0}개, 예측시장: ${predictionMarkets?.length ?? 0}개, 하이퍼리퀴드: ${hyperliquidPerps?.length ?? 0}개, 섹터: ${coinCategories?.length ?? 0}개, ETF: ${btcEtfFlows ? "✓" : "✗"}, RSI 과매수: ${rsiHeatmap?.overbought?.length ?? 0}개, 과매도: ${rsiHeatmap?.oversold?.length ?? 0}개, 급등: ${gainersLosers?.gainers?.length ?? 0}개, 급락: ${gainersLosers?.losers?.length ?? 0}개`);

  // 시장 요약
  const gd = global_?.data ?? null;
  const market = gd
    ? {
        total_market_cap_usd: gd.total_market_cap?.usd ?? null,
        market_cap_change_24h: gd.market_cap_change_percentage_24h_usd ?? null,
        btc_dominance: gd.market_cap_percentage?.btc ?? null,
        eth_dominance: gd.market_cap_percentage?.eth ?? null,
        active_cryptocurrencies: gd.active_cryptocurrencies ?? null,
        coins: markets ?? [],
      }
    : null;

  // 트렌딩 정리
  const trendingCoins = (trending?.coins ?? []).slice(0, 7).map((e) => ({
    name: e.item.name,
    symbol: e.item.symbol,
    market_cap_rank: e.item.market_cap_rank ?? null,
    thumb: e.item.thumb ?? null,
  }));

  return { market, trending: trendingCoins, fearGreed, dexChains, news, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, btcEtfFlows, rsiHeatmap, gainersLosers };
}

// ── 편집 코멘트 생성 (룰 기반) ───────────────────────────────────────────────

function generateEditorial({ market, trending, fearGreed, dexChains, news, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, btcEtfFlows, rsiHeatmap, gainersLosers }) {
  const change = market?.market_cap_change_24h;
  const btcDom = market?.btc_dominance;
  const coins = market?.coins ?? [];

  // 시장 심리 판단
  let sentiment, sentimentDetail;
  if (change == null) {
    sentiment = "데이터 없음";
    sentimentDetail = "오늘 시장 데이터를 불러오지 못했습니다.";
  } else if (change >= 5) {
    sentiment = "강한 상승장";
    sentimentDetail = `전체 시장이 ${change.toFixed(1)}% 급등했습니다. 강한 매수세가 유입되고 있습니다.`;
  } else if (change >= 2) {
    sentiment = "상승세";
    sentimentDetail = `전체 시장이 ${change.toFixed(1)}% 올랐습니다. 긍정적인 흐름이 이어지고 있습니다.`;
  } else if (change >= 0) {
    sentiment = "보합 상승";
    sentimentDetail = `전체 시장이 소폭 ${change.toFixed(1)}% 상승했습니다. 방향성을 탐색하는 분위기입니다.`;
  } else if (change >= -2) {
    sentiment = "보합 하락";
    sentimentDetail = `전체 시장이 소폭 ${Math.abs(change).toFixed(1)}% 하락했습니다. 관망세가 우세합니다.`;
  } else if (change >= -5) {
    sentiment = "하락세";
    sentimentDetail = `전체 시장이 ${Math.abs(change).toFixed(1)}% 내렸습니다. 매도 압력이 커지고 있습니다.`;
  } else {
    sentiment = "강한 하락장";
    sentimentDetail = `전체 시장이 ${Math.abs(change).toFixed(1)}% 급락했습니다. 강한 매도세가 나타나고 있습니다.`;
  }

  // BTC 도미넌스 해석
  let marketComment = null;
  if (btcDom != null) {
    if (btcDom >= 58)
      marketComment = `BTC 도미넌스 ${btcDom.toFixed(1)}% — 비트코인이 시장을 독주하는 전형적인 BTC 시즌입니다.`;
    else if (btcDom >= 52)
      marketComment = `BTC 도미넌스 ${btcDom.toFixed(1)}% — 비트코인 우세 장세, 알트코인은 상대적으로 부진합니다.`;
    else if (btcDom >= 47)
      marketComment = `BTC 도미넌스 ${btcDom.toFixed(1)}% — BTC·알트 균형 구간, 자금이 고르게 분산되어 있습니다.`;
    else
      marketComment = `BTC 도미넌스 ${btcDom.toFixed(1)}% — 알트코인에 자금이 쏠리는 알트 시즌 신호입니다.`;
  }

  // 주요 코인 흐름
  const upCoins = coins.filter((c) => c.price_change_percentage_24h > 0);
  const downCoins = coins.filter((c) => c.price_change_percentage_24h < 0);
  let coinComment = null;
  if (coins.length > 0) {
    if (upCoins.length === coins.length)
      coinComment = `주요 코인 ${coins.length}개 모두 상승 — 전반적인 매수 분위기가 형성됐습니다.`;
    else if (downCoins.length === coins.length)
      coinComment = `주요 코인 ${coins.length}개 모두 하락 — 전반적인 위험 회피 심리가 우세합니다.`;
    else {
      const btc = coins.find((c) => c.id === "bitcoin");
      const eth = coins.find((c) => c.id === "ethereum");
      if (btc && eth) {
        const btcUp = btc.price_change_percentage_24h > 0;
        const ethUp = eth.price_change_percentage_24h > 0;
        if (btcUp && !ethUp)
          coinComment = `BTC 상승, ETH 하락 — 비트코인 단독 강세가 나타나고 있습니다.`;
        else if (!btcUp && ethUp)
          coinComment = `ETH 상승, BTC 하락 — 이더리움 중심의 알트 흐름이 감지됩니다.`;
        else
          coinComment = `${upCoins.length}개 상승, ${downCoins.length}개 하락 — 종목별 차별화 장세입니다.`;
      } else {
        coinComment = `${upCoins.length}개 상승, ${downCoins.length}개 하락 — 혼조세가 이어지고 있습니다.`;
      }
    }
  }

  // 트렌딩 코멘트
  let trendingComment = null;
  if (trending?.length > 0) {
    const top3 = trending.slice(0, 3).map((c) => c.name).join(", ");
    trendingComment = `${top3} 등이 검색 상위권 — 시장의 관심이 집중된 종목들입니다.`;
  }

  // 체인 자금 흐름 코멘트
  let dexComment = null;
  if (dexChains?.length > 0) {
    const inflows = dexChains.filter((c) => c.flow_usd > 0).sort((a, b) => b.flow_usd - a.flow_usd);
    const outflows = dexChains.filter((c) => c.flow_usd < 0).sort((a, b) => a.flow_usd - b.flow_usd);
    const topIn = inflows[0];
    const topOut = outflows[0];
    if (topIn && topOut) {
      const inAmt = Math.abs(topIn.flow_usd) >= 1e9
        ? `$${(Math.abs(topIn.flow_usd) / 1e9).toFixed(1)}B`
        : `$${(Math.abs(topIn.flow_usd) / 1e6).toFixed(0)}M`;
      dexComment = `${topIn.chain}에 ${inAmt} 유입 — 자금이 집중되고 있습니다. ${topOut.chain}은(는) 상대적으로 이탈 중.`;
    } else if (topIn) {
      dexComment = `${topIn.chain} 중심으로 온체인 자금 유입이 활발합니다.`;
    } else if (topOut) {
      dexComment = `전반적으로 온체인 자금 이탈 흐름이 감지됩니다.`;
    }
  }

  // 공포·탐욕 코멘트
  let fngComment = null;
  if (fearGreed != null) {
    const v = fearGreed.value;
    const label = fearGreed.classification_ko;
    if (v <= 25)
      fngComment = `공포·탐욕 지수 ${v} (${label}) — 시장 참여자들이 극도로 위축돼 있습니다. 과거 바닥권 신호일 수 있습니다.`;
    else if (v <= 45)
      fngComment = `공포·탐욕 지수 ${v} (${label}) — 투자 심리가 위축돼 있습니다. 신중한 접근이 필요합니다.`;
    else if (v <= 55)
      fngComment = `공포·탐욕 지수 ${v} (${label}) — 시장 심리가 균형 상태입니다. 방향성을 탐색 중입니다.`;
    else if (v <= 75)
      fngComment = `공포·탐욕 지수 ${v} (${label}) — 투자 심리가 낙관적입니다. 과열 여부를 주시해야 합니다.`;
    else
      fngComment = `공포·탐욕 지수 ${v} (${label}) — 시장이 극도로 과열돼 있습니다. 단기 조정 가능성에 유의하세요.`;
  }

  // 하이라이트 3개 선별
  const highlights = [marketComment, coinComment, dexComment].filter(Boolean).slice(0, 3);

  const summary = `${sentimentDetail}${btcDom != null ? ` BTC 도미넌스는 ${btcDom.toFixed(1)}%를 기록 중입니다.` : ""}`;

  return { sentiment, summary, highlights, market_comment: marketComment, coin_comment: coinComment, trending_comment: trendingComment, dex_comment: dexComment, fng_comment: fngComment, altcoin_season: altcoinSeason ?? null, long_short_ratio: longShortRatio ?? null, netflows: netflows ?? null, prediction_markets: predictionMarkets ?? null, hyperliquid_perps: hyperliquidPerps ?? null, coin_categories: coinCategories ?? null, btc_etf_flows: btcEtfFlows ?? null, rsi_heatmap: rsiHeatmap ?? null, gainers_losers: gainersLosers ?? null };
}

// ── RSI 차트 ──────────────────────────────────────────────────────────────────

function buildRsiChartUrl(rsiHm) {
  if (!rsiHm) return null;
  const { overbought = [], oversold = [] } = rsiHm;
  if (!overbought.length && !oversold.length) return null;

  // Merge & sort by RSI descending for left→right display
  const allCoins = [
    ...overbought.map((r) => ({ ...r, zone: "ob" })),
    ...oversold.map((r) => ({ ...r, zone: "os" })),
  ].sort((a, b) => b.rsi_4h - a.rsi_4h);

  const labels = allCoins.map((r) => r.symbol);
  const pointColors = allCoins.map((r) => {
    if (r.rsi_4h >= 80) return "#ef4444";
    if (r.rsi_4h >= 70) return "#fb923c";
    if (r.rsi_4h <= 20) return "#10b981";
    return "#34d399";
  });

  const config = {
    type: "scatter",
    data: {
      datasets: [{
        data: allCoins.map((r, i) => ({ x: i, y: r.rsi_4h })),
        backgroundColor: pointColors,
        borderColor: pointColors,
        pointRadius: 6,
        pointHoverRadius: 6,
      }],
    },
    options: {
      legend: { display: false },
      title: {
        display: true,
        text: "RSI Heatmap  ·  4h 기준",
        fontColor: "#e2e8f0",
        fontSize: 13,
        padding: 10,
      },
      annotation: {
        annotations: [
          {
            type: "box",
            xScaleID: "x-axis-1",
            yScaleID: "y-axis-1",
            xMin: -0.5,
            xMax: allCoins.length - 0.5,
            yMin: 70,
            yMax: 100,
            backgroundColor: "rgba(239,68,68,0.12)",
            borderWidth: 0,
          },
          {
            type: "box",
            xScaleID: "x-axis-1",
            yScaleID: "y-axis-1",
            xMin: -0.5,
            xMax: allCoins.length - 0.5,
            yMin: 0,
            yMax: 30,
            backgroundColor: "rgba(16,185,129,0.12)",
            borderWidth: 0,
          },
          {
            type: "line",
            mode: "horizontal",
            scaleID: "y-axis-1",
            value: 70,
            borderColor: "rgba(239,68,68,0.5)",
            borderWidth: 1,
            borderDash: [4, 4],
          },
          {
            type: "line",
            mode: "horizontal",
            scaleID: "y-axis-1",
            value: 30,
            borderColor: "rgba(16,185,129,0.5)",
            borderWidth: 1,
            borderDash: [4, 4],
          },
        ],
      },
      scales: {
        xAxes: [{
          id: "x-axis-1",
          type: "linear",
          ticks: {
            min: -0.5,
            max: allCoins.length - 0.5,
            stepSize: 1,
            callback: (v) => labels[v] ?? "",
            fontColor: "#94a3b8",
            fontSize: 10,
            maxRotation: 45,
            autoSkip: false,
          },
          gridLines: { display: false },
        }],
        yAxes: [{
          id: "y-axis-1",
          ticks: { min: 0, max: 100, stepSize: 10, fontColor: "#94a3b8", fontSize: 10 },
          gridLines: { color: "rgba(148,163,184,0.1)", zeroLineColor: "rgba(148,163,184,0.1)" },
        }],
      },
      plugins: {
        datalabels: { display: false },
      },
      layout: { padding: { top: 4, bottom: 4, left: 8, right: 8 } },
    },
  };

  const w = Math.max(500, allCoins.length * 40 + 80);
  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?c=${encoded}&backgroundColor=%231e293b&w=${w}&h=320`;
}

// ── 텔레그램 전송 ─────────────────────────────────────────────────────────────

async function sendTelegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) console.warn(`  텔레그램 오류 (${method}):`, json.description);
  return json;
}

async function sendTelegramBriefing(date, payload, editorial) {
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!chatId) return;

  const { market, fearGreed, trending, news } = payload;
  const coins = market?.coins ?? [];

  const SENTIMENT_EMOJI = {
    "강한 상승장": "🟢", "상승세": "📈", "보합 상승": "🔼",
    "보합 하락": "🔽", "하락세": "📉", "강한 하락장": "🔴",
  };
  const emoji = SENTIMENT_EMOJI[editorial.sentiment] ?? "⚪";

  const [y, m, d] = date.split("-");
  const dateLabel = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hh = String(nowKST.getUTCHours()).padStart(2, "0");
  const mm = String(nowKST.getUTCMinutes()).padStart(2, "0");
  const timeLabel = `${hh}:${mm} KST`;

  const mkBar = (v, max) => { const f = Math.round((v / max) * 10); return "▓".repeat(Math.min(10, f)) + "░".repeat(Math.max(0, 10 - f)); };
  const fngVal = fearGreed?.value ?? null;
  const fngLabel = fearGreed?.classification_ko ?? "–";
  const fngBar = fngVal != null ? `<code>${mkBar(fngVal, 100)}</code> <b>${fngVal}</b> ${fngLabel}` : "–";
  const altSVal = editorial.altcoin_season;
  const altSBar = altSVal != null ? `<code>${mkBar(altSVal, 100)}</code> <b>${altSVal}</b> ${altSVal >= 75 ? "알트시즌" : altSVal >= 50 ? "알트우세" : altSVal >= 25 ? "BTC우세" : "BTC독주"}` : "–";
  const lsVal = editorial.long_short_ratio;
  const lsBar = lsVal != null ? `<code>${mkBar(lsVal, 100)}</code> <b>${lsVal}%</b> ${lsVal >= 55 ? "롱과열" : lsVal <= 45 ? "숏과열" : "균형"}` : "–";

  const fmtPrice = (n) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 주요 코인
  const coinLines = coins.slice(0, 6).map((c) => {
    const chg = c.price_change_percentage_24h;
    const blocks = Math.min(8, Math.round(Math.abs(chg)));
    const bar = (chg >= 0 ? "▲" : "▼") + "▓".repeat(blocks) + "░".repeat(8 - blocks);
    const sym = c.symbol.toUpperCase().padEnd(5);
    return `<code>${sym} ${bar} ${(chg >= 0 ? "+" : "") + chg.toFixed(1) + "%"}</code>  ${fmtPrice(c.current_price)}`;
  }).join("\n");

  // 트렌딩 — CoinGecko 24h 검색량 기준 상위 코인
  const rankBadge = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const trendingLine = (trending ?? []).slice(0, 5).map((c, i) => `  ${rankBadge[i]} ${c.name} <b>${c.symbol.toUpperCase()}</b>`).join("\n");

  // 섹터 — CoinGecko 테마별 카테고리 시총 24h 변동 (DeFi·GameFi·AI 등)
  const sectorLines = (editorial.coin_categories ?? [])
    .sort((a, b) => b.market_cap_change_24h - a.market_cap_change_24h)
    .slice(0, 5)
    .map((s) => {
      const v = s.market_cap_change_24h;
      const blocks = Math.min(8, Math.round(Math.abs(v)));
      const bar = (v >= 0 ? "▲" : "▼") + " " + "▓".repeat(blocks) + "░".repeat(8 - blocks);
      return `<code>${bar}  ${(v >= 0 ? "+" : "") + v.toFixed(1) + "%"}  ${s.name}</code>`;
    }).join("\n");

  // 급등/급락 TOP 5
  const glData = editorial.gainers_losers;
  const rankBadge2 = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const gainersLosersLines = glData
    ? `🚀 <b>급등 TOP 5</b>\n` +
      glData.gainers.map((c, i) => `  ${rankBadge2[i]} <b>${c.symbol}</b> ${c.name}  <b>+${c.price_change_percentage_24h.toFixed(1)}%</b>`).join("\n") +
      `\n\n💥 <b>급락 TOP 5</b>\n` +
      glData.losers.map((c, i) => `  ${rankBadge2[i]} <b>${c.symbol}</b> ${c.name}  <b>${c.price_change_percentage_24h.toFixed(1)}%</b>`).join("\n")
    : null;

  // RSI 히트맵 — 과매수/과매도
  const rsiHm = editorial.rsi_heatmap;
  function rsiLabel(v) {
    if (v == null) return "—";
    return String(v);
  }
  const fmtRsiRow = (r, isOverbought) => {
    const filled = Math.min(5, Math.round(r.rsi_4h / 20));
    const dot = isOverbought ? "🟥" : "🟩";
    const bar = dot.repeat(filled) + "⬜".repeat(5 - filled);
    const sym = r.symbol.padEnd(6);
    const num = String(r.rsi_4h).padStart(3);
    return `<code>${sym}</code>${bar}<code>${num}</code>`;
  };
  const rsiBar = rsiHm
    ? [
        rsiHm.overbought?.length
          ? `🔴 <b>과매수</b>\n` + rsiHm.overbought.slice(0, 5).map((r) => fmtRsiRow(r, true)).join("\n")
          : null,
        rsiHm.oversold?.length
          ? `🟢 <b>과매도</b>\n` + rsiHm.oversold.slice(0, 5).map((r) => fmtRsiRow(r, false)).join("\n")
          : null,
      ].filter(Boolean).join("\n")
    : null;

  // 스마트머니 상위 5개
  const netflowLines = (editorial.netflows ?? [])
    .sort((a, b) => Math.abs(b.net_flow_24h_usd) - Math.abs(a.net_flow_24h_usd))
    .slice(0, 5)
    .map((n) => {
      const v = n.net_flow_24h_usd;
      const abs = Math.abs(v);
      const amt = abs >= 1e6 ? `$${(abs/1e6).toFixed(1)}M` : `$${(abs/1e3).toFixed(0)}K`;
      const arrow = v >= 0 ? "🟢▲" : "🔴▼";
      return `  ${arrow} <b>${n.token_symbol}</b>  ${amt}  <i>${n.chain}</i>`;
    }).join("\n");

  // 예측시장 — Polymarket·Nansen 상위 5개
  const stripDash = (s) => s ? s.replace(/^[^—]*—\s*/, "") : s;
  const fmtPred = (p) => {
    const yesPct = p.yes_price != null ? Math.round(p.yes_price * 100) : null;
    const q = p.question.length > 44 ? p.question.slice(0, 44) + "…" : p.question;
    if (yesPct != null) {
      const noPct = 100 - yesPct;
      const filled = Math.min(5, Math.round(yesPct / 20));
      const bar = "🟩".repeat(filled) + "🟥".repeat(5 - filled);
      return `  • ${q}\n  <b>${yesPct}%</b> ${bar} <b>${noPct}%</b>`;
    }
    return `  • ${q}`;
  };
  const allPreds = (editorial.prediction_markets ?? []).slice(0, 5);
  const predLines = allPreds.length ? allPreds.map(fmtPred).join("\n") : null;

  const sections = [
    `${emoji} <b>크립토 브리핑</b>  <i>${dateLabel} ${timeLabel}</i>`,
    `<b>${editorial.sentiment}</b>\n${editorial.summary.replace(/\.\s+/g, ".\n")}`,
    `\n📊 <b>시장 지표</b>`,
    `😨 공포·탐욕  ${fngBar}`,
    `🌡️ 알트시즌    ${altSBar}`,
    `⚖️ 롱비율      ${lsBar}`,
    editorial.fng_comment ? `<i>${stripDash(editorial.fng_comment)}</i>` : null,
    coinLines ? `\n💰 <b>주요 코인</b>\n${coinLines}` : null,
    editorial.coin_comment ? `<i>${stripDash(editorial.coin_comment)}</i>` : null,
    trendingLine ? `\n🔥 <b>트렌딩 코인</b> <i>(24h 검색량)</i>\n${trendingLine}` : null,
    editorial.trending_comment ? `<i>${stripDash(editorial.trending_comment)}</i>` : null,
    gainersLosersLines ? `\n${gainersLosersLines}` : null,
    sectorLines ? `\n🏷️ <b>섹터별 성과</b>\n${sectorLines}` : null,
    rsiBar ? `\n📈 <b>RSI 히트맵</b> <i>(4h)</i>\n${rsiBar}` : null,
    netflowLines ? `\n🧠 <b>스마트머니 넷플로우</b>\n${netflowLines}` : null,
    editorial.dex_comment ? `\n🌐 <b>온체인 자금흐름</b>\n<i>${stripDash(editorial.dex_comment)}</i>` : null,
    predLines ? `\n🎯 <b>예측시장</b>\n${predLines}` : null,
    `\n<a href="https://stragos.xyz/crypto">➡️ 전체 브리핑 보기</a>`,
    `🔄 <i>매일 06·12·18·00시 업데이트 (KST)</i>`,
  ].filter((l) => l !== null).join("\n");

  // 4096자 제한
  const text = sections.length > 4096 ? sections.slice(0, 4093) + "..." : sections;

  await sendTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });


  console.log("  텔레그램 전송 완료");
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const date = kst.toISOString().slice(0, 10); // YYYY-MM-DD

  const isDryRun = process.argv.includes("--dry-run");

  const payload = await fetchAll();
  const editorial = generateEditorial(payload);
  const { altcoinSeason: _as, longShortRatio: _ls, netflows: _nf, predictionMarkets: _pm, hyperliquidPerps: _hp, coinCategories: _cc, btcEtfFlows: _ef, rsiHeatmap: _rsi, gainersLosers: _gl, ...dbPayload } = payload;

  if (isDryRun) {
    console.log("[dry-run] DB 저장 및 텔레그램 전송 생략");
    process.exit(0);
  }

  const { error } = await sb.from("crypto_daily").upsert(
    { date, ...dbPayload, editorial },
    { onConflict: "date" }
  );

  if (error) {
    console.error("Supabase 저장 실패:", error.message);
    process.exit(1);
  }

  console.log(`✓ 저장 완료: ${date}`);
  await sendTelegramBriefing(date, payload, editorial);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
