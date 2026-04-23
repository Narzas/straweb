"use client";

interface Signal {
  id: number;
  recorded_at: string;
  symbol: string;
  rank: number;
  entry_price: number;
  score: number;
  price_1h: number | null;
  price_4h: number | null;
  price_24h: number | null;
}

interface Props {
  signals: Signal[];
}

function pnl(entry: number, exit: number | null): number | null {
  if (!exit || entry === 0) return null;
  return ((exit - entry) / entry) * 100;
}

function PnlBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300 dark:text-gray-600 text-[11px]">—</span>;
  const positive = value >= 0;
  return (
    <span className={`text-[11px] font-semibold ${positive ? "text-emerald-500" : "text-red-400"}`}>
      {positive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function statsFor(signals: Signal[], field: "price_1h" | "price_4h" | "price_24h") {
  const results = signals
    .map((s) => pnl(s.entry_price, s[field]))
    .filter((v): v is number => v !== null);
  if (results.length === 0) return null;
  const wins = results.filter((v) => v > 0).length;
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  return { count: results.length, winRate: (wins / results.length) * 100, avg };
}

function StatChip({ label, stats }: { label: string; stats: ReturnType<typeof statsFor> }) {
  if (!stats) return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 min-w-[72px]">
      <span className="text-[10px] text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-[11px] text-gray-300 dark:text-gray-600 mt-0.5">집계중</span>
    </div>
  );
  return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 min-w-[72px]">
      <span className="text-[10px] text-gray-400 dark:text-gray-500">{label} ({stats.count}건)</span>
      <span className={`text-sm font-bold mt-0.5 ${stats.avg >= 0 ? "text-emerald-500" : "text-red-400"}`}>
        {stats.avg >= 0 ? "+" : ""}{stats.avg.toFixed(2)}%
      </span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500">승률 {stats.winRate.toFixed(0)}%</span>
    </div>
  );
}

export default function FuturesTrackingSection({ signals }: Props) {
  if (signals.length === 0) {
    return (
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pl-3 border-l-2 border-indigo-500">
            📊 선물 신호 트래킹
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">스캐너 TOP 10 · 1H/4H/24H 결과 추적</p>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4">
          데이터 수집 중입니다. 다음 스크립트 실행 후 나타납니다.
        </p>
      </section>
    );
  }

  const stats1h  = statsFor(signals, "price_1h");
  const stats4h  = statsFor(signals, "price_4h");
  const stats24h = statsFor(signals, "price_24h");

  // 최근 24H 신호만 카드 표시
  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  const recent = signals.filter((s) => s.recorded_at >= cutoff);

  // 시간대별 그룹 (recorded_at 기준)
  const grouped = new Map<string, Signal[]>();
  for (const s of recent) {
    const key = s.recorded_at.slice(0, 16); // "YYYY-MM-DDTHH:MM"
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const groups = [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pl-3 border-l-2 border-indigo-500">
          📊 선물 신호 트래킹
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">스캐너 TOP 10 · 1H/4H/24H 결과 추적</p>
      </div>

      {/* 전체 통계 */}
      <div className="flex gap-2 flex-wrap">
        <StatChip label="1H 평균" stats={stats1h} />
        <StatChip label="4H 평균" stats={stats4h} />
        <StatChip label="24H 평균" stats={stats24h} />
      </div>

      {/* 최근 신호 그룹 */}
      <div className="space-y-3">
        {groups.map(([timeKey, group]) => {
          const kst = new Date(timeKey + ":00Z");
          const kstStr = new Date(kst.getTime() + 9 * 3600_000)
            .toISOString().slice(11, 16) + " KST";
          return (
            <div key={timeKey} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{kstStr}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {group.sort((a, b) => a.rank - b.rank).map((s) => {
                  const p1h  = pnl(s.entry_price, s.price_1h);
                  const p4h  = pnl(s.entry_price, s.price_4h);
                  const p24h = pnl(s.entry_price, s.price_24h);
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3 py-2 flex items-center gap-3"
                    >
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 w-4 shrink-0">#{s.rank}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-16 shrink-0">{s.symbol}</span>
                      <div className="flex gap-3 text-[11px] text-gray-400 dark:text-gray-500 flex-wrap">
                        <span>1H <PnlBadge value={p1h} /></span>
                        <span>4H <PnlBadge value={p4h} /></span>
                        <span>24H <PnlBadge value={p24h} /></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        * 매시간 정각 스캐너 TOP 10 진입가 기준. 투자 결과가 아닌 참고용 시뮬레이션입니다.
      </p>
    </section>
  );
}
