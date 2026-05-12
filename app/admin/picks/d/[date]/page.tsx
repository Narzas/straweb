import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { PickCard } from "@/components/admin/PickCard";
import type { BuyPick, Timeframe } from "@/lib/buy-picks";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "매수타점 일자별",
  robots: { index: false, follow: false },
};

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${date} (${weekday})`;
}

type StockMeta = { ticker: string; name: string; market: string };

export default async function PicksByDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const sb = createServiceClient();
  const { data: rows, error } = await sb
    .from("buy_picks")
    .select(
      "date,ticker,pattern,timeframe,score,entry_price,current_price,target_price,stop_loss,note,rrr,generated_at,detection_meta"
    )
    .eq("date", date)
    .order("score", { ascending: false });

  if (error) {
    console.error("[picks-by-date]", error);
  }

  const picksRaw = rows ?? [];
  if (picksRaw.length === 0) notFound();

  const tickers = Array.from(new Set(picksRaw.map((p) => p.ticker)));
  const { data: stocksRows } = await sb
    .from("stocks")
    .select("ticker,name,market")
    .in("ticker", tickers);
  const stockMap = new Map<string, StockMeta>();
  for (const s of (stocksRows ?? []) as StockMeta[]) stockMap.set(s.ticker, s);

  // 시총 일괄 fetch — 가장 최근 daily_ohlcv 의 market_cap
  const { data: latestDateRow } = await sb
    .from("daily_ohlcv")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  const latestDate = latestDateRow?.[0]?.date as string | undefined;
  const capMap = new Map<string, number>();
  if (latestDate) {
    const { data: caps } = await sb
      .from("daily_ohlcv")
      .select("ticker,market_cap")
      .eq("date", latestDate)
      .in("ticker", tickers);
    for (const c of caps ?? []) {
      if (c.market_cap != null) capMap.set(c.ticker, Number(c.market_cap));
    }
  }

  const picks: BuyPick[] = picksRaw.map((r) => {
    const meta = stockMap.get(r.ticker);
    return {
      code: r.ticker,
      name: meta?.name ?? r.ticker,
      market: ((meta?.market ?? "KOSPI") as "KOSPI" | "KOSDAQ"),
      pattern: r.pattern,
      timeframe: (r.timeframe ?? "DAILY") as Timeframe,
      entry_price: Number(r.entry_price),
      current_price: r.current_price != null ? Number(r.current_price) : null,
      target_price: r.target_price != null ? Number(r.target_price) : null,
      stop_loss: r.stop_loss != null ? Number(r.stop_loss) : null,
      note: r.note,
      score: r.score,
      rrr: r.rrr != null ? Number(r.rrr) : null,
      market_cap: capMap.get(r.ticker) ?? null,
      detection_meta: r.detection_meta ?? null,
    };
  });

  const tfCounts = picks.reduce<Record<string, number>>((acc, p) => {
    acc[p.timeframe] = (acc[p.timeframe] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <nav className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Link
            href="/admin/picks"
            className="hover:text-gray-900 dark:hover:text-gray-100"
          >
            매수타점
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="text-gray-900 dark:text-gray-200">{date}</span>
        </nav>
        <div className="mt-2 flex items-baseline gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatDateLabel(date)}
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {picks.length}종목
          </span>
          <div className="flex gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {Object.entries(tfCounts).map(([tf, n]) => (
              <span key={tf} className="bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {tf} {n}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {picks.map((p) => (
          <PickCard key={`${p.code}-${p.timeframe}-${p.pattern}`} pick={p} />
        ))}
      </div>
    </div>
  );
}
