import Link from "next/link";
import {
  getBuyPickDays,
  labelCandle,
  labelPattern,
  TIMEFRAME_COLORS,
  TIMEFRAME_LABELS,
  type BuyPick,
  type BuyPickDay,
} from "@/lib/buy-picks";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "매수타점",
  robots: { index: false, follow: false },
};

function formatKstDate(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600_000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${date} (${weekday})`;
}

function priceFmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default async function AdminPicksPage() {
  const days = await getBuyPickDays();

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            매수타점
          </h1>
          <Link
            href="/admin/analytics"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Analytics
          </Link>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          휴장일 제외 매일 업데이트
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        대한민국 주식 차트의 특정 패턴을 기반으로 산출한 매수타점입니다.
        투자 권유가 아닌 참고용 자료입니다.
      </p>

      {days.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-sm text-gray-400">
          아직 등록된 매수타점이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {days.map((day) => (
            <DayCard key={day.date} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({ day }: { day: BuyPickDay }) {
  return (
    <article className="flex flex-col rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <header className="border-b border-gray-100 dark:border-slate-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {formatDateLabel(day.date)}
          </h2>
          <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
            {day.picks.length}종목
          </span>
        </div>
        <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
          생성: {formatKstDate(day.generated_at)} KST
        </div>
      </header>

      <ul className="flex-1 divide-y divide-gray-100 dark:divide-slate-700">
        {day.picks.map((p) => (
          <PickItem
            key={`${p.code}-${p.timeframe}-${p.pattern}`}
            pick={p}
          />
        ))}
      </ul>
    </article>
  );
}

function PickItem({ pick }: { pick: BuyPick }) {
  const diff =
    pick.current_price != null
      ? ((pick.current_price - pick.entry_price) / pick.entry_price) * 100
      : null;
  const diffColor =
    diff == null
      ? "text-gray-400"
      : diff >= 0
      ? "text-rose-600 dark:text-rose-400"
      : "text-blue-600 dark:text-blue-400";

  return (
    <li className="p-5 hover:bg-gray-50/60 dark:hover:bg-slate-900/30 transition-colors relative">
      <Link
        href={`/admin/picks/${pick.code}?tf=${pick.timeframe}`}
        className="absolute inset-0 z-10"
        aria-label={`${pick.name} ${TIMEFRAME_LABELS[pick.timeframe]} 상세 보기`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ring-1 ring-inset ${
                TIMEFRAME_COLORS[pick.timeframe].bg
              } ${TIMEFRAME_COLORS[pick.timeframe].text} ${
                TIMEFRAME_COLORS[pick.timeframe].ring
              }`}
            >
              {TIMEFRAME_LABELS[pick.timeframe]}
            </span>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              {pick.market}
            </span>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
              {pick.name}
            </h3>
            <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
              {pick.code}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            <span className="inline-block bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5">
              {labelPattern(pick.pattern)}
            </span>
            {pick.candle_confirm && (
              <span className="inline-block bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5">
                {labelCandle(pick.candle_confirm)}
              </span>
            )}
            {pick.score != null && (
              <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums">
                {pick.score}점
              </span>
            )}
          </p>
          {pick.note && (
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              {pick.note}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5">
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
            매수타점
          </div>
          <div className="font-mono font-bold text-emerald-900 dark:text-emerald-200 tabular-nums">
            {priceFmt(pick.entry_price)}
          </div>
        </div>
        <div className="rounded-md bg-gray-50 dark:bg-slate-900/50 px-2 py-1.5">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
            현재가
          </div>
          <div
            className={`font-mono font-bold tabular-nums ${
              pick.current_price == null
                ? "text-gray-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {pick.current_price != null
              ? priceFmt(pick.current_price)
              : "—"}
          </div>
          {diff != null && (
            <div className={`text-[10px] font-mono ${diffColor}`}>
              {diff >= 0 ? "+" : ""}
              {diff.toFixed(2)}%
            </div>
          )}
        </div>
        <div className="rounded-md bg-gray-50 dark:bg-slate-900/50 px-2 py-1.5">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
            목표/손절
          </div>
          <div className="font-mono text-[11px] tabular-nums">
            <span className="text-rose-600 dark:text-rose-400">
              {pick.target_price != null ? priceFmt(pick.target_price) : "—"}
            </span>
            <span className="text-gray-300 dark:text-gray-600"> / </span>
            <span className="text-blue-600 dark:text-blue-400">
              {pick.stop_loss != null ? priceFmt(pick.stop_loss) : "—"}
            </span>
          </div>
        </div>
      </div>

      {pick.note && (
        <p className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed border-l-2 border-gray-200 dark:border-slate-600 pl-2">
          {pick.note}
        </p>
      )}
    </li>
  );
}
