type SectorItem = {
  id: string;
  name: string;
  market_cap_change_24h: number;
  volume_24h: number | null;
};

function cellStyle(pct: number): { bg: string; border: string; text: string } {
  const abs = Math.abs(pct);
  const isUp = pct >= 0;

  if (isUp) {
    if (abs >= 10) return { bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300 dark:border-emerald-700/50", text: "text-emerald-700 dark:text-emerald-300" };
    if (abs >= 5)  return { bg: "bg-emerald-50 dark:bg-emerald-900/20",  border: "border-emerald-200 dark:border-emerald-800/50", text: "text-emerald-600 dark:text-emerald-400" };
    if (abs >= 2)  return { bg: "bg-emerald-50/70 dark:bg-emerald-900/10", border: "border-emerald-200/70 dark:border-emerald-800/30", text: "text-emerald-600 dark:text-emerald-400" };
    return           { bg: "bg-emerald-50/40 dark:bg-emerald-900/5",   border: "border-emerald-100 dark:border-emerald-900/20", text: "text-emerald-500 dark:text-emerald-500" };
  } else {
    if (abs >= 10) return { bg: "bg-red-100 dark:bg-red-900/30",      border: "border-red-300 dark:border-red-700/50",      text: "text-red-700 dark:text-red-300" };
    if (abs >= 5)  return { bg: "bg-red-50 dark:bg-red-900/20",        border: "border-red-200 dark:border-red-800/50",      text: "text-red-600 dark:text-red-400" };
    if (abs >= 2)  return { bg: "bg-red-50/70 dark:bg-red-900/10",     border: "border-red-200/70 dark:border-red-800/30",   text: "text-red-500 dark:text-red-400" };
    return           { bg: "bg-red-50/40 dark:bg-red-900/5",          border: "border-red-100 dark:border-red-900/20",      text: "text-red-400 dark:text-red-500" };
  }
}

function SectorCell({ s }: { s: SectorItem }) {
  const pct = s.market_cap_change_24h;
  const { bg, border, text } = cellStyle(pct);

  return (
    <div className={`rounded-xl border px-3 py-2 flex flex-col gap-0.5 ${bg} ${border}`}>
      <div className="relative group/tip cursor-default min-w-0">
        <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-tight truncate block">{s.name}</span>
        <span className="pointer-events-none absolute left-0 top-full mt-1 z-50 whitespace-nowrap rounded-md bg-gray-800 dark:bg-slate-700 px-2 py-1 text-[11px] text-white opacity-0 group-hover/tip:opacity-100 transition-opacity duration-75 shadow-lg">
          {s.name}
        </span>
      </div>
      <span className={`text-[12px] font-black tabular-nums ${text}`}>
        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function SectorPerformanceSection({ sectors }: { sectors: SectorItem[] }) {
  if (!sectors?.length) return null;

  const sorted = [...sectors]
    .filter((s) => s.market_cap_change_24h != null)
    .sort((a, b) => b.market_cap_change_24h - a.market_cap_change_24h);

  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  return (
    <section className="flex flex-col h-full">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pl-3 border-l-2 border-indigo-500">
        🏷️ 섹터별 24h 성과
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 flex-1 sm:items-stretch">
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50">
            <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">🚀 상승 TOP 5</span>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {top5.map((s) => <SectorCell key={s.id} s={s} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
            <span className="text-[12px] font-bold text-red-500">💥 하락 TOP 5</span>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {bottom5.map((s) => <SectorCell key={s.id} s={s} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
