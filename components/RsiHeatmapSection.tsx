type RsiItem = {
  symbol: string;
  rsi_4h: number | null;
  rsi_1d: number | null;
  rsi_1w: number | null;
};

type RsiData = {
  overbought: RsiItem[];
  oversold: RsiItem[];
};

function rsiCellColor(v: number | null, isOverbought: boolean): string {
  if (v == null) return "text-gray-400";
  if (v >= 75) return "text-red-600 dark:text-red-400 font-black";
  if (v >= 70) return "text-red-500 font-bold";
  if (v <= 25) return "text-emerald-600 dark:text-emerald-400 font-black";
  if (v <= 30) return "text-emerald-500 font-bold";
  return isOverbought ? "text-orange-400" : "text-sky-400";
}

function Row({ r, isOverbought }: { r: RsiItem; isOverbought: boolean }) {
  return (
    <div className="grid grid-cols-4 items-center px-3 py-2 border-b border-gray-100 dark:border-slate-700/50 last:border-0">
      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{r.symbol}</span>
      <span className={`text-center text-sm tabular-nums ${rsiCellColor(r.rsi_4h, isOverbought)}`}>{r.rsi_4h ?? "—"}</span>
      <span className={`text-center text-sm tabular-nums ${rsiCellColor(r.rsi_1d, isOverbought)}`}>{r.rsi_1d ?? "—"}</span>
      <span className={`text-center text-sm tabular-nums ${rsiCellColor(r.rsi_1w, isOverbought)}`}>{r.rsi_1w ?? "—"}</span>
    </div>
  );
}

function TableHeader() {
  return (
    <div className="grid grid-cols-4 text-[11px] font-bold text-gray-400 uppercase px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
      <span>코인</span>
      <span className="text-center">4H</span>
      <span className="text-center">1D</span>
      <span className="text-center">1W</span>
    </div>
  );
}

export default function RsiHeatmapSection({ data }: { data: RsiData }) {
  const { overbought, oversold } = data;
  if (!overbought.length && !oversold.length) return null;

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        📈 RSI 히트맵 <span className="text-[11px] font-normal text-gray-400">(4h 기준)</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {overbought.length > 0 && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 overflow-hidden">
            <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
              <span className="text-[12px] font-bold text-red-500">🔴 과매수 RSI ≥ 70</span>
            </div>
            <TableHeader />
            {overbought.map((r) => <Row key={r.symbol} r={r} isOverbought={true} />)}
          </div>
        )}
        {oversold.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-800 overflow-hidden">
            <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50">
              <span className="text-[12px] font-bold text-emerald-500">🟢 과매도 RSI ≤ 30</span>
            </div>
            <TableHeader />
            {oversold.map((r) => <Row key={r.symbol} r={r} isOverbought={false} />)}
          </div>
        )}
        {!overbought.length && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 px-4 py-6 flex items-center justify-center">
            <span className="text-sm text-gray-400">과매수 없음</span>
          </div>
        )}
        {!oversold.length && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-800 px-4 py-6 flex items-center justify-center">
            <span className="text-sm text-gray-400">과매도 없음</span>
          </div>
        )}
      </div>
    </section>
  );
}
