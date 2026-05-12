import Link from "next/link";
import { TIMEFRAME_COLORS, TIMEFRAME_LABELS, type BuyPickDay } from "@/lib/buy-picks";

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${date} (${weekday})`;
}

export function DaySummaryCard({ day }: { day: BuyPickDay }) {
  const topScore = day.picks.reduce(
    (m, p) => Math.max(m, p.score ?? 0),
    0
  );
  const tfCounts = day.picks.reduce<Record<string, number>>((acc, p) => {
    acc[p.timeframe] = (acc[p.timeframe] ?? 0) + 1;
    return acc;
  }, {});
  const topPick = [...day.picks].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  )[0];

  return (
    <Link
      href={`/admin/picks/d/${day.date}`}
      className="group flex flex-col rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all overflow-hidden"
    >
      <header className="border-b border-gray-100 dark:border-slate-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
            {formatDateLabel(day.date)}
          </h2>
          <span className="text-[11px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
            {day.picks.length}종목
          </span>
        </div>
      </header>

      <div className="flex-1 px-5 py-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">최고점</div>
            <div className="text-lg font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
              {topScore}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">종목수</div>
            <div className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
              {day.picks.length}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">평균 R/R</div>
            <div className="text-lg font-bold font-mono tabular-nums text-violet-700 dark:text-violet-300">
              {(() => {
                const valid = day.picks.filter((p) => p.rrr != null);
                if (valid.length === 0) return "—";
                const avg =
                  valid.reduce((s, p) => s + (p.rrr ?? 0), 0) / valid.length;
                return avg.toFixed(1);
              })()}
            </div>
          </div>
        </div>

        {/* 타임프레임별 분포 */}
        <div className="flex flex-wrap gap-1.5">
          {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map((tf) =>
            tfCounts[tf] ? (
              <span
                key={tf}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ring-1 ring-inset ${TIMEFRAME_COLORS[tf].bg} ${TIMEFRAME_COLORS[tf].text} ${TIMEFRAME_COLORS[tf].ring}`}
              >
                {TIMEFRAME_LABELS[tf]} {tfCounts[tf]}
              </span>
            ) : null
          )}
        </div>

        {/* 최고 점수 종목 미리보기 */}
        {topPick && (
          <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
              최고점 종목
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">
                  {topPick.name}
                </span>
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                  {topPick.code}
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold tabular-nums text-amber-700 dark:text-amber-300">
                {topPick.score}점
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
