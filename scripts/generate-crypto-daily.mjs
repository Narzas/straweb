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
import net from "net";
import dns from "dns";

// Oracle Cloud처럼 IPv6 egress가 없는 환경에서 Happy Eyeballs가 IPv6을 시도해 ETIMEDOUT
// 발생하는 문제 회피. IPv4 전용으로 고정.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// retries 기본 0 — 심볼 루프에서 도는 호출들(선물 스캐너·RSI 등)의 기존 동작 유지.
// 재시도가 필요한 곳만 명시적으로 넘긴다.
async function safeFetch(url, headers = {}, timeoutMs = 10_000, retries = 0) {
  let lastErr = "unknown";

  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    let waitMs = null;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "CryptoBriefBot/1.0", ...headers },
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (res.ok) return res;

      lastErr = `HTTP ${res.status}`;
      // 429·5xx만 재시도 대상. 그 외 4xx는 재시도해도 의미 없으니 즉시 포기
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get("retry-after"));
        if (Number.isFinite(ra) && ra > 0) waitMs = ra * 1000;
      } else {
        break;
      }
    } catch (e) {
      clearTimeout(tid);
      lastErr = e.message;
    }

    if (attempt >= retries) break;
    waitMs ??= 2_000 * 2 ** attempt + Math.floor(Math.random() * 500);
    console.warn(`  [retry ${attempt + 1}/${retries}] ${url} — ${lastErr}, ${(waitMs / 1000).toFixed(1)}s 대기`);
    await sleep(waitMs);
  }

  console.warn(`  [skip] ${url} — ${lastErr}`);
  return null;
}

// CoinGecko 전용 래퍼 — Demo API 키 주입 + 429 백오프 재시도.
// 키 없으면 공용(키리스) 한도가 ~4회/윈도우라 실행당 6회 호출에서 반드시 429가 난다.
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY ?? "";

if (!COINGECKO_API_KEY) {
  console.warn(
    "  [경고] COINGECKO_API_KEY 없음 — 키리스 공용 한도(~4회/윈도우)로 동작. 실행당 6회 호출이라 429 발생 가능"
  );
}

function cgFetch(url, timeoutMs = 10_000) {
  const headers = COINGECKO_API_KEY ? { "x-cg-demo-api-key": COINGECKO_API_KEY } : {};
  return safeFetch(url, headers, timeoutMs, 3);
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
  const res = await cgFetch(
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
  const res = await cgFetch(
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

async function fetchKimchiPremium() {
  const FIXED_SYMBOLS = ["BTC", "ETH", "XRP", "SOL"];
  const STABLECOINS = new Set(["USDT", "USDC", "DAI", "BUSD", "TUSD", "FDUSD", "USD1", "PYUSD", "USDD"]);
  const MIN_VOLUME_KRW = 5e8;     // 5억원 이상 거래대금(업비트+빗썸 합산)만 outlier 후보
  const OUTLIER_PCT = 5;          // 김프 5% 이상 = 펌핑
  const MAX_PREMIUM_PCT = 50;     // 50% 초과는 티커 충돌(같은 심볼 다른 토큰)로 간주
  const MAX_REVERSE_PCT = -30;    // -30% 미만도 동일하게 충돌로 간주
  const REVERSE_PCT = -1;         // 김프 -1% 이하 = 역김프

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 20_000);
  try {
    // 1. USD/KRW 환율
    const fxRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD", { signal: ctrl.signal });
    if (!fxRes.ok) throw new Error(`FX ${fxRes.status}`);
    const fxData = await fxRes.json();
    const usdKrw = fxData.rates?.KRW;
    if (!usdKrw) throw new Error("KRW 환율 없음");

    // 2. 업비트 KRW 마켓 목록
    const marketsRes = await fetch("https://api.upbit.com/v1/market/all", { signal: ctrl.signal });
    if (!marketsRes.ok) throw new Error(`Upbit market ${marketsRes.status}`);
    const allMarkets = await marketsRes.json();
    const krwMarkets = allMarkets
      .filter((m) => m.market.startsWith("KRW-"))
      .map((m) => m.market);

    // 3. 업비트 ticker(100배치) + 업비트 market detail + 빗썸 ticker + 빗썸 D/W + 바이낸스 USDT (병렬)
    const upbitTickerCalls = [];
    for (let i = 0; i < krwMarkets.length; i += 100) {
      const batch = krwMarkets.slice(i, i + 100).join(",");
      upbitTickerCalls.push(
        fetch(`https://api.upbit.com/v1/ticker?markets=${batch}`, { signal: ctrl.signal })
          .then((r) => { if (!r.ok) throw new Error(`Upbit ticker ${r.status}`); return r.json(); })
      );
    }
    const [upbitBatches, upbitDetailsJson, bithumbJson, bithumbDwJson, bnAll] = await Promise.all([
      Promise.all(upbitTickerCalls),
      fetch("https://api.upbit.com/v1/market/all?isDetails=true", { signal: ctrl.signal })
        .then((r) => { if (!r.ok) throw new Error(`Upbit details ${r.status}`); return r.json(); }),
      fetch("https://api.bithumb.com/public/ticker/ALL_KRW", { signal: ctrl.signal })
        .then((r) => { if (!r.ok) throw new Error(`Bithumb ${r.status}`); return r.json(); }),
      fetch("https://api.bithumb.com/public/assetsstatus/multichain/ALL", { signal: ctrl.signal })
        .then((r) => { if (!r.ok) throw new Error(`Bithumb DW ${r.status}`); return r.json(); }),
      fetch("https://api.binance.com/api/v3/ticker/price", { signal: ctrl.signal })
        .then((r) => { if (!r.ok) throw new Error(`Binance ${r.status}`); return r.json(); }),
    ]);
    clearTimeout(tid);

    const upbitTickers = upbitBatches.flat();
    const bithumbData = bithumbJson?.data ?? {};

    // Upbit market warning/caution 맵
    const upbitWarnMap = new Map();
    for (const m of upbitDetailsJson) {
      if (!m.market.startsWith("KRW-")) continue;
      const sym = m.market.slice(4);
      upbitWarnMap.set(sym, {
        warning: !!m.market_event?.warning,
        kimchi_caution: !!m.market_event?.caution?.GLOBAL_PRICE_DIFFERENCES,
      });
    }

    // Bithumb D/W 집계 (네트워크별 OR — 하나라도 가능하면 가능)
    const bithumbDwMap = new Map();
    for (const r of (bithumbDwJson?.data ?? [])) {
      const sym = r.currency;
      const e = bithumbDwMap.get(sym) ?? { deposit: false, withdraw: false };
      if (Number(r.deposit_status) === 1) e.deposit = true;
      if (Number(r.withdrawal_status) === 1) e.withdraw = true;
      bithumbDwMap.set(sym, e);
    }

    const bnUsdtPrice = new Map();
    for (const t of bnAll) {
      if (t.symbol.endsWith("USDT")) {
        bnUsdtPrice.set(t.symbol.slice(0, -4), parseFloat(t.price));
      }
    }

    // 4. 심볼별 데이터 통합 (업비트 + 빗썸 union)
    const bySymbol = new Map();
    for (const t of upbitTickers) {
      const sym = t.market.slice(4); // KRW-XXX → XXX
      if (STABLECOINS.has(sym)) continue;
      const e = bySymbol.get(sym) ?? {};
      e.upbit_krw = t.trade_price;
      e.upbit_volume_24h_krw = t.acc_trade_price_24h ?? 0;
      e.upbit_change_24h_pct = (t.signed_change_rate ?? 0) * 100;
      bySymbol.set(sym, e);
    }
    for (const [sym, raw] of Object.entries(bithumbData)) {
      if (sym === "date" || STABLECOINS.has(sym)) continue;
      const close = parseFloat(raw.closing_price);
      const vol = parseFloat(raw.acc_trade_value_24H);
      const chg = parseFloat(raw.fluctate_rate_24H);
      if (!Number.isFinite(close) || close <= 0) continue;
      const e = bySymbol.get(sym) ?? {};
      e.bithumb_krw = close;
      e.bithumb_volume_24h_krw = Number.isFinite(vol) ? vol : 0;
      e.bithumb_change_24h_pct = Number.isFinite(chg) ? chg : 0;
      bySymbol.set(sym, e);
    }

    // 5. 김프 계산 (한국 통합가 = 거래대금 가중평균)
    const computed = [];
    for (const [sym, e] of bySymbol) {
      const usdtPrice = bnUsdtPrice.get(sym);
      if (!usdtPrice) continue;
      const upVol = e.upbit_volume_24h_krw ?? 0;
      const bhVol = e.bithumb_volume_24h_krw ?? 0;
      const totalVol = upVol + bhVol;
      if (totalVol <= 0) continue;
      const upPrice = e.upbit_krw ?? null;
      const bhPrice = e.bithumb_krw ?? null;
      let combinedKrw;
      if (upPrice && bhPrice) {
        combinedKrw = (upPrice * upVol + bhPrice * bhVol) / totalVol;
      } else {
        combinedKrw = upPrice ?? bhPrice;
      }
      if (!combinedKrw) continue;
      const upChg = e.upbit_change_24h_pct ?? 0;
      const bhChg = e.bithumb_change_24h_pct ?? 0;
      const change = totalVol > 0 ? (upChg * upVol + bhChg * bhVol) / totalVol : 0;
      const premium = ((combinedKrw / usdKrw - usdtPrice) / usdtPrice) * 100;
      const bhDw = bithumbDwMap.get(sym) ?? null;
      const upWarn = upbitWarnMap.get(sym) ?? null;
      // 빗썸 D/W 상태값 — bhDw가 null이면 빗썸 미상장이라 'unknown'
      let bithumb_dw_status = null;
      if (bhDw) {
        if (bhDw.deposit && bhDw.withdraw) bithumb_dw_status = "OK";
        else if (bhDw.deposit && !bhDw.withdraw) bithumb_dw_status = "DEPOSIT_ONLY"; // 출금 정지
        else if (!bhDw.deposit && bhDw.withdraw) bithumb_dw_status = "WITHDRAW_ONLY"; // 입금 정지
        else bithumb_dw_status = "SUSPENDED";
      }
      computed.push({
        symbol: sym,
        upbit_krw: upPrice,
        upbit_volume_24h_krw: upVol > 0 ? upVol : null,
        bithumb_krw: bhPrice,
        bithumb_volume_24h_krw: bhVol > 0 ? bhVol : null,
        combined_krw: combinedKrw,
        binance_usdt: usdtPrice,
        premium_pct: premium,
        total_volume_24h_krw: totalVol,
        change_24h_pct: change,
        bithumb_dw_status,
        upbit_warning: upWarn?.warning ?? false,
        upbit_kimchi_caution: upWarn?.kimchi_caution ?? false,
      });
    }
    if (computed.length === 0) return null;

    // 6. 고정 4종 + 평균 김프(거래대금 가중)
    const fixed = FIXED_SYMBOLS
      .map((s) => computed.find((c) => c.symbol === s))
      .filter(Boolean);
    const sumVol = fixed.reduce((a, c) => a + c.total_volume_24h_krw, 0);
    const avgPremium = sumVol > 0
      ? fixed.reduce((a, c) => a + c.premium_pct * c.total_volume_24h_krw, 0) / sumVol
      : null;

    // 7. 이상치 (5%+) / 역김프 (-1% 이하) — 고정 4 제외, 거래대금 5억+
    //    50% 초과·-30% 미만은 티커 충돌(같은 심볼 다른 토큰)로 간주하고 제외
    const fixedSet = new Set(FIXED_SYMBOLS);
    const collisions = computed.filter(
      (c) => !fixedSet.has(c.symbol)
        && c.total_volume_24h_krw >= MIN_VOLUME_KRW
        && (c.premium_pct > MAX_PREMIUM_PCT || c.premium_pct < MAX_REVERSE_PCT),
    );
    if (collisions.length) {
      console.warn(
        "  김프 티커 충돌 의심 제외:",
        collisions.map((c) => `${c.symbol}(${c.premium_pct.toFixed(0)}%)`).join(", "),
      );
    }
    const outliers = computed
      .filter((c) => !fixedSet.has(c.symbol)
        && c.total_volume_24h_krw >= MIN_VOLUME_KRW
        && c.premium_pct >= OUTLIER_PCT
        && c.premium_pct <= MAX_PREMIUM_PCT)
      .sort((a, b) => b.premium_pct - a.premium_pct)
      .slice(0, 8);
    const reverse = computed
      .filter((c) => !fixedSet.has(c.symbol)
        && c.total_volume_24h_krw >= MIN_VOLUME_KRW
        && c.premium_pct <= REVERSE_PCT
        && c.premium_pct >= MAX_REVERSE_PCT)
      .sort((a, b) => a.premium_pct - b.premium_pct)
      .slice(0, 5);

    return {
      usd_krw: usdKrw,
      avg_premium_pct: avgPremium,
      fixed,
      outliers,
      reverse,
    };
  } catch (e) {
    clearTimeout(tid);
    console.warn("  김치프리미엄 수집 실패:", e.message);
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

const BINANCE_BASE = process.env.BINANCE_PROXY_URL || "https://fapi.binance.com";

// CoinGecko 시총 매칭용 심볼 정규화: 1000PEPE → PEPE, 1MBABYDOGE → BABYDOGE 등
function normalizeSymbolForCap(symbol) {
  return symbol
    .toUpperCase()
    .replace(/^(\d+M?)/, "")  // 1000, 100, 10, 1M 등 prefix 제거
    .replace(/^[KM]/, "");    // K, M 단일 prefix 제거
}

function scoreAndRank(rawResults) {
  // 시총 확인된 코인 중 $20M 미만만 제거 (조작 위험), null은 소형 미확인으로 통과
  const filtered = rawResults.filter((c) => c.marketCapUsd === null || c.marketCapUsd >= 20_000_000);
  const sorted = [...filtered].sort((a, b) => b.volume4hUsd - a.volume4hUsd);
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
    const lScoreBonus = (coin.lScore !== null && coin.lScore !== undefined && coin.lScore < 0.1) ? 5 : 0;
    const priceOiSc = ((priceDown && oiUp) ? 30 : (priceUp && oiUp) ? 22 : (!priceUp && !priceDown && oiUp) ? 15 : (priceUp && !oiUp) ? 5 : 0) + lScoreBonus;
    const isPump = coin.volumeSpike > 5 && coin.priceChange1h > 0;
    const rvolBonus = (coin.volumeSpike >= 3 && !isPump) ? 5 : 0;
    const rankBase = volume4hRankPct <= 0.10 ? 20 : volume4hRankPct <= 0.25 ? 14 : volume4hRankPct <= 0.50 ? 7 : 0;
    const volumeSc = (isPump ? 0 : rankBase) + rvolBonus;
    const sideways = Math.abs(coin.priceChange4h) <= 2;
    const oiBuild  = coin.oiChangePct6h > 5;
    const volStart = coin.volumeSpike >= 1.3 && coin.volumeSpike <= 4;
    const timingSc = (sideways ? 5 : 0) + (oiBuild ? 10 : 0) + (volStart ? 5 : 0) + (sideways && oiBuild && volStart ? 5 : 0);
    const overheatP = (coin.priceChange1h > 8 ? 20 : 0) + (fundingPct > 0.03 ? 15 : 0) + (coin.volumeSpike > 5 ? 15 : 0);
    return { ...coin, volume4hRankPct, score: fundingSc + priceOiSc + volumeSc + timingSc - overheatP };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 50);
}

async function fetchFuturesScannerBinance(marketsTop250) {
  console.log("  [선물 스캐너] Binance 데이터 수집 중...");

  const [tickerRes, fundingRes] = await Promise.all([
    safeFetch(`${BINANCE_BASE}/fapi/v1/ticker/24hr`),
    safeFetch(`${BINANCE_BASE}/fapi/v1/premiumIndex`),
  ]);
  if (!tickerRes || !fundingRes) {
    console.log("  [선물 스캐너] Binance API 응답 없음");
    return null;
  }

  const tickers = await tickerRes.json();
  const fundings = await fundingRes.json();
  if (!Array.isArray(tickers) || !tickers.length) return null;

  const fundingMap = new Map();
  for (const f of (Array.isArray(fundings) ? fundings : [])) {
    if (typeof f.symbol === "string" && f.symbol.endsWith("USDT")) {
      fundingMap.set(f.symbol, parseFloat(f.lastFundingRate ?? "0"));
    }
  }

  const capMap = new Map();
  for (const coin of (marketsTop250 ?? [])) {
    if (coin.symbol) capMap.set(coin.symbol.toUpperCase(), coin.market_cap ?? null);
  }

  const candidates = tickers
    .filter((t) => typeof t.symbol === "string" && t.symbol.endsWith("USDT") && (fundingMap.get(t.symbol) ?? 0) > 0)
    .map((t) => ({
      symbol: t.symbol.replace(/USDT$/, ""),
      binanceSymbol: t.symbol,
      fundingRate: fundingMap.get(t.symbol) ?? 0,
      markPrice: parseFloat(t.lastPrice ?? "0"),
      high24h: parseFloat(t.highPrice ?? "0"),
      low24h: parseFloat(t.lowPrice ?? "0"),
    }));

  if (!candidates.length) { console.log("  [선물 스캐너] Binance 양수 펀딩비 없음"); return null; }
  console.log(`  [선물 스캐너] Binance 양수 펀딩비 ${candidates.length}개, 데이터 수집 중...`);

  const BATCH = 10;
  const rawResults = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const batchData = await Promise.all(
      batch.map(async (coin) => {
        try {
          const [klinesRes, oiRes] = await Promise.all([
            safeFetch(`${BINANCE_BASE}/fapi/v1/klines?symbol=${coin.binanceSymbol}&interval=1h&limit=8`),
            safeFetch(`${BINANCE_BASE}/futures/data/openInterestHist?symbol=${coin.binanceSymbol}&period=1h&limit=7`),
          ]);
          if (!klinesRes) return null;

          const klines = (await klinesRes.json()).reverse?.() ?? [];
          const lastComplete = klines[6];
          const candle4hAgo  = klines[3];
          if (!lastComplete) return null;

          const priceChange1h = parseFloat(lastComplete[1]) > 0
            ? ((parseFloat(lastComplete[4]) - parseFloat(lastComplete[1])) / parseFloat(lastComplete[1])) * 100
            : 0;
          const priceChange4h = candle4hAgo?.[1] && parseFloat(candle4hAgo[1]) > 0
            ? ((parseFloat(lastComplete[4]) - parseFloat(candle4hAgo[1])) / parseFloat(candle4hAgo[1])) * 100
            : 0;

          // quoteAssetVolume (index 7) = USDT 거래량
          const vol1h = parseFloat(lastComplete[7] ?? "0");
          const prevVols = klines.slice(1, 6).map((k) => parseFloat(k[7] ?? "0"));
          const avgPrevVol = prevVols.length > 0 ? prevVols.reduce((s, v) => s + v, 0) / prevVols.length : 0;
          const volumeSpike = avgPrevVol > 0 ? vol1h / avgPrevVol : 1;
          const volume4hUsd = klines.slice(3, 7).reduce((sum, k) => sum + parseFloat(k?.[7] ?? "0"), 0);

          let oiChangePct = 0;
          let oiChangePct6h = 0;
          if (oiRes) {
            const oiItems = (await oiRes.json()).filter?.(Boolean) ?? [];
            if (oiItems.length >= 2) {
              const curr = parseFloat(oiItems[oiItems.length - 1]?.sumOpenInterestValue ?? "0");
              const prev = parseFloat(oiItems[oiItems.length - 2]?.sumOpenInterestValue ?? "0");
              if (prev > 0) oiChangePct = ((curr - prev) / prev) * 100;
              const oldest = parseFloat(oiItems[0]?.sumOpenInterestValue ?? "0");
              if (oldest > 0) oiChangePct6h = ((curr - oldest) / oldest) * 100;
            }
          }

          // L-Score: (현재가 - 24h저점) / (24h고점 - 24h저점)
          const entryClose = parseFloat(lastComplete[4]);
          const lScore = (coin.high24h - coin.low24h) > 0
            ? parseFloat(((entryClose - coin.low24h) / (coin.high24h - coin.low24h)).toFixed(4))
            : null;

          // takerSellRatio: taker 매도 비율 (청산 proxy) — Binance 전용
          const takerBuyQuote = parseFloat(lastComplete[10] ?? "0");
          const quoteVol1h = parseFloat(lastComplete[7] ?? "0");
          const takerSellRatio = quoteVol1h > 0
            ? parseFloat(((quoteVol1h - takerBuyQuote) / quoteVol1h).toFixed(4))
            : null;

          // CVD 6h: 최근 6개 완성 캔들 누적 매수-매도 압력
          const cvd6h = klines.slice(1, 7).reduce((sum, k) => {
            const qv = parseFloat(k[7] ?? "0");
            const tbq = parseFloat(k[10] ?? "0");
            return sum + (2 * tbq - qv);
          }, 0);

          return {
            symbol: coin.symbol,
            fundingRate: coin.fundingRate,
            priceChange1h, priceChange4h,
            oiChangePct, oiChangePct6h,
            volume4hUsd, volumeSpike,
            marketCapUsd: capMap.get(coin.symbol.toUpperCase()) ?? capMap.get(normalizeSymbolForCap(coin.symbol)) ?? null,
            entryPrice: entryClose,
            takerSellRatio,
            cvd6h,
            lScore,
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
  console.log(`  [선물 스캐너] Binance 완료: ${top50.length}개 저장`);
  return top50;
}

async function fetchFuturesScannerOKX(marketsTop250) {
  console.log("  [선물 스캐너] OKX 데이터 수집 중...");

  const tickerRes = await safeFetch("https://www.okx.com/api/v5/market/tickers?instType=SWAP");
  if (!tickerRes) return null;
  const tickerJson = await tickerRes.json();

  const allTickers = (tickerJson.data ?? []).filter((t) => t.instId.endsWith("-USDT-SWAP"));
  if (!allTickers.length) return null;

  // 펀딩비 개별 조회 — 전체 코인 대상 (소형 코인 포함)
  const fundingMap = new Map();
  const BATCH_FR = 25;
  for (let i = 0; i < allTickers.length; i += BATCH_FR) {
    if (i > 0) await new Promise((r) => setTimeout(r, 150));
    const batch = allTickers.slice(i, i + BATCH_FR);
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

  const candidates = allTickers
    .filter((t) => (fundingMap.get(t.instId) ?? 0) > 0)
    .map((t) => ({
      symbol: t.instId.replace(/-USDT-SWAP$/, ""),
      instId: t.instId,
      fundingRate: fundingMap.get(t.instId) ?? 0,
      markPrice: parseFloat(t.last ?? "0"),
      high24h: parseFloat(t.high24h ?? "0"),
      low24h: parseFloat(t.low24h ?? "0"),
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

          const entryClose = parseFloat(lastComplete[4]);
          const lScore = (coin.high24h - coin.low24h) > 0
            ? parseFloat(((entryClose - coin.low24h) / (coin.high24h - coin.low24h)).toFixed(4))
            : null;

          return {
            symbol: coin.symbol,
            fundingRate: coin.fundingRate,
            priceChange1h, priceChange4h,
            oiChangePct, oiChangePct6h,
            volume4hUsd, volumeSpike,
            marketCapUsd: capMap.get(coin.symbol.toUpperCase()) ?? capMap.get(normalizeSymbolForCap(coin.symbol)) ?? null,
            entryPrice: entryClose,
            takerSellRatio: null,
            cvd6h: null,
            lScore,
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
      high24h: parseFloat(t.highPrice24h ?? "0"),
      low24h: parseFloat(t.lowPrice24h ?? "0"),
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

          const entryClose = parseFloat(lastComplete[4]);
          const lScore = (coin.high24h - coin.low24h) > 0
            ? parseFloat(((entryClose - coin.low24h) / (coin.high24h - coin.low24h)).toFixed(4))
            : null;

          return {
            symbol: coin.symbol,
            fundingRate: coin.fundingRate,
            priceChange1h, priceChange4h,
            oiChangePct, oiChangePct6h,
            volume4hUsd, volumeSpike,
            marketCapUsd: capMap.get(coin.symbol.toUpperCase()) ?? capMap.get(normalizeSymbolForCap(coin.symbol)) ?? null,
            entryPrice: entryClose,
            takerSellRatio: null,
            cvd6h: null,
            lScore,
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
  // 직접 접근이든 프록시든 항상 Binance 우선 시도
  const binanceResult = await fetchFuturesScannerBinance(marketsTop250);
  if (binanceResult && binanceResult.length > 0) return binanceResult;
  console.log("  [선물 스캐너] Binance 실패, OKX 폴백...");
  const okxResult = await fetchFuturesScannerOKX(marketsTop250);
  if (okxResult && okxResult.length > 0) return okxResult;
  console.log("  [선물 스캐너] OKX 실패, Bybit 폴백...");
  return fetchFuturesScannerBybit(marketsTop250);
}

// ── 데이터 수집 ───────────────────────────────────────────────────────────────

async function fetchAll() {
  console.log("데이터 수집 중...");

  const [globalRes, trendingRes, marketsRes, fngRes, dexRes] = await Promise.all([
    cgFetch("https://api.coingecko.com/api/v3/global"),
    cgFetch("https://api.coingecko.com/api/v3/search/trending"),
    cgFetch(
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
    ? await cgFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${trendingIds}&price_change_percentage=24h,7d&sparkline=false`)
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

  const [longShortRatio, netflows, kimchiPremium, hyperliquidPerps, coinCategories] = await Promise.all([
    fetchLongShortRatio(),
    fetchSmartMoneyNetflows(),
    fetchKimchiPremium(),
    fetchHyperliquidPerps(),
    fetchCoinCategories(),
  ]);
  // RSI는 순차 호출(CoinGecko rate limit)
  const rsiHeatmap = await fetchRsiHeatmap();
  const futuresScanner = await fetchFuturesScanner(marketsTop250);

  console.log(`  알트코인 시즌: ${altcoinSeason}, 롱/숏: ${longShortRatio}, 넷플로우: ${netflows?.length ?? 0}개, 김프 평균: ${kimchiPremium?.avg_premium_pct?.toFixed(2) ?? "—"}% (이상치 ${kimchiPremium?.outliers?.length ?? 0}개, 역김프 ${kimchiPremium?.reverse?.length ?? 0}개), 하이퍼리퀴드: ${hyperliquidPerps?.length ?? 0}개, 섹터: ${coinCategories?.length ?? 0}개, RSI 과매수: ${rsiHeatmap?.overbought?.length ?? 0}개, 과매도: ${rsiHeatmap?.oversold?.length ?? 0}개, 급등: ${gainersLosers?.gainers?.length ?? 0}개, 급락: ${gainersLosers?.losers?.length ?? 0}개`);

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

  return { market, trending: trendingCoins, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, kimchiPremium, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers, marketsTop250, futuresScanner };
}

// ── 편집 코멘트 생성 (룰 기반) ───────────────────────────────────────────────

function generateEditorial({ market, trending, fearGreed, dexChains, altcoinSeason, longShortRatio, netflows, kimchiPremium, hyperliquidPerps, coinCategories, rsiHeatmap, gainersLosers, marketsTop250, futuresScanner }) {
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

  return { sentiment, summary, highlights, market_comment: marketComment, coin_comment: coinComment, trending_comment: trendingComment, dex_comment: dexComment, fng_comment: fngComment, netflow_comment: netflowComment, altcoin_season: altcoinSeason ?? null, long_short_ratio: longShortRatio ?? null, netflows: netflows ?? null, kimchi_premium: kimchiPremium ?? null, hyperliquid_perps: hyperliquidPerps ?? null, coin_categories: coinCategories ?? null, rsi_heatmap: rsiHeatmap ?? null, gainers_losers: gainersLosers ?? null,
    coins_top250: marketsTop250 ? marketsTop250.map(c => ({
      symbol: (c.symbol ?? "").toUpperCase(),
      name: c.name ?? "",
      price_change_percentage_24h: c.price_change_percentage_24h ?? 0,
      price_change_percentage_7d_in_currency: c.price_change_percentage_7d_in_currency ?? 0,
    })) : null,
    futures_scanner: futuresScanner ?? [],
    futures_scanner_at: futuresScanner?.length ? new Date().toISOString() : null,
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
  const trendingLine = (trending ?? []).slice(0, 5).map((c, i) => `${rankBadge[i]} <b>${c.symbol.toUpperCase()}</b>`).join("\n");

  // 급등/급락 TOP 5 — 좌우 정렬 (monospace pre block)
  const glData = editorial.gainers_losers;
  const padR = (s, n) => (s + " ".repeat(n)).slice(0, n);
  const padL = (s, n) => (" ".repeat(n) + s).slice(-n);
  const fmtSide = (c, isGainer) => {
    if (!c) return " ".repeat(16);
    const sym = padR(String(c.symbol).toUpperCase(), 9);
    const v = c.price_change_percentage_24h;
    const pct = padL((isGainer && v >= 0 ? "+" : "") + v.toFixed(1) + "%", 7);
    return sym + pct;
  };
  let gainersLosersLines = null;
  if (glData) {
    const max = Math.max(glData.gainers.length, glData.losers.length);
    const rows = [];
    for (let i = 0; i < max; i++) {
      const left  = fmtSide(glData.gainers[i], true);
      const right = fmtSide(glData.losers[i], false);
      rows.push(`${left}   ${right}`);
    }
    gainersLosersLines =
      `<pre>🚀 급등 TOP 5       💥 급락 TOP 5\n` +
      rows.join("\n") +
      `</pre>`;
  }

  // RSI 히트맵 — 과매수/과매도 좌우 정렬 (monospace pre block)
  const rsiHm = editorial.rsi_heatmap;
  const fmtRsiSide = (r) => {
    if (!r) return " ".repeat(13);
    const sym = padR(String(r.symbol).toUpperCase(), 9);
    const num = padL(String(r.rsi_4h ?? "—"), 4);
    return sym + num;
  };
  let rsiBar = null;
  if (rsiHm && (rsiHm.overbought?.length || rsiHm.oversold?.length)) {
    const ob = (rsiHm.overbought ?? []).slice(0, 5);
    const os = (rsiHm.oversold   ?? []).slice(0, 5);
    const max = Math.max(ob.length, os.length);
    const rows = [];
    for (let i = 0; i < max; i++) {
      rows.push(`${fmtRsiSide(ob[i])}      ${fmtRsiSide(os[i])}`);
    }
    rsiBar =
      `<pre>🔴 과매수 (RSI 4H)  🟢 과매도 (RSI 4H)\n` +
      rows.join("\n") +
      `</pre>`;
  }

  // 스마트머니 넷플로우 — 좌우 정렬 + 체인 티커화
  const CHAIN_TICKER = {
    ethereum: "ETH", eth: "ETH",
    arbitrum: "ARB", "arbitrum-one": "ARB",
    optimism: "OP", op: "OP",
    base: "BASE",
    polygon: "POL", "polygon-pos": "POL", matic: "POL",
    bsc: "BSC", "binance-smart-chain": "BSC", "bnb chain": "BSC", "bnb smart chain": "BSC",
    solana: "SOL",
    avalanche: "AVAX",
    linea: "LIN",
    scroll: "SCRL",
    mantle: "MNT",
    blast: "BLST",
    zksync: "ZK", "zksync era": "ZK",
    sonic: "SNC",
  };
  const chainTicker = (c) => {
    if (!c) return "—";
    const k = String(c).toLowerCase();
    return CHAIN_TICKER[k] ?? String(c).slice(0, 4).toUpperCase();
  };
  const fmtNfSide = (n) => {
    if (!n) return " ".repeat(18);
    const sym = padR(String(n.token_symbol).toUpperCase(), 6);
    const abs = Math.abs(n.net_flow_24h_usd);
    const amt = abs >= 1e6 ? `$${(abs/1e6).toFixed(1)}M` : `$${(abs/1e3).toFixed(0)}K`;
    const amtPadded = padL(amt, 7);
    const chain = padR(chainTicker(n.chain), 4);
    return sym + amtPadded + " " + chain;
  };
  const nfAll = editorial.netflows ?? [];
  const nfIn  = nfAll.filter((n) => n.net_flow_24h_usd > 0).sort((a, b) => b.net_flow_24h_usd - a.net_flow_24h_usd).slice(0, 5);
  const nfOut = nfAll.filter((n) => n.net_flow_24h_usd < 0).sort((a, b) => a.net_flow_24h_usd - b.net_flow_24h_usd).slice(0, 5);
  let netflowLines = null;
  if (nfIn.length || nfOut.length) {
    const max = Math.max(nfIn.length, nfOut.length);
    const rows = [];
    for (let i = 0; i < max; i++) {
      rows.push(`${fmtNfSide(nfIn[i])}  ${fmtNfSide(nfOut[i])}`);
    }
    netflowLines =
      `<pre>🟢 매집              🔴 이탈\n` +
      rows.join("\n") +
      `</pre>`;
  }

  const stripDash = (s) => s ? s.replace(/^[^—]*—\s*/, "") : s;

  // 김치프리미엄 — 헤더 + 김프 알람·단절·역김프 표
  const kp = editorial.kimchi_premium;
  let kimchiBlock = null;
  if (kp) {
    const fmtKp = (n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
    const fmtKp1 = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
    const avg = kp.avg_premium_pct;
    const btc = (kp.fixed ?? []).find((c) => c.symbol === "BTC")?.premium_pct;
    const eth = (kp.fixed ?? []).find((c) => c.symbol === "ETH")?.premium_pct;

    const isBroken = (c) => (c.bithumb_dw_status != null && c.bithumb_dw_status !== "OK") || c.upbit_kimchi_caution;
    const real     = (kp.outliers ?? []).filter((c) => !isBroken(c)).slice(0, 5);
    const broken   = (kp.outliers ?? []).filter(isBroken).slice(0, 3);
    const reverseT = (kp.reverse ?? []).slice(0, 3);

    const statusTag = (c) => {
      if (c.bithumb_dw_status === "SUSPENDED")      return " 🚫입출";
      if (c.bithumb_dw_status === "DEPOSIT_ONLY")   return " ⛔출금";
      if (c.bithumb_dw_status === "WITHDRAW_ONLY")  return " ⛔입금";
      if (c.upbit_kimchi_caution)                   return " ⚠️주의";
      if (c.bithumb_dw_status === "OK")             return " 🟢정상";
      return "";
    };
    const fmtRow = (c) => {
      const sym = padR(c.symbol, 7);
      const pct = padL(fmtKp1(c.premium_pct), 7);
      const chg = c.change_24h_pct >= 0
        ? `▲${Math.abs(c.change_24h_pct).toFixed(1)}%`
        : `▼${Math.abs(c.change_24h_pct).toFixed(1)}%`;
      return `${sym}${pct}  ${chg}${statusTag(c)}`;
    };

    const blocks = [];
    if (real.length) {
      blocks.push(`🔥 김프 알람 <i>(정상 차익거래)</i>\n<pre>${real.map(fmtRow).join("\n")}</pre>`);
    }
    if (broken.length) {
      blocks.push(`🚫 차익거래 단절 <i>(입출금 정지·주의)</i>\n<pre>${broken.map(fmtRow).join("\n")}</pre>`);
    }
    if (reverseT.length) {
      blocks.push(`❄️ 역김프 <i>(매도세 시그널)</i>\n<pre>${reverseT.map(fmtRow).join("\n")}</pre>`);
    }

    const headerParts = [
      avg != null ? `평균 <b>${fmtKp(avg)}</b>` : null,
      btc != null ? `BTC ${fmtKp(btc)}` : null,
      eth != null ? `ETH ${fmtKp(eth)}` : null,
    ].filter(Boolean);
    const header = headerParts.join("  ·  ");
    kimchiBlock = blocks.length
      ? `${header}\n\n${blocks.join("\n\n")}`
      : header;
  }

  const sections = [
    `${emoji} <b>${editorial.sentiment}</b>\n${editorial.summary.replace(/\.\s+/g, ".\n")}`,
    indBlock ? `\n📊 <b>시장 지표</b>\n${indBlock}` : `\n📊 <b>시장 지표</b>`,
    coinLines ? `\n💰 <b>주요 코인</b>\n${coinLines}` : null,
    trendingLine ? `\n🔥 <b>트렌딩 코인</b> <i>(24h 검색량)</i>\n${trendingLine}` : null,
    gainersLosersLines ? `\n${gainersLosersLines}` : null,
    rsiBar ? `\n📈 <b>RSI 히트맵</b> <i>(4h)</i>\n${rsiBar}` : null,
    netflowLines ? `\n🧠 <b>스마트머니 넷플로우</b>\n${netflowLines}` : null,
    editorial.dex_comment ? `\n🌐 <b>온체인 자금흐름</b>\n<i>${stripDash(editorial.dex_comment)}</i>` : null,
    kimchiBlock ? `\n🇰🇷 <b>김치프리미엄</b>  <i>업비트+빗썸 vs Binance</i>\n${kimchiBlock}` : null,
    `\n<a href="https://stragos.xyz/crypto">➡️ 최신 브리핑 전체 보기</a>`,
    `🆕 <a href="https://stragos.xyz/crypto#futures"><b>선물 시그널</b></a> 신규 추가`,
    `📨 <i>6시간마다 발송</i>`,
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
  const forceTelegram = process.argv.includes("--force-telegram");
  const noTelegram = process.argv.includes("--no-telegram") || (!isTelegramHour && !forceTelegram);

  const payload = await fetchAll();
  const editorial = generateEditorial(payload);
  const { altcoinSeason: _as, longShortRatio: _ls, netflows: _nf, kimchiPremium: _kp, hyperliquidPerps: _hp, coinCategories: _cc, rsiHeatmap: _rsi, gainersLosers: _gl, marketsTop250: _m250, futuresScanner: _fs, ...dbPayload } = payload;

  if (isDryRun) {
    console.log("[dry-run] DB 저장 및 텔레그램 전송 생략");
    process.exit(0);
  }

  // 시장 데이터 수집 실패 시 저장/발송 중단.
  // upsert는 date 기준이라 그냥 진행하면 같은 날 앞선 성공 실행의 데이터를
  // null로 덮어써서 하루치가 통째로 "데이터 없음"이 된다.
  if (!payload.market) {
    console.error(
      `✗ 시장 데이터 수집 실패 (CoinGecko /global) — ${date} 저장·발송 건너뜀. 기존 데이터 유지.`
    );
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
  const btcChange1h = await fetchBtcChange1h();
  await insertFuturesSignals(payload.futuresScanner ?? [], btcChange1h);

  if (!noTelegram) await sendTelegramBriefing(date, payload, editorial);
}

async function updateFuturesSignalPrices() {
  try {
    const { data: pending } = await sb
      .from("futures_signals")
      .select("id, symbol, recorded_at, price_1h, price_4h, price_24h")
      .or("price_1h.is.null,price_4h.is.null,price_24h.is.null");

    if (!pending || pending.length === 0) return;

    // 현재가 가져오기 (Binance 프록시 → OKX → Bybit 폴백)
    const priceMap = new Map();

    // 1순위: Binance 프록시 (GitHub Actions에서 가장 안정적)
    const binanceRes = await safeFetch(`${BINANCE_BASE}/fapi/v1/ticker/price`);
    if (binanceRes) {
      const d = await binanceRes.json();
      for (const t of (Array.isArray(d) ? d : [])) {
        if (t.symbol?.endsWith("USDT")) {
          priceMap.set(t.symbol.replace(/USDT$/, ""), parseFloat(t.price ?? "0"));
        }
      }
    }

    // 2순위: OKX SWAP
    if (!priceMap.size) {
      const okxRes = await safeFetch("https://www.okx.com/api/v5/market/tickers?instType=SWAP");
      if (okxRes) {
        const d = await okxRes.json();
        for (const t of (d.data ?? [])) {
          if (t.instId.endsWith("-USDT-SWAP")) {
            priceMap.set(t.instId.replace(/-USDT-SWAP$/, ""), parseFloat(t.last ?? "0"));
          }
        }
      }
    }

    // 3순위: Bybit
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

async function fetchBtcChange1h() {
  try {
    const res = await safeFetch(`${BINANCE_BASE}/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=2`);
    if (!res) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) return null;
    const prev = parseFloat(data[0][1]);
    const curr = parseFloat(data[1][4]);
    return prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(3)) : null;
  } catch {
    return null;
  }
}

async function insertFuturesSignals(top50, btcChange1h = null) {
  try {
    const top10 = top50.slice(0, 10);
    if (top10.length === 0) return;
    if (btcChange1h !== null && Math.abs(btcChange1h) > 3) {
      console.log(`  [신호 추적] BTC 1h ${btcChange1h}% — 변동성 필터(±3%) 적용, 신호 기록 건너뜀`);
      return;
    }
    const now = new Date().toISOString();
    const rows = top10.map((coin, idx) => ({
      recorded_at: now,
      symbol: coin.symbol,
      rank: idx + 1,
      entry_price: coin.entryPrice,
      score: coin.score,
      funding_rate: coin.fundingRate ?? null,
      price_change_1h: coin.priceChange1h ?? null,
      oi_change_pct: coin.oiChangePct ?? null,
      rel_volume: coin.volumeSpike ?? null,
      taker_sell_ratio: coin.takerSellRatio ?? null,
      cvd_6h: coin.cvd6h ?? null,
      l_score: coin.lScore ?? null,
      btc_change_1h: btcChange1h,
    }));
    const { error } = await sb.from("futures_signals").insert(rows);
    if (error) console.warn("  [신호 추적] INSERT 실패:", error.message);
    else console.log(`  [신호 추적] TOP 10 신호 기록 완료 (${now.slice(0, 16)}) BTC 1h: ${btcChange1h}%`);
  } catch (e) {
    console.warn("  [신호 추적] INSERT 예외:", e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
