import { createServiceClient } from "@/lib/supabase";

export type Timeframe = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type BuyPick = {
  code: string;
  name: string;
  market: "KOSPI" | "KOSDAQ";
  pattern: string;
  timeframe: Timeframe;
  entry_price: number;
  current_price?: number | null;
  target_price?: number | null;
  stop_loss?: number | null;
  note?: string | null;
  score?: number;
  candle_confirm?: string | null;
  rrr?: number | null;
};

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  DAILY: "일봉",
  WEEKLY: "주봉",
  MONTHLY: "월봉",
  YEARLY: "년봉",
};

export const TIMEFRAME_COLORS: Record<
  Timeframe,
  { bg: string; text: string; ring: string }
> = {
  DAILY: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200 dark:ring-emerald-800",
  },
  WEEKLY: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    ring: "ring-blue-200 dark:ring-blue-800",
  },
  MONTHLY: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-200 dark:ring-violet-800",
  },
  YEARLY: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200 dark:ring-rose-800",
  },
};

export type BuyPickDay = {
  date: string;
  generated_at: string;
  picks: BuyPick[];
};

const PATTERN_LABELS: Record<string, string> = {
  DOUBLE_BOTTOM: "쌍바닥",
  TRIPLE_BOTTOM: "삼바닥",
  INVERSE_HS: "역헤드앤숄더",
  CUP_HANDLE: "컵 위드 핸들",
  ELLIOTT_W2: "엘리엇 2파 종결",
  ELLIOTT_W4: "엘리엇 4파 종결",
  HIGH_WAVE: "하이웨이브",
  DRAGONFLY_DOJI: "잠자리 도지",
};

const CANDLE_LABELS: Record<string, string> = {
  DRAGONFLY_DOJI: "잠자리 도지",
  GRAVESTONE_DOJI: "비석 도지",
  LONG_LEGGED_DOJI: "장대 도지",
  STANDARD_DOJI: "도지",
  HIGH_WAVE: "하이웨이브",
};

export function labelPattern(raw: string): string {
  return PATTERN_LABELS[raw] ?? raw;
}

export function labelCandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return CANDLE_LABELS[raw] ?? raw;
}

type PickRow = {
  date: string;
  ticker: string;
  pattern: string;
  timeframe: string;
  score: number;
  entry_price: number;
  current_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  candle_confirm: string | null;
  note: string | null;
  rrr: number | null;
  generated_at: string;
};

type StockMeta = { ticker: string; name: string; market: string };

export async function getBuyPickDays(daysBack = 14): Promise<BuyPickDay[]> {
  const sb = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data: picks, error } = await sb
    .from("buy_picks")
    .select(
      "date,ticker,pattern,timeframe,score,entry_price,current_price,target_price,stop_loss,candle_confirm,note,rrr,generated_at"
    )
    .gte("date", sinceIso)
    .order("date", { ascending: false })
    .order("score", { ascending: false });

  if (error) {
    console.error("[buy-picks] query failed:", error);
    return [];
  }
  if (!picks || picks.length === 0) return [];

  const tickers = Array.from(new Set(picks.map((p: PickRow) => p.ticker)));
  const { data: stocksRows } = await sb
    .from("stocks")
    .select("ticker,name,market")
    .in("ticker", tickers);

  const stockMap = new Map<string, StockMeta>();
  for (const s of (stocksRows ?? []) as StockMeta[]) {
    stockMap.set(s.ticker, s);
  }

  const byDate = new Map<string, { generated_at: string; picks: BuyPick[] }>();
  for (const row of picks as PickRow[]) {
    const stock = stockMap.get(row.ticker);
    const market = (stock?.market ?? "KOSPI") as "KOSPI" | "KOSDAQ";
    const pick: BuyPick = {
      code: row.ticker,
      name: stock?.name ?? row.ticker,
      market,
      pattern: row.pattern,
      timeframe: (row.timeframe ?? "DAILY") as Timeframe,
      entry_price: Number(row.entry_price),
      current_price: row.current_price != null ? Number(row.current_price) : null,
      target_price: row.target_price != null ? Number(row.target_price) : null,
      stop_loss: row.stop_loss != null ? Number(row.stop_loss) : null,
      note: row.note,
      score: row.score,
      candle_confirm: row.candle_confirm,
      rrr: row.rrr != null ? Number(row.rrr) : null,
    };
    const entry = byDate.get(row.date);
    if (entry) {
      entry.picks.push(pick);
      if (row.generated_at > entry.generated_at) entry.generated_at = row.generated_at;
    } else {
      byDate.set(row.date, {
        generated_at: row.generated_at,
        picks: [pick],
      });
    }
  }

  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, generated_at: v.generated_at, picks: v.picks }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
