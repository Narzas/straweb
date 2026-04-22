import { NextResponse } from "next/server";

async function yahooQuote(symbol: string): Promise<{ price: number | null; change: number | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return { price: null, change: null };
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return { price: null, change: null };
    const price: number | null = meta.regularMarketPrice ?? meta.previousClose ?? null;
    const prev: number | null = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change = price && prev ? ((price - prev) / prev) * 100 : null;
    return { price, change };
  } catch {
    return { price: null, change: null };
  }
}

export async function GET() {
  try {
    const [btcRes, fxRes, nasdaq, kospi, kosdaq] = await Promise.all([
      fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,krw&include_24hr_change=true",
        { next: { revalidate: 300 } }
      ),
      fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 300 } }),
      yahooQuote("^IXIC"),
      yahooQuote("^KS11"),
      yahooQuote("^KQ11"),
    ]);

    const btcData = btcRes.ok ? await btcRes.json() : {};
    const fxData  = fxRes.ok  ? await fxRes.json()  : {};

    return NextResponse.json(
      {
        bitcoin: {
          usd: btcData.bitcoin?.usd ?? null,
          krw: btcData.bitcoin?.krw ?? null,
          change24h: btcData.bitcoin?.usd_24h_change ?? null,
        },
        nasdaq,
        kospi,
        kosdaq,
        usdKrw: fxData.rates?.KRW ?? null,
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
