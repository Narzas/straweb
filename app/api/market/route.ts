import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [btcRes, fxRes] = await Promise.all([
      fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,krw&include_24hr_change=true",
        { next: { revalidate: 60 } }
      ),
      fetch("https://open.er-api.com/v6/latest/USD", {
        next: { revalidate: 300 },
      }),
    ]);

    const btcData = await btcRes.json();
    const fxData = await fxRes.json();

    return NextResponse.json(
      {
        bitcoin: {
          usd: btcData.bitcoin?.usd ?? null,
          krw: btcData.bitcoin?.krw ?? null,
          change24h: btcData.bitcoin?.usd_24h_change ?? null,
        },
        usdKrw: fxData.rates?.KRW ?? null,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
