type SectorItem = {
  id: string;
  name: string;
  market_cap_change_24h: number;
  volume_24h: number | null;
};

function Badge({ s }: { s: SectorItem }) {
  const pct = s.market_cap_change_24h;
  const isUp = pct >= 0;
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-slate-700/50 last:border-0">
      <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{s.name}</span>
      <span className={`ml-2 shrink-0 text-sm font-bold tabular-nums ${isUp ? "text-emerald-500" : "text-red-500"}`}>
        {isUp ? "+" : ""}{pct.toFixed(1)}%
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
    <section>
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        🏷️ 섹터별 24h 성과 <span className="text-[11px] font-normal text-gray-400">(상위/하위 5개)</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50">
            <span className="text-[12px] font-bold text-emerald-500">🚀 상승 TOP 5</span>
          </div>
          {top5.map((s) => <Badge key={s.id} s={s} />)}
        </div>
        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
            <span className="text-[12px] font-bold text-red-500">💥 하락 TOP 5</span>
          </div>
          {bottom5.map((s) => <Badge key={s.id} s={s} />)}
        </div>
      </div>
    </section>
  );
}
