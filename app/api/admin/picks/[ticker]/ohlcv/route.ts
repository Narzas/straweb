import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  if (!/^\d{6}$/.test(ticker)) {
    return NextResponse.json({ error: "invalid ticker" }, { status: 400 });
  }

  const url = new URL(req.url);
  const months = Math.max(1, Math.min(180, Number(url.searchParams.get("months") ?? 18)));
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceIso = since.toISOString().slice(0, 10);

  const sb = createServiceClient();
  const rows: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];

  let offset = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await sb
      .from("daily_ohlcv")
      .select("date,open,high,low,close,volume")
      .eq("ticker", ticker)
      .gte("date", sinceIso)
      .order("date", { ascending: true })
      .range(offset, offset + page - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    rows.push(
      ...data.map((d) => ({
        date: d.date as string,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        volume: Number(d.volume),
      }))
    );
    if (data.length < page) break;
    offset += page;
  }

  return NextResponse.json({ ticker, count: rows.length, rows });
}
