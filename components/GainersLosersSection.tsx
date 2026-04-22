type GainerLoserItem = {
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  image?: string | null;
};

type GainersLosersData = {
  gainers: GainerLoserItem[];
  losers: GainerLoserItem[];
};

function fmtPrice(n: number) {
  if (n >= 1) return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + n.toFixed(4);
}

function Row({ item, isGainer }: { item: GainerLoserItem; isGainer: boolean }) {
  const pct = item.price_change_percentage_24h;
  return (
    <div className={`flex flex-1 items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-slate-700/50 last:border-0 transition-colors ${isGainer ? "hover:bg-emerald-500/5" : "hover:bg-red-500/5"}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.symbol} loading="lazy" className="w-4 h-4 rounded-full shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100 truncate">{item.symbol}</p>
          <div className="relative group/tip cursor-default">
            <p className="text-[10px] text-gray-400 truncate">{item.name}</p>
            <span className="pointer-events-none absolute left-0 top-full mt-1 z-50 whitespace-nowrap rounded-md bg-gray-800 dark:bg-slate-700 px-2 py-1 text-[11px] text-white opacity-0 group-hover/tip:opacity-100 transition-opacity duration-75 shadow-lg">
              {item.name}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-1">
        <p className={`text-[12px] font-bold tabular-nums ${isGainer ? "text-emerald-500" : "text-red-500"}`}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
        </p>
        <p className="text-[10px] text-gray-400 tabular-nums">{fmtPrice(item.current_price)}</p>
      </div>
    </div>
  );
}

export default function GainersLosersSection({ data }: { data: GainersLosersData }) {
  if (!data?.gainers?.length && !data?.losers?.length) return null;

  return (
    <section className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pl-3 border-l-2 border-indigo-500">
        📊 수익률 TOP/BOTTOM <span className="text-[11px] font-normal text-gray-400">(시총 250위 내 24h)</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 flex-1 sm:items-stretch">
        {data.gainers?.length > 0 && (
          <div className="rounded-2xl border border-slate-700/50 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50">
              <span className="text-[12px] font-bold text-emerald-500">🚀 급등 TOP 5</span>
            </div>
            <div className="flex flex-col flex-1">
              {data.gainers.map((item) => <Row key={item.symbol} item={item} isGainer={true} />)}
            </div>
          </div>
        )}
        {data.losers?.length > 0 && (
          <div className="rounded-2xl border border-slate-700/50 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
              <span className="text-[12px] font-bold text-red-500">💥 급락 TOP 5</span>
            </div>
            <div className="flex flex-col flex-1">
              {data.losers.map((item) => <Row key={item.symbol} item={item} isGainer={false} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
