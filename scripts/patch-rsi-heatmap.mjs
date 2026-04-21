// RSI 히트맵만 가져와서 오늘 DB 레코드에 패치
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function safeFetch(url, timeoutMs = 15_000, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "CryptoBriefBot/1.0" },
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (res.status === 429) {
        const wait = parseInt(res.headers.get("Retry-After") ?? "2") * 1000 || 2000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) { console.error("HTTP", res.status, url); return null; }
      return res;
    } catch (e) {
      clearTimeout(tid);
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 1000));
      else console.error("Fetch error:", e.message);
    }
  }
  return null;
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

async function fetchRsiHeatmap() {
  console.log("OKX 티커 목록 가져오는 중...");
  const tickersRes = await safeFetch("https://www.okx.com/api/v5/market/tickers?instType=SPOT");
  if (!tickersRes) return null;
  const tickersData = await tickersRes.json();
  if (tickersData.code !== "0" || !Array.isArray(tickersData.data)) return null;

  const symbols = tickersData.data
    .filter((t) => t.instId.endsWith("-USDT"))
    .sort((a, b) => parseFloat(b.volCcy24h) - parseFloat(a.volCcy24h))
    .slice(0, 100)
    .map((t) => t.instId);

  console.log(`심볼 ${symbols.length}개 처리 중...`);

  const BATCH = 10;
  const results = [];
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(async (instId) => {
        try {
          const res = await safeFetch(
            `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=4H&limit=300`
          );
          if (!res) return null;
          const data = await res.json();
          if (data.code !== "0" || !Array.isArray(data.data) || data.data.length < 30) return null;
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
    process.stdout.write(`  ${Math.min(i + BATCH, symbols.length)}/${symbols.length}\r`);
    if (i + BATCH < symbols.length) await new Promise((r) => setTimeout(r, 1000));
  }

  const valid = results.filter((r) => r && r.rsi_4h != null);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => b.rsi_4h - a.rsi_4h);
  const overbought = sorted.slice(0, 5);
  const oversold   = [...valid].sort((a, b) => a.rsi_4h - b.rsi_4h).slice(0, 5);
  const all = sorted.slice(0, 80);
  console.log(`\n과매수 ${overbought.length}개, 과매도 ${oversold.length}개`);
  return { overbought, oversold, all };
}

const today = new Date().toISOString().slice(0, 10);

const { data: row, error: fetchErr } = await sb
  .from("crypto_daily")
  .select("editorial")
  .eq("date", today)
  .maybeSingle();

if (fetchErr) { console.error("DB 조회 실패:", fetchErr.message); process.exit(1); }
if (!row) { console.error("오늘 레코드 없음:", today); process.exit(1); }

const rsiHeatmap = await fetchRsiHeatmap();
if (!rsiHeatmap) { console.error("RSI 수집 실패"); process.exit(1); }

const { error: updateErr } = await sb
  .from("crypto_daily")
  .update({ editorial: { ...row.editorial, rsi_heatmap: rsiHeatmap } })
  .eq("date", today);

if (updateErr) { console.error("DB 저장 실패:", updateErr.message); process.exit(1); }
console.log("완료! rsi_heatmap 저장됨 →", today);
