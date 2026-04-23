#!/usr/bin/env node
/**
 * 매일 크립토 데이터를 수집해 Supabase crypto_daily 테이블에 저장합니다.
 * 실행: node scripts/generate-crypto-daily.mjs
 */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

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

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function translateBatch(texts) {
  const entries = texts
    .map((t, i) => ({ i, t }))
    .filter((x) => x.t?.trim());
  if (!entries.length) return texts;

  // 번역할 텍스트를 임시 파일에 저장
  const tmpFile = join(tmpdir(), `translate-${Date.now()}.json`);
  writeFileSync(tmpFile, JSON.stringify(entries.map((x) => x.t), null, 2));

  try {
    let translated;

    if (anthropic) {
      // Claude API로 배치 번역
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: `다음 JSON 배열의 영어 텍스트를 한국어로 번역해줘. 크립토/금융 전문용어는 그대로 유지해. 번역 결과만 동일한 순서의 JSON 배열로 반환해 (다른 텍스트 없이):\n${JSON.stringify(entries.map((x) => x.t))}`,
        }],
      });
      const rawText = response.content[0].text;
      const stripped = rawText.replace(/^```[^\n]*\n?|\n?```$/g, "").trim();
      const arrMatch = stripped.match(/\[[\s\S]*\]/);
      try {
        translated = JSON.parse(arrMatch ? arrMatch[0] : stripped);
      } catch {
        // Claude 응답 파싱 실패 시 Google Translate 폴백
        console.warn("[translateBatch] Claude 응답 파싱 실패, Google Translate로 폴백");
        translated = await Promise.all(
          entries.map(async ({ t }) => {
            try {
              const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(t)}`;
              const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
              if (!res.ok) return t;
              const data = await res.json();
              return data[0].map((seg) => seg[0]).join("") || t;
            } catch { return t; }
          })
        );
      }
    } else {
      // Fallback: Google Translate 개별 호출
      translated = await Promise.all(
        entries.map(async ({ t }) => {
          try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(t)}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
            if (!res.ok) return t;
            const data = await res.json();
            return data[0].map((seg) => seg[0]).join("") || t;
          } catch { return t; }
        })
      );
    }

    const result = [...texts];
    entries.forEach(({ i }, idx) => { result[i] = translated[idx] ?? texts[i]; });
    return result;
  } catch (e) {
    console.warn(`[translateBatch] 번역 실패, 원본 텍스트 유지: ${e.message}`);
    return texts;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
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
  // OKX (globally accessible, no geo-block)
  try {
    const res = await safeFetch(
      "https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio-contract?instId=BTC-USDT-SWAP&period=1D&limit=1"
    );
    if (res) {
      const data = await res.json();
      const ratio = parseFloat(data?.data?.[0]?.[1]);
      if (!isNaN(ratio) && ratio > 0) return Math.round((ratio / (1 + ratio)) * 100);
    }
  } catch {}

  // Fallback: Binance
  try {
    const res = await safeFetch(
      "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1d&limit=1"
    );
    if (res) {
      const data = await res.json();
      const longPct = parseFloat(data[0]?.longAccount);
      if (!isNaN(longPct)) return Math.round(longPct * 100);
    }
  } catch {}

  // Fallback: Bybit
  try {
    const res = await safeFetch(
      "https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=1d&limit=1"
    );
    if (res) {
      const data = await res.json();
      const buyRatio = parseFloat(data?.result?.list?.[0]?.buyRatio);
      if (!isNaN(buyRatio)) return Math.round(buyRatio * 100);
    }
  } catch {}

  return null;
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
        .filter((r) => r.token_symbol && Math.abs(r.net_flow_24h_usd) >= 10_000)
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
  // OKX 거래량 상위 100개 USDT 스팟 심볼 취득 (US 서버 geo-block 없음)
  const tickersRes = await safeFetch(
    "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
    {},
    15_000
  );
  if (!tickersRes) return null;
  const tickersData = await tickersRes.json();
  if (tickersData.code !== "0" || !Array.isArray(tickersData.data)) return null;

  const symbols = tickersData.data
    .filter((t) => t.instId.endsWith("-USDT"))
    .sort((a, b) => parseFloat(b.volCcy24h) - parseFloat(a.volCcy24h))
    .slice(0, 100)
    .map((t) => t.instId);

  // 배치 처리 (동시 10개씩, 배치 간 300ms 대기)
  const BATCH = 10;
  const results = [];
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(async (instId) => {
        try {
          const res = await safeFetch(
            `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=4H&limit=300`,
            {},
            15_000
          );
          if (!res) return null;
          const data = await res.json();
          if (data.code !== "0" || !Array.isArray(data.data) || data.data.length < 30) return null;
          // OKX klines: [ts, open, high, low, close, ...] — 최신이 먼저 → reverse
          const c4h = data.data.map((k) => parseFloat(k[4])).reverse();
          const c1d = c4h.filter((_, i) => (i + 1) % 6 === 0);
          const c1w = c4h.filter((_, i) => (i + 1) % 42 === 0);
          return {
            symbol: instId.replace("-USDT", ""),
            rsi_4h: calcRSI(c4h),
            rsi_1d: calcRSI(c1d),
            rsi_1w: calcRSI(c1w),
          };
        } catch {
          return null;
        }
      })
    );
    results.push(...batchResults);
    if (i + BATCH < symbols.length) await new Promise((r) => setTimeout(r, 1000));
  }

  const valid = results.filter((r) => r && r.rsi_4h != null);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => b.rsi_4h - a.rsi_4h);
  const overbought = sorted.slice(0, 5);
  const oversold   = [...valid].sort((a, b) => a.rsi_4h - b.rsi_4h).slice(0, 5);
  const all = sorted.slice(0, 80);
  return { overbought, oversold, all };
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
        pagination: { page: 1, per_page: 30 },
        order_by: [{ field: "volume", direction: "DESC" }],
        min_volume_24hr: 1000,
      }),
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const json = await res.json();
    const rows = json.data ?? [];
    // 상위 20개 풀에서 매 실행마다 5개 무작위 선택 (Fisher-Yates)
    const pool = [...rows];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const shuffled = pool.slice(0, 5);
    return shuffled.map((r) => ({
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



// ── 선물 스캐너 ───────────────────────────────────────────────────────────────

function scoreAndRank(rawResults) {
  const sorted = [...rawResults].sort((a, b) => b.volume4hUsd - a.volume4hUsd);
  const total = sorted.length;
  const scored = sorted.map((coin, idx) => {
    const volume4hRankPct = (idx + 1) / total;
    const fundingPct = coin.fundingRate * 100;
    const fundingSc = fundingPct >= 0 && fundingPct <= 0.01 ? 25
      : fundingPct > 0.01 && fundingPct <= 0.03 ? 12
      : fundingPct > 0.03 ? 0
      : fundingPct < 0 && fundingPct >= -0.03 ? 8 : 5;
    const priceUp   = coin.priceChange1h > 1;
    const priceDown = coin.priceChange1h < -1;
    const oiUp      = coin.oiChangePct > 3;
    const priceOiSc = (priceDown && oiUp) ? 30 : (priceUp && oiUp) ? 22 : (!priceUp && !priceDown && oiUp) ? 15 : (priceUp && !oiUp) ? 5 : 0;
    const volumeSc = volume4hRankPct <= 0.10 ? 20 : volume4hRankPct <= 0.25 ? 14 : volume4hRankPct <= 0.50 ? 7 : 0;
    const sideways = Math.abs(coin.priceChange4h) <= 2;
    const oiBuild  = coin.oiChangePct6h > 5;
    const volStart = coin.volumeSpike >= 1.3 && coin.volumeSpike <= 4;
    const timingSc = (sideways ? 5 : 0) + (oiBuild ? 10 : 0) + (volStart ? 5 : 0) + (sideways && oiBuild && volStart ? 5 : 0);
    const overheatP = (coin.priceChange1h > 8 ? 20 : 0) + (fundingPct > 0.03 ? 15 : 0) + (coin.volumeSpike > 5 ? 15 : 0);
    const riskP = !coin.marketCapUsd ? 5 : coin.marketCapUsd < 20_000_000 ? 20 : coin.marketCapUsd < 50_000_000 ? 5 : 0;
    return { ...coin, volume4hRankPct, score: fundingSc + priceOiSc + volumeSc + timingSc - overheatP - riskP };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 50);
}

async function fetchFuturesScannerOKX(marketsTop250) {
  console.log("  [선물 스캐너] OKX 데이터 수집 중...");

  const tickerRes = await safeFetch("https://www.okx.com/api/v5/market/tickers?instType=SWAP");
  if (!tickerRes) return null;
  const tickerJson = await tickerRes.json();

  const allTickers = (tickerJson.data ?? []).filter((t) => t.instId.endsWith("-USDT-SWAP"));
  if (!allTickers.length) return null;

  // 거래량 상위 150개만 선별 (펀딩비 개별 호출 최소화)
  const top150 = allTickers
    .sort((a, b) => parseFloat(b.volCcy24h ?? "0") - parseFloat(a.volCcy24h ?? "0"))
    .slice(0, 150);

  // 펀딩비 개별 조회 (25개씩 병렬)
  const fundingMap = new Map();
  const BATCH_FR = 25;
  for (let i = 0; i < top150.length; i += BATCH_FR) {
    const batch = top150.slice(i, i + BATCH_FR);
    const ress = await Promise.all(
      batch.map((t) => safeFetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${t.instId}`))
    );
    for (let j = 0; j < ress.length; j++) {
      if (!ress[j]) continue;
      const d = await ress[j].json();
      const item = d.data?.[0];
      if (item) fundingMap.set(batch[j].instId, parseFloat(item.fundingRate ?? "0"));
    }
  }

  const capMap = new Map();
  for (const coin of (marketsTop250 ?? [])) {
    if (coin.symbol) capMap.set(coin.symbol.toUpperCase(), coin.market_cap ?? null);
  }

  const candidates = top150
    .filter((t) => (fundingMap.get(t.instId) ?? 0) > 0)
    .map((t) => ({
      symbol: t.instId.replace(/-USDT-SWAP$/, ""),
      instId: t.instId,
      fundingRate: fundingMap.get(t.instId) ?? 0,
      markPrice: parseFloat(t.last ?? "0"),
    }));

  if (!candidates.length) { console.log("  [선물 스캐너] OKX 양수 펀딩비 없음"); return null; }
  console.log(`  [선물 스캐너] OKX 양수 펀딩비 ${candidates.length}개, 데이터 수집 중...`);

  const BATCH = 5;
  const rawResults = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    if (i > 0) await new Promise((r) => setTimeout(r, 300));
    const batch = candidates.slice(i, i + BATCH);
    const batchData = await Promise.all(
      batch.map(async (coin) => {
        try {
          const [klinesRes, oiRes] = await Promise.all([
            safeFetch(`https://www.okx.com/api/v5/market/candles?instId=${coin.instId}&bar=1H&limit=8`),
            safeFetch(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instType=SWAP&instId=${coin.instId}&period=1H&limit=7`),
          ]);
          if (!klinesRes) return null;

          const klinesJson = await klinesRes.json();
          // OKX: [ts,open,high,low,close,vol,volCcy,volCcyQuote,confirm], newest first → reverse
          const klines = (klinesJson.data ?? []).reverse();
          const lastComplete = klines[6];
          const candle4hAgo  = klines[3];
          if (!lastComplete) return null;

          const priceChange1h = parseFloat(lastComplete[1]) > 0
            ? ((parseFloat(lastComplete[4]) - parseFloat(lastComplete[1])) / parseFloat(lastComplete[1])) * 100
            : 0;
          const priceChange4h = candle4hAgo?.[1] && parseFloat(candle4hAgo[1]) > 0
            ? ((parseFloat(lastComplete[4]) - parseFloat(candle4hAgo[1])) / parseFloat(candle4hAgo[1])) * 100
            : 0;

          // volCcyQuote (index 7) = USDT 거래량
          const vol1h = parseFloat(lastComplete[7] ?? "0");
          const prevVols = klines.slice(1, 6).map((k) => parseFloat(k[7] ?? "0"));
          const avgPrevVol = prevVols.length > 0 ? prevVols.reduce((s, v) => s + v, 0) / prevVols.length : 0;
          const volumeSpike = avgPrevVol > 0 ? vol1h / avgPrevVol : 1;
          const volume4hUsd = klines.slice(3, 7).reduce((sum, k) => sum + parseFloat(k?.[7] ?? "0"), 0);

          let oiChangePct = 0;
          let oiChangePct6h = 0;
          if (oiRes) {
            const oiJson = await oiRes.json();
            const oiItems = oiJson.data ?? [];
            if (oiItems.length >= 2) {
              const curr = parseFloat(oiItems[oiItems.length - 1]?.oiCcy ?? "0");
              const prev = parseFloat(oiItems[oiItems.length - 2]?.oiCcy ?? "0");
              if (prev > 0) oiChangePct = ((curr - prev) / prev) * 100;
              const oldest = parseFloat(oiItems[0]?.oiCcy ?? "0");
              if (oldest > 0) oiChangePct6h = ((curr - oldest) / oldest) * 100;
            }
          }

          return {
            symbol: coin.symbol,
            fundingRate: coin.fundingRate,
            priceChange1h, priceChange4h,
            oiChangePct, oiChangePct6h,
            volume4hUsd, volumeSpike,
            marketCapUsd: capMap.get(coin.symbol.toUpperCase()) ?? null,
            entryPrice: coin.markPrice,
          };
        } catch {
          return null;
        }
      })
    );
    rawResults.push(...batchData.filter(Boolean));
  }

  if (!rawResults.length) return null;
  const top50 = scoreAndRank(rawResults);
  console.log(`  [선물 스캐너] OKX 완료: ${top50.length}개 저장`);
  return top50;
}

async function fetchFuturesScannerBybit(marketsTop250) {
  console.log("  [선물 스캐너] Bybit 데이터 수집 중...");

  const tickerRes = await safeFetch("https://api.bybit.com/v5/market/tickers?category=linear");
  if (!tickerRes) return [];
  const tickerJson = await tickerRes.json();

  const allTickers = (tickerJson.result?.list ?? []).filter((t) => t.symbol.endsWith("USDT"));
  if (!allTickers.length) return [];

  const capMap = new Map();
  for (const coin of (marketsTop250 ?? [])) {
    if (coin.symbol) capMap.set(coin.symbol.toUpperCase(), coin.market_cap ?? null);
  }

  // Bybit ticker에 fundingRate 포함 → 한 번에 필터 가능
  const candidates = allTickers
    .filter((t) => parseFloat(t.fundingRate ?? "0") > 0)
    .map((t) => ({
      symbol: t.symbol.replace(/USDT$/, ""),
      bybitSymbol: t.symbol,
      fundingRate: parseFloat(t.fundingRate ?? "0"),
      markPrice: parseFloat(t.lastPrice ?? "0"),
    }));

  if (!candidates.length) { console.log("  [선물 스캐너] Bybit 양수 펀딩비 없음"); return []; }
  console.log(`  [선물 스캐너] Bybit 양수 펀딩비 ${candidates.length}개, 데이터 수집 중...`);

  const BATCH = 10;
  const rawResults = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const batchData = await Promise.all(
      batch.map(async (coin) => {
        try {
          const [klinesRes, oiRes] = await Promise.all([
            safeFetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${coin.bybitSymbol}&interval=60&limit=8`),
            safeFetch(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${coin.bybitSymbol}&intervalTime=1h&limit=7`),
          ]);
          if (!klinesRes) return null;

          const klinesJson = await klinesRes.json();
          // Bybit: [ts,open,high,low,close,volume,turnover], newest first → reverse
          const klines = (klinesJson.result?.list ?? []).reverse();
          const lastComplete = klines[6];
          const candle4hAgo  = klines[3];
          if (!lastComplete) return null;

          const priceChange1h = parseFloat(lastComplete[1]) > 0
            ? ((parseFloat(lastComplete[4]) - parseFloat(lastComplete[1])) / parseFloat(lastComplete[1])) * 100
            : 0;
          const priceChange4h = candle4hAgo?.[1] && parseFloat(candle4hAgo[1]) > 0
            ? ((parseFloat(lastComplete[4]) - parseFloat(candle4hAgo[1])) / parseFloat(candle4hAgo[1])) * 100
            : 0;

          // turnover (index 6) = USDT 거래량
          const vol1h = parseFloat(lastComplete[6] ?? "0");
          const prevVols = klines.slice(1, 6).map((k) => parseFloat(k[6] ?? "0"));
          const avgPrevVol = prevVols.length > 0 ? prevVols.reduce((s, v) => s + v, 0) / prevVols.length : 0;
          const volumeSpike = avgPrevVol > 0 ? vol1h / avgPrevVol : 1;
          const volume4hUsd = klines.slice(3, 7).reduce((sum, k) => sum + parseFloat(k?.[6] ?? "0"), 0);

          let oiChangePct = 0;
          let oiChangePct6h = 0;
          if (oiRes) {
            const oiJson = await oiRes.json();
            // Bybit OI: { openInterest, timestamp }, newest first → reverse
            const oiItems = (oiJson.result?.list ?? []).reverse();
            if (oiItems.length >= 2) {
              const curr = parseFloat(oiItems[oiItems.length - 1]?.openInterest ?? "0");
              const prev = parseFloat(oiItems[oiItems.length - 2]?.openInterest ?? "0");
              if (prev > 0) oiChangePct = ((curr - prev) / prev) * 100;
              const oldest = parseFloat(oiItems[0]?.openInterest ?? "0");
              if (oldest > 0) oiChangePct6h = ((curr - oldest) / oldest) * 100;
            }
          }

          return {
            symbol: coin.symbol,
            fundingRate: coin.fundingRate,
            priceChange1h, priceChange4h,
            oiChangePct, oiChangePct6h,
            volume4hUsd, volumeSpike,
            marketCapUsd: capMap.get(coin.symbol.toUpperCase()) ?? null,
            entryPrice: coin.markPrice,
          };
        } catch {
          return null;
        }
      })
    );
    rawResults.push(...batchData.filter(Boolean));
  }

  if (!rawResults.length) return [];
  const top50 = scoreAndRank(rawResults);
  console.log(`  [선물 스캐너] Bybit 완료: ${top50.length}개 저장`);
  return top50;
}

async function fetchFuturesScanner(marketsTop250) {
  const okxResult = await fetchFuturesScannerOKX(marketsTop250);
  if (okxResult && okxResult.length > 0) return okxResult;
  console.log("  [선물 스캐너] OKX 실패, Bybit 폴백...");
  return fetchFuturesScannerBybit(marketsTop250);
}

// ── 데이터 수집 ───────────────────────────────────────────────────────────────

async function fetchAll() {
  console.log("데이터 수집 중...");

  const [globalRes, trendingRes, marketsRes, fngRes, dexRes] = await Promise.all([
    safeFetch("https://api.coingecko.com/api/v3/global"),
    safeFetch("https://api.coingecko.com/api/v3/search/trending"),
    safeFetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,bnb,xrp,hyperliquid&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d"
    ),
    safeFetch("https://api.alternative.me/fng/?limit=1"),
    safeFetch("https://api.llama.fi/v2/chains"),   // chain list
  ]);

  const global_ = globalRes ? await globalRes.json() : null;
  const trending = trendingRes ? await trendingRes.json() : null;
  const markets = marketsRes ? await marketsRes.json() : null;

  // 트렌딩 코인 가격/변동률 보강
  const trendingIds = (trending?.coins ?? []).slice(0, 6).map((e) => e.item.id).join(",");
  const trendingMktRes = trendingIds
    ? await safeFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${trendingIds}&price_change_percentage=24h,7d&sparkline=false`)
    : null;
  const trendingMkt = trendingMktRes ? await trendingMktRes.json() : [];
  const fngRaw = fngRes ? await fngRes.json() : null;
  const dexRaw = dexRes ? await dexRes.json() : null;

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
    // DefiLlama sometimes repeats yesterday's TVL for "today" before it's computed
    const len = hist.length;
    const currIdx = (hist[len - 1].tvl === hist[len - 2].tvl) ? len - 2 : len - 1;
    const prevIdx = currIdx - 1;
    if (prevIdx < 0) continue;
    const curr = hist[currIdx].tvl;
    const prev = hist[prevIdx].tvl;
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

  const [longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories] = await Promise.all([
    fetchLongShortRatio(),
    fetchSmartMoneyNetflows(),
    fetchPredictionMarkets(),
    fetchHyperliquidPerps(),
    fetchCoinCategories(),
  ]);
  // RSI는 순차 호출(CoinGecko rate limit)
  const rsiHeatmap = await fetchRsiHeatmap();
  const futuresScanner = await fetchFuturesScanner(marketsTop250);

  // 예측시장 질문 한국어 번역
  if (predictionMarkets?.length) {
    const questions = predictionMarkets.map((p) => p.question);
    const translated = await translateBatch(questions);
    predictionMarkets.forEach((p, i) => { p.question = translated[i] ?? p.question; });
  }

  console.log(`  알트코인 시즌: ${altcoinSeason}, 롱/숏: ${longShortRatio}, 넷플로우: ${netflows?.length ?? 0}개, 예측시장: ${predictionMarkets?.length ?? 0}개, 하이퍼리퀴드: ${hyperliquidPerps?.length ?? 0}개, 섹터: ${coinCategories?.length ?? 0}개, RSI 과매수: ${rsiHeatmap?.overbought?.length ?? 0}개, 과매도: ${rsiHeatmap?.oversold?.length ?? 0}개, 급등: ${gainersLosers?.gainers?.length ?? 0}개, 급락: ${gainersLosers?.losers?.length ?? 0}개`);

  // 시장 요약
  const gd = global_?.data ?? null;
  const market = gd
    ? {
        total_market_cap_usd: gd.total_market_cap?.usd ?? null,
        market_cap_change_24h: gd.market_cap_change_percentage_24h_usd ?? null,
        btc_dominance: gd.market_cap_percentage?.btc ?? null,
        usdt_dominance: gd.market_cap_percentage?.usdt ?? null,
        active_cryptocurrencies: gd.active_cryptocurrencies ?? null,
        coins: markets ?? [],
      }
    : null;

  // 트렌딩 정리
  const trendingCoins = (trending?.coins ?? []).slice(0, 6).map((e) => {
    const mkt = (Array.isArray(trendingMkt) ? trendingMkt : []).find((m) => m.id === e.item.id);
    return {
      name: e.item.name,
      symbol: e.item.symbol,
      market_cap_rank: e.item.market_cap_rank ?? null,
      thumb: e.item.thumb ?? null,
      price: mkt?.current_price ?? null,
      price_change_24h: mkt?.price_change_percentage_24h ?? null,
      price_change_7d: mkt?.price_change_percentage_7d_in_currency ?? null,
    };
  });

  return { market, trending: trendingCoins, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers, marketsTop250, futuresScanner };
}

// ── 편집 코멘트 생성 (룰 기반) ───────────────────────────────────────────────

function generateEditorial({ market, trending, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, predictionMarkets, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers, marketsTop250, futuresScanner }) {
  const change = market?.market_cap_change_24h;
  const btcDom = market?.btc_dominance;
  const coins = market?.coins ?? [];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 시장 심리 판단
  let sentiment, sentimentDetail;
  if (change == null) {
    sentiment = "데이터 없음";
    sentimentDetail = "오늘 시장 데이터를 불러오지 못했습니다.";
  } else if (change >= 5) {
    sentiment = "강한 상승장";
    sentimentDetail = pick([
      `전체 시장이 ${change.toFixed(1)}% 급등했습니다. 강한 매수세가 유입되고 있습니다.`,
      `시장 전반이 ${change.toFixed(1)}% 폭등했습니다. 공격적인 매수가 시장을 이끌고 있습니다.`,
      `${change.toFixed(1)}% 급등 — 전방위 매수세가 쏟아지고 있습니다.`,
      `전체 시총이 ${change.toFixed(1)}% 뛰었습니다. 단기 모멘텀이 매우 강합니다.`,
      `시장이 ${change.toFixed(1)}% 폭등하며 강세 신호를 보내고 있습니다.`,
    ]);
  } else if (change >= 2) {
    sentiment = "상승세";
    sentimentDetail = pick([
      `전체 시장이 ${change.toFixed(1)}% 올랐습니다. 긍정적인 흐름이 이어지고 있습니다.`,
      `시장이 ${change.toFixed(1)}% 상승하며 매수 우위 흐름이 나타나고 있습니다.`,
      `${change.toFixed(1)}% 상승 — 시장 전반에 걸쳐 매수세가 살아있습니다.`,
      `전체 시총이 ${change.toFixed(1)}% 늘었습니다. 상승 모멘텀이 유지되고 있습니다.`,
      `시장이 ${change.toFixed(1)}% 올라 긍정적인 방향으로 움직이고 있습니다.`,
    ]);
  } else if (change >= 0) {
    sentiment = "보합 상승";
    sentimentDetail = pick([
      `전체 시장이 소폭 ${change.toFixed(1)}% 상승했습니다. 방향성을 탐색하는 분위기입니다.`,
      `${change.toFixed(1)}% 소폭 상승 — 뚜렷한 방향 없이 관망세가 이어지고 있습니다.`,
      `시장이 ${change.toFixed(1)}% 오르며 보합권에 머물고 있습니다.`,
      `소폭 ${change.toFixed(1)}% 상승 — 큰 움직임 없이 숨고르기 중입니다.`,
      `전체 시총이 미미하게 ${change.toFixed(1)}% 올랐습니다. 명확한 방향성이 부재합니다.`,
    ]);
  } else if (change >= -2) {
    sentiment = "보합 하락";
    sentimentDetail = pick([
      `전체 시장이 소폭 ${Math.abs(change).toFixed(1)}% 하락했습니다. 관망세가 우세합니다.`,
      `${Math.abs(change).toFixed(1)}% 소폭 하락 — 뚜렷한 매도세 없이 소화 중인 구간입니다.`,
      `시장이 ${Math.abs(change).toFixed(1)}% 밀리며 보합권을 유지하고 있습니다.`,
      `소폭 ${Math.abs(change).toFixed(1)}% 조정 — 단기 방향성이 불분명합니다.`,
      `전체 시총이 ${Math.abs(change).toFixed(1)}% 내렸습니다. 시장이 추가 신호를 기다리고 있습니다.`,
    ]);
  } else if (change >= -5) {
    sentiment = "하락세";
    sentimentDetail = pick([
      `전체 시장이 ${Math.abs(change).toFixed(1)}% 내렸습니다. 매도 압력이 커지고 있습니다.`,
      `시장이 ${Math.abs(change).toFixed(1)}% 하락하며 약세 흐름이 형성되고 있습니다.`,
      `${Math.abs(change).toFixed(1)}% 하락 — 매도세가 확산되고 있습니다.`,
      `전체 시총이 ${Math.abs(change).toFixed(1)}% 줄었습니다. 단기 하락 압력에 주의가 필요합니다.`,
      `시장이 ${Math.abs(change).toFixed(1)}% 빠지며 약세 신호를 보내고 있습니다.`,
    ]);
  } else {
    sentiment = "강한 하락장";
    sentimentDetail = pick([
      `전체 시장이 ${Math.abs(change).toFixed(1)}% 급락했습니다. 강한 매도세가 나타나고 있습니다.`,
      `시장이 ${Math.abs(change).toFixed(1)}% 폭락했습니다. 공포 심리가 급격히 확산되고 있습니다.`,
      `${Math.abs(change).toFixed(1)}% 급락 — 전방위 투매가 쏟아지고 있습니다.`,
      `전체 시총이 ${Math.abs(change).toFixed(1)}% 증발했습니다. 단기 바닥 확인이 필요합니다.`,
      `시장이 ${Math.abs(change).toFixed(1)}% 붕괴하며 강한 하락장 신호를 보내고 있습니다.`,
    ]);
  }

  // BTC 도미넌스 해석
  let marketComment = null;
  if (btcDom != null) {
    if (btcDom >= 58)
      marketComment = pick([
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 비트코인이 시장을 독주하는 전형적인 BTC 시즌입니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 자금이 비트코인에 집중되고, 알트는 소외되고 있습니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — BTC가 시장 주도권을 확실히 쥐고 있습니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 비트코인 독주 구간, 알트 반등은 제한적입니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 전형적인 BTC 시즌, 알트코인 자금 이탈이 지속 중입니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 비트코인이 시장 유동성을 흡수하고 있습니다.`,
      ]);
    else if (btcDom >= 52)
      marketComment = pick([
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 비트코인 우세 장세, 알트코인은 상대적으로 부진합니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 비트코인이 주도권을 쥔 구간, 알트 반등은 제한적입니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 자금이 BTC에 집중되는 흐름, 알트 시즌과는 거리가 있습니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — BTC 강세 구간, 알트 선별적 접근이 필요합니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 비트코인이 시장을 이끄는 흐름이 계속되고 있습니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 알트코인 약세가 지속, BTC 중심 장세입니다.`,
      ]);
    else if (btcDom >= 47)
      marketComment = pick([
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — BTC·알트 균형 구간, 자금이 고르게 분산되어 있습니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — BTC와 알트가 균형을 이루는 중립 구간입니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 자금 흐름이 고르게 분산, 방향성이 불분명합니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — BTC와 알트가 혼재하는 균형 장세입니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 중립 구간, BTC 시즌과 알트 시즌의 경계에 있습니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 자금이 BTC와 알트에 골고루 유입되는 흐름입니다.`,
      ]);
    else
      marketComment = pick([
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 알트코인에 자금이 쏠리는 알트 시즌 신호입니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 자금이 알트로 이동 중, 알트 시즌 가능성이 높아졌습니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 알트코인 강세 구간, 비트코인 도미넌스가 낮아지고 있습니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 알트 자금 유입 가속화, 알트 시즌 흐름이 감지됩니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 알트코인이 비트코인을 아웃퍼폼하는 구간입니다.`,
        `BTC 도미넌스 ${btcDom.toFixed(1)}% — 전형적인 알트 시즌 신호, 알트 강세 흐름에 주목하세요.`,
      ]);
  }

  // 주요 코인 흐름
  const upCoins = coins.filter((c) => c.price_change_percentage_24h > 0);
  const downCoins = coins.filter((c) => c.price_change_percentage_24h < 0);
  let coinComment = null;
  if (coins.length > 0) {
    if (upCoins.length === coins.length)
      coinComment = pick([
        `주요 코인 ${coins.length}개 모두 상승 — 전반적인 매수 분위기가 형성됐습니다.`,
        `주요 코인 ${coins.length}개 전부 플러스 — 시장 전체에 매수세가 확산되고 있습니다.`,
        `전 종목 상승 — 강한 시장 분위기가 형성됐습니다.`,
        `주요 코인 모두 상승권 — 투자 심리가 전반적으로 개선되고 있습니다.`,
        `${coins.length}개 전 종목 상승 — 리스크온 흐름이 뚜렷합니다.`,
      ]);
    else if (downCoins.length === coins.length)
      coinComment = pick([
        `주요 코인 ${coins.length}개 모두 하락 — 전반적인 위험 회피 심리가 우세합니다.`,
        `주요 코인 ${coins.length}개 전부 마이너스 — 시장 전체에 매도세가 퍼지고 있습니다.`,
        `전 종목 하락 — 리스크오프 심리가 확산되고 있습니다.`,
        `주요 코인 모두 하락권 — 투자 심리가 전반적으로 위축됐습니다.`,
        `${coins.length}개 전 종목 하락 — 강한 매도 압력이 시장을 짓누르고 있습니다.`,
      ]);
    else {
      const btc = coins.find((c) => c.id === "bitcoin");
      const eth = coins.find((c) => c.id === "ethereum");
      if (btc && eth) {
        const btcUp = btc.price_change_percentage_24h > 0;
        const ethUp = eth.price_change_percentage_24h > 0;
        if (btcUp && !ethUp)
          coinComment = pick([
            `BTC 상승, ETH 하락 — 비트코인 단독 강세가 나타나고 있습니다.`,
            `BTC는 오르고 ETH는 내리는 BTC 단독 장세입니다.`,
            `BTC 강세, ETH 부진 — 비트코인 중심의 편중 흐름이 감지됩니다.`,
            `BTC가 ETH를 아웃퍼폼하는 흐름, 비트코인 단독 수요가 유입되고 있습니다.`,
            `${upCoins.length}개 상승, ${downCoins.length}개 하락 — BTC 주도의 차별화 장세입니다.`,
          ]);
        else if (!btcUp && ethUp)
          coinComment = pick([
            `ETH 상승, BTC 하락 — 이더리움 중심의 알트 흐름이 감지됩니다.`,
            `ETH가 BTC를 아웃퍼폼 — 이더리움 수요가 부각되고 있습니다.`,
            `BTC 부진, ETH 강세 — 알트 선호 심리가 이더리움에 집중되고 있습니다.`,
            `ETH 단독 강세 — 이더리움 중심의 자금 흐름이 포착됩니다.`,
            `${upCoins.length}개 상승, ${downCoins.length}개 하락 — ETH 주도의 차별화 장세입니다.`,
          ]);
        else
          coinComment = pick([
            `${upCoins.length}개 상승, ${downCoins.length}개 하락 — 종목별 차별화 장세입니다.`,
            `${upCoins.length}개 상승 vs ${downCoins.length}개 하락 — 혼조세 속 선별적 흐름입니다.`,
            `상승 ${upCoins.length}개, 하락 ${downCoins.length}개 — 뚜렷한 방향 없이 종목별로 갈리고 있습니다.`,
            `${upCoins.length}개가 오르고 ${downCoins.length}개가 내리는 혼재 장세입니다.`,
            `종목별 등락이 엇갈리는 차별화 장세가 이어지고 있습니다.`,
          ]);
      } else {
        coinComment = pick([
          `${upCoins.length}개 상승, ${downCoins.length}개 하락 — 혼조세가 이어지고 있습니다.`,
          `상승 ${upCoins.length}개, 하락 ${downCoins.length}개 — 방향성이 엇갈리는 장세입니다.`,
          `${upCoins.length}개가 오르고 ${downCoins.length}개가 밀리는 혼재 흐름입니다.`,
          `뚜렷한 방향 없이 종목별로 등락이 엇갈리고 있습니다.`,
          `상승·하락 혼재 — 단기 방향성이 불분명한 구간입니다.`,
        ]);
      }
    }
  }

  // 트렌딩 코멘트
  let trendingComment = null;
  if (trending?.length > 0) {
    const top3 = trending.slice(0, 3).map((c) => c.name).join(", ");
    trendingComment = pick([
      `${top3} 등이 검색 상위권 — 시장의 관심이 집중된 종목들입니다.`,
      `${top3} 등이 트렌딩 상위권 — 단기 테마 수요가 집중되고 있습니다.`,
      `${top3} 등이 급부상 — 투자자들의 이목이 쏠리고 있습니다.`,
      `트렌딩 1~3위: ${top3} — 시장 관심이 이 종목들에 집중되고 있습니다.`,
      `${top3} 등이 검색 급상승 — 단기 모멘텀이 발생하고 있습니다.`,
      `${top3} 등에 관심이 몰리고 있습니다. 단기 테마 흐름에 주목하세요.`,
    ]);
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
      dexComment = pick([
        `${topIn.chain}에 ${inAmt} 유입 — 자금이 집중되고 있습니다. ${topOut.chain}은(는) 상대적으로 이탈 중.`,
        `온체인 자금이 ${topIn.chain}으로 ${inAmt} 몰리고 있습니다. ${topOut.chain}은 유출 흐름.`,
        `${topIn.chain} ${inAmt} 순유입 — 체인별 자금 쏠림이 뚜렷합니다. ${topOut.chain}은 이탈 중.`,
        `자금이 ${topIn.chain}으로 집중(${inAmt}), ${topOut.chain}에서는 이탈이 이어지고 있습니다.`,
        `${topIn.chain}이 온체인 유입을 주도(${inAmt}), ${topOut.chain}은 상대적으로 소외되고 있습니다.`,
        `체인 자금 흐름: ${topIn.chain} 유입 강세(${inAmt}) vs ${topOut.chain} 이탈.`,
      ]);
    } else if (topIn) {
      dexComment = pick([
        `${topIn.chain} 중심으로 온체인 자금 유입이 활발합니다.`,
        `전반적으로 온체인 자금이 유입되는 흐름, ${topIn.chain}이 선두입니다.`,
        `${topIn.chain}을 중심으로 온체인 매수세가 강하게 유입되고 있습니다.`,
        `온체인 자금 유입 우세 — ${topIn.chain}이 가장 많은 유입을 기록 중입니다.`,
      ]);
    } else if (topOut) {
      dexComment = pick([
        `전반적으로 온체인 자금 이탈 흐름이 감지됩니다.`,
        `온체인 자금이 빠져나가는 흐름, 단기 주의가 필요합니다.`,
        `전체 체인에서 자금 유출 흐름이 우세합니다.`,
        `온체인 매도 압력이 확산되고 있습니다. 유출 흐름에 주목하세요.`,
      ]);
    }
  }

  // 공포·탐욕 코멘트
  let fngComment = null;
  if (fearGreed != null) {
    const v = fearGreed.value;
    const label = fearGreed.classification_ko;
    if (v <= 25)
      fngComment = pick([
        `공포·탐욕 지수 ${v} (${label}) — 시장 참여자들이 극도로 위축돼 있습니다. 과거 바닥권 신호일 수 있습니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 극단적 공포 구간, 역발상 매수의 기회일 수 있습니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 투자 심리가 바닥 수준입니다. 과거 저점과 유사한 구간입니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 공포가 극단에 달했습니다. 추가 하락 또는 반등의 기로입니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 시장 참여자 대부분이 공포를 느끼는 구간입니다.`,
      ]);
    else if (v <= 45)
      fngComment = pick([
        `공포·탐욕 지수 ${v} (${label}) — 투자 심리가 위축돼 있습니다. 신중한 접근이 필요합니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 공포 심리가 우세한 구간, 변동성에 주의하세요.`,
        `공포·탐욕 지수 ${v} (${label}) — 투자자들이 방어적으로 움직이고 있습니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 심리 위축 구간, 무리한 추격 매수는 피하는 게 좋습니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 시장 불안 심리가 여전히 남아있습니다.`,
      ]);
    else if (v <= 55)
      fngComment = pick([
        `공포·탐욕 지수 ${v} (${label}) — 시장 심리가 균형 상태입니다. 방향성을 탐색 중입니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 공포도 탐욕도 아닌 중립 구간입니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 투자 심리가 안정적입니다. 다음 방향성에 주목하세요.`,
        `공포·탐욕 지수 ${v} (${label}) — 시장이 숨고르기 중입니다. 추세 확인 후 대응이 필요합니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 매수·매도 심리가 균형을 이루고 있습니다.`,
      ]);
    else if (v <= 75)
      fngComment = pick([
        `공포·탐욕 지수 ${v} (${label}) — 투자 심리가 낙관적입니다. 과열 여부를 주시해야 합니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 탐욕 구간 진입, 단기 과열 가능성을 염두에 두세요.`,
        `공포·탐욕 지수 ${v} (${label}) — 시장 심리가 강세로 기울었습니다. 고점 경계가 필요합니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 낙관론이 우세하지만 과열 신호는 아직입니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 투자 심리가 달아오르고 있습니다. 분할 매도를 고려할 구간입니다.`,
      ]);
    else
      fngComment = pick([
        `공포·탐욕 지수 ${v} (${label}) — 시장이 극도로 과열돼 있습니다. 단기 조정 가능성에 유의하세요.`,
        `공포·탐욕 지수 ${v} (${label}) — 극단적 탐욕 구간, 과거 고점과 겹치는 신호입니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 탐욕이 최고조에 달했습니다. 리스크 관리가 필요합니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 시장 과열 경보, 단기 매도 압력이 높아질 수 있습니다.`,
        `공포·탐욕 지수 ${v} (${label}) — 모두가 낙관적일 때가 가장 위험합니다. 고점 주의.`,
      ]);
  }

  // 스마트머니 넷플로우 코멘트
  let netflowComment = null;
  if (netflows?.length > 0) {
    const sorted = [...netflows].sort((a, b) => Math.abs(b.net_flow_24h_usd) - Math.abs(a.net_flow_24h_usd));
    const topIn = sorted.filter((n) => n.net_flow_24h_usd > 0)[0];
    const topOut = sorted.filter((n) => n.net_flow_24h_usd < 0)[0];
    const fmtAmt = (v) => {
      const abs = Math.abs(v);
      return abs >= 1e6 ? `$${(abs / 1e6).toFixed(1)}M` : `$${(abs / 1e3).toFixed(0)}K`;
    };
    const totalIn = netflows.reduce((s, n) => s + (n.net_flow_24h_usd > 0 ? n.net_flow_24h_usd : 0), 0);
    const totalOut = netflows.reduce((s, n) => s + (n.net_flow_24h_usd < 0 ? Math.abs(n.net_flow_24h_usd) : 0), 0);
    if (topIn && topOut) {
      const dominant = totalIn > totalOut ? "순유입" : "순유출";
      netflowComment = pick([
        `순유입: ${topIn.token_symbol} / 순유출: ${topOut.token_symbol}\n전반적 ${dominant} 기조.`,
        `스마트머니 ${dominant} 우세 — ${topIn.token_symbol} 매집, ${topOut.token_symbol} 이탈 포착.`,
        `${topIn.token_symbol} 유입 vs ${topOut.token_symbol} 유출 — 전반적으로 ${dominant} 흐름입니다.`,
        `스마트머니가 ${topIn.token_symbol}을 담고 ${topOut.token_symbol}을 덜어내는 흐름입니다.`,
        `${dominant} 기조 속 ${topIn.token_symbol} 강한 유입, ${topOut.token_symbol} 지속 이탈 중.`,
      ]);
    } else if (topIn) {
      netflowComment = pick([
        `전 종목 스마트머니 순유입 우세, ${topIn.token_symbol} 선두\n단기 매수세 강화 흐름 지속 중.`,
        `스마트머니가 전반적으로 유입되는 흐름, ${topIn.token_symbol}이 가장 강합니다.`,
        `${topIn.token_symbol} 중심으로 스마트머니 순매수가 집중되고 있습니다.`,
        `전 종목 유입 우세 — ${topIn.token_symbol}이 스마트머니 매집을 주도하고 있습니다.`,
      ]);
    } else if (topOut) {
      netflowComment = pick([
        `전 종목 스마트머니 순유출 우세, ${topOut.token_symbol} 선두\n단기 매도 압력 확대 가능성 주시 필요.`,
        `스마트머니가 전반적으로 빠져나가는 흐름, ${topOut.token_symbol} 이탈이 가장 큽니다.`,
        `${topOut.token_symbol} 중심으로 스마트머니 순매도가 집중되고 있습니다.`,
        `전 종목 유출 우세 — ${topOut.token_symbol}에서 스마트머니 이탈이 가속화되고 있습니다.`,
      ]);
    }
  }

  // 하이라이트 3개 선별
  const highlights = [marketComment, coinComment, dexComment].filter(Boolean).slice(0, 3);

  const summary = `${sentimentDetail}${btcDom != null ? ` BTC 도미넌스는 ${btcDom.toFixed(1)}%를 기록 중입니다.` : ""}`;

  return { sentiment, summary, highlights, market_comment: marketComment, coin_comment: coinComment, trending_comment: trendingComment, dex_comment: dexComment, fng_comment: fngComment, netflow_comment: netflowComment, altcoin_season: altcoinSeason ?? null, long_short_ratio: longShortRatio ?? null, netflows: netflows ?? null, prediction_markets: predictionMarkets ?? null, hyperliquid_perps: hyperliquidPerps ?? null, coin_categories: coinCategories ?? null, rsi_heatmap: rsiHeatmap ?? null, gainers_losers: gainersLosers ?? null,
    coins_top250: marketsTop250 ? marketsTop250.map(c => ({
      symbol: (c.symbol ?? "").toUpperCase(),
      name: c.name ?? "",
      price_change_percentage_24h: c.price_change_percentage_24h ?? 0,
      price_change_percentage_7d_in_currency: c.price_change_percentage_7d_in_currency ?? 0,
    })) : null,
    futures_scanner: futuresScanner ?? [],
  };
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

  const { market, fearGreed, trending } = payload;
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

  const fngVal = fearGreed?.value ?? null;
  const fngLabel = fearGreed?.classification_ko ?? "–";
  const altSVal = editorial.altcoin_season;
  const altSDesc = altSVal >= 75 ? "알트시즌" : altSVal >= 50 ? "알트우세" : altSVal >= 25 ? "BTC우세" : "BTC독주";
  const lsVal = editorial.long_short_ratio;
  const lsDesc = lsVal != null ? (lsVal >= 55 ? "롱과열" : lsVal <= 45 ? "숏과열" : "균형") : "–";

  // 좌우정렬용 display-width 패딩 (CJK=2, emoji=2, ASCII=1)
  const dw = (s) => [...s].reduce((w, c) => {
    const cp = c.codePointAt(0);
    return w + ((cp > 0x2E80 && cp < 0xA000) || (cp >= 0x1F000) ? 2 : 1);
  }, 0);
  const dPad = (s, n) => s + " ".repeat(Math.max(0, n - dw(s)));

  const indLines = [
    fngVal != null ? `공포탐욕  ${String(fngVal).padStart(3)}  ${fngLabel}` : null,
    altSVal != null ? `알트시즌  ${String(altSVal).padStart(3)}  ${altSDesc}` : null,
    lsVal != null ? `롱숏비율  ${String(lsVal).padStart(3)}%  ${lsDesc}` : null,
  ].filter(Boolean).join("\n");
  const indBlock = indLines ? `<code>${indLines}</code>` : null;

  const fmtPrice = (n) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 주요 코인
  const coinLines = coins.slice(0, 6).map((c) => {
    const chg = c.price_change_percentage_24h;
    const dot = chg >= 0 ? "🟢" : "🔴";
    const sym = c.symbol.toUpperCase().padEnd(5);
    return `${dot} <code>${sym}  ${(chg >= 0 ? "+" : "") + chg.toFixed(1) + "%"}  ${fmtPrice(c.current_price)}</code>`;
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
      const dot = v >= 0 ? "🟢" : "🔴";
      const pct = (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
      return `${dot} <code>${dPad(s.name, 20)}${pct.padStart(7)}</code>`;
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
  const fmtNetflow = (n) => {
    const abs = Math.abs(n.net_flow_24h_usd);
    const amt = abs >= 1e6 ? `$${(abs/1e6).toFixed(1)}M` : `$${(abs/1e3).toFixed(0)}K`;
    return `  <b>${n.token_symbol}</b>  ${amt}  <i>${n.chain}</i>`;
  };
  const nfAll = editorial.netflows ?? [];
  const nfIn = nfAll.filter((n) => n.net_flow_24h_usd > 0).sort((a, b) => b.net_flow_24h_usd - a.net_flow_24h_usd).slice(0, 3);
  const nfOut = nfAll.filter((n) => n.net_flow_24h_usd < 0).sort((a, b) => a.net_flow_24h_usd - b.net_flow_24h_usd).slice(0, 3);
  const netflowLines = [
    nfIn.length ? `🟢 <b>매집</b>\n${nfIn.map(fmtNetflow).join("\n")}` : null,
    nfOut.length ? `🔴 <b>이탈</b>\n${nfOut.map(fmtNetflow).join("\n")}` : null,
  ].filter(Boolean).join("\n");

  // 예측시장 — Polymarket·Nansen 상위 5개
  const stripDash = (s) => s ? s.replace(/^[^—]*—\s*/, "") : s;
  const fmtPred = (p) => {
    const yesPct = p.yes_price != null ? Math.round(p.yes_price * 100) : null;
    const q = p.question.length > 44 ? p.question.slice(0, 44) + "…" : p.question;
    if (yesPct != null) {
      const noPct = 100 - yesPct;
      const filled = Math.min(5, Math.round(yesPct / 20));
      const bar = "🟩".repeat(filled) + "🟥".repeat(5 - filled);
      return `  • ${q}\n  <code>${String(yesPct).padStart(3)}% ${bar} ${String(noPct).padStart(3)}%</code>`;
    }
    return `  • ${q}`;
  };
  const allPreds = (editorial.prediction_markets ?? []).slice(0, 5);
  const predLines = allPreds.length ? allPreds.map(fmtPred).join("\n") : null;

  const sections = [
    `${emoji} <b>스트라고스 마켓 브리핑</b>\n<i>${dateLabel} ${timeLabel}</i>`,
    `<b>${editorial.sentiment}</b>\n${editorial.summary.replace(/\.\s+/g, ".\n")}`,
    indBlock ? `\n📊 <b>시장 지표</b>\n${indBlock}` : `\n📊 <b>시장 지표</b>`,
    editorial.fng_comment ? `<i>${stripDash(editorial.fng_comment)}</i>` : null,
    coinLines ? `\n💰 <b>주요 코인</b>\n${coinLines}` : null,
    editorial.coin_comment ? `<i>${stripDash(editorial.coin_comment)}</i>` : null,
    trendingLine ? `\n🔥 <b>트렌딩 코인</b> <i>(24h 검색량)</i>\n${trendingLine}` : null,
    editorial.trending_comment ? `<i>${stripDash(editorial.trending_comment)}</i>` : null,
    gainersLosersLines ? `\n${gainersLosersLines}` : null,
    sectorLines ? `\n🏷️ <b>섹터별 성과</b>\n${sectorLines}` : null,
    rsiBar ? `\n📈 <b>RSI 히트맵</b> <i>(4h)</i>\n${rsiBar}` : null,
    netflowLines ? `\n🧠 <b>스마트머니 넷플로우</b>\n${netflowLines}` : null,
    editorial.netflow_comment ? `<i>${editorial.netflow_comment}</i>` : null,
    editorial.dex_comment ? `\n🌐 <b>온체인 자금흐름</b>\n<i>${stripDash(editorial.dex_comment)}</i>` : null,
    predLines ? `\n🎯 <b>예측시장</b>\n${predLines}` : null,
    `\n📡 <b>선물 스캐너</b> 신규 추가 — <a href="https://stragos.xyz/crypto#futures">홈페이지에서 확인</a>`,
    `<a href="https://stragos.xyz/crypto">➡️ 최신 브리핑 전체 보기</a>`,
    `🔄 <i>웹 브리핑 매시간 갱신</i>\n📨 <i>텔레그램 알림 6시간마다 발송</i>`,
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
  const kstHour = new Date(Date.now() + 9 * 3600_000).getUTCHours();
  const isTelegramHour = [0, 6, 12, 18].includes(kstHour);
  const noTelegram = process.argv.includes("--no-telegram") || !isTelegramHour;

  const payload = await fetchAll();
  const editorial = generateEditorial(payload);
  const { altcoinSeason: _as, longShortRatio: _ls, netflows: _nf, predictionMarkets: _pm, hyperliquidPerps: _hp, coinCategories: _cc, rsiHeatmap: _rsi, gainersLosers: _gl, marketsTop250: _m250, futuresScanner: _fs, ...dbPayload } = payload;

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

  // 선물 신호 추적: 이전 신호 현재가 업데이트 + 새 신호 기록
  await updateFuturesSignalPrices();
  await insertFuturesSignals(payload.futuresScanner ?? []);

  if (!noTelegram) await sendTelegramBriefing(date, payload, editorial);
}

async function updateFuturesSignalPrices() {
  try {
    const { data: pending } = await sb
      .from("futures_signals")
      .select("id, symbol, recorded_at, price_1h, price_4h, price_24h")
      .or("price_1h.is.null,price_4h.is.null,price_24h.is.null");

    if (!pending || pending.length === 0) return;

    // 현재가 가져오기 (OKX → Bybit 폴백)
    const priceMap = new Map();
    const okxRes = await safeFetch("https://www.okx.com/api/v5/market/tickers?instType=SWAP");
    if (okxRes) {
      const d = await okxRes.json();
      for (const t of (d.data ?? [])) {
        if (t.instId.endsWith("-USDT-SWAP")) {
          priceMap.set(t.instId.replace(/-USDT-SWAP$/, ""), parseFloat(t.last ?? "0"));
        }
      }
    }
    if (!priceMap.size) {
      const bybitRes = await safeFetch("https://api.bybit.com/v5/market/tickers?category=linear");
      if (bybitRes) {
        const d = await bybitRes.json();
        for (const t of (d.result?.list ?? [])) {
          if (t.symbol.endsWith("USDT")) {
            priceMap.set(t.symbol.replace(/USDT$/, ""), parseFloat(t.lastPrice ?? "0"));
          }
        }
      }
    }
    if (!priceMap.size) return;

    const now = new Date();
    for (const signal of pending) {
      const elapsed = (now - new Date(signal.recorded_at)) / 60000;
      const currentPrice = priceMap.get(signal.symbol);
      if (!currentPrice) continue;

      const update = {};
      if (!signal.price_1h  && elapsed >= 55)   update.price_1h  = currentPrice;
      if (!signal.price_4h  && elapsed >= 235)   update.price_4h  = currentPrice;
      if (!signal.price_24h && elapsed >= 1415)  update.price_24h = currentPrice;

      if (Object.keys(update).length > 0) {
        update.updated_at = now.toISOString();
        await sb.from("futures_signals").update(update).eq("id", signal.id);
      }
    }
    console.log("  [신호 추적] 이전 신호 현재가 업데이트 완료");
  } catch (e) {
    console.warn("  [신호 추적] 업데이트 실패:", e.message);
  }
}

async function insertFuturesSignals(top50) {
  try {
    const top10 = top50.slice(0, 10);
    if (top10.length === 0) return;
    const now = new Date().toISOString();
    const rows = top10.map((coin, idx) => ({
      recorded_at: now,
      symbol: coin.symbol,
      rank: idx + 1,
      entry_price: coin.entryPrice,
      score: coin.score,
    }));
    const { error } = await sb.from("futures_signals").insert(rows);
    if (error) console.warn("  [신호 추적] INSERT 실패:", error.message);
    else console.log(`  [신호 추적] TOP 10 신호 기록 완료 (${now.slice(0, 16)})`);
  } catch (e) {
    console.warn("  [신호 추적] INSERT 예외:", e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
