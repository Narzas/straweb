type SectorItem = {
  id: string;
  name: string;
  market_cap_change_24h: number;
  volume_24h: number | null;
};

function changeColor(v: number) {
  if (v >= 5) return "text-emerald-500";
  if (v >= 2) return "text-emerald-400";
  if (v >= 0) return "text-lime-500";
  if (v >= -2) return "text-orange-400";
  if (v >= -5) return "text-red-400";
  return "text-red-500";
}

export default function SectorPerformanceSection({ sectors }: { sectors: SectorItem[] }) {
  if (!sectors?.length) return null;

  const sorted = [...sectors].sort((a, b) => b.market_cap_change_24h - a.market_cap_change_24h);

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        🏷️ 섹터별 24h 성과
      </h2>
      <div className="flex flex-wrap gap-1.5 p-3">
        {sorted.map((s) => {
          const text = changeColor(s.market_cap_change_24h);
          const pct = s.market_cap_change_24h;
          return (
            <span
              key={s.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                pct >= 0
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50"
                  : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50"
              }`}
            >
              <span className="text-gray-600 dark:text-gray-400 font-medium">{s.name}</span>
              <span className={`${text} tabular-nums`}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
