import Link from "next/link";
import {
  labelPattern,
  TIMEFRAME_COLORS,
  TIMEFRAME_LABELS,
  type BuyPick,
} from "@/lib/buy-picks";

function priceFmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

// 카드 강조 — kind별 1차 분기, match면 점수 구간으로 세부 강조
function cardAccent(pick: BuyPick) {
  if (pick.kind === "gap_extended") {
    return {
      ring: "",
      border: "border-yellow-300 dark:border-yellow-700",
      header: "bg-yellow-50/70 dark:bg-yellow-950/30",
      scoreBg: "text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/40",
    };
  }
  if (pick.kind === "trend_extended") {
    return {
      ring: "",
      border: "border-gray-300 dark:border-slate-600",
      header: "bg-gray-50 dark:bg-slate-800/60",
      scoreBg: "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-slate-700",
    };
  }
  const s = pick.score ?? 0;
  if (s >= 90)
    return {
      ring: "ring-2 ring-amber-300/70 dark:ring-amber-600/60",
      border: "border-amber-300 dark:border-amber-700",
      header: "bg-gradient-to-br from-amber-100 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/30",
      scoreBg: "text-amber-800 dark:text-amber-200 bg-amber-200/70 dark:bg-amber-900/60",
    };
  if (s >= 85)
    return {
      ring: "",
      border: "border-emerald-300 dark:border-emerald-700",
      header: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30",
      scoreBg: "text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/50",
    };
  if (s >= 80)
    return {
      ring: "",
      border: "border-teal-200 dark:border-teal-800",
      header: "bg-teal-50/60 dark:bg-teal-950/20",
      scoreBg: "text-teal-800 dark:text-teal-200 bg-teal-100 dark:bg-teal-900/40",
    };
  return {
    ring: "",
    border: "border-gray-200 dark:border-slate-700",
    header: "bg-gray-50/50 dark:bg-slate-900/40",
    scoreBg: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40",
  };
}

// 대형주 도장 — 시총 ≥ 1조 (1조 = 1e12 원)
const LARGE_CAP_THRESHOLD = 1_000_000_000_000;

export function PickCard({ pick }: { pick: BuyPick }) {
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
  const accent = cardAccent(pick);
  const isLargeCap = (pick.market_cap ?? 0) >= LARGE_CAP_THRESHOLD;
  const isWatch = pick.kind !== "match";

  return (
    <Link
      href={`/admin/picks/${pick.code}?tf=${pick.timeframe}`}
      className={`group relative flex flex-col rounded-xl border ${accent.border} ${accent.ring} bg-white dark:bg-slate-800 hover:shadow-md transition-all overflow-hidden`}
    >
      {/* 헤더 */}
      <div className={`px-4 py-3 border-b border-gray-100 dark:border-slate-700 ${accent.header}`}>
        <div className="flex items-center gap-1.5 flex-wrap">
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
          {pick.score != null && pick.kind === "match" && (
            <span className={`ml-auto text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded ${accent.scoreBg}`}>
              {pick.score}점
            </span>
          )}
          {pick.kind === "gap_extended" && (
            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${accent.scoreBg}`}>
              🟡 갭자리
            </span>
          )}
          {pick.kind === "trend_extended" && (
            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${accent.scoreBg}`}>
              👀 워치
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
            {pick.name}
          </h3>
          <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
            {pick.code}
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="relative flex-1 px-4 py-3 space-y-2">
        {isLargeCap && (
          <div
            className="absolute top-2 right-2 z-10 border-2 border-red-500 dark:border-red-400 bg-red-50/95 dark:bg-red-950/70 text-red-700 dark:text-red-300 px-2 py-0.5 rounded font-extrabold text-[10px] tracking-tight transform rotate-6 shadow-sm select-none pointer-events-none"
            title={`시총 ${(pick.market_cap! / 1e12).toFixed(1)}조원 — 대형주`}
          >
            ★ 1조+
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="inline-block bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
            {labelPattern(pick.pattern)}
          </span>
          {pick.detection_meta?.lid_warning && (
            <span className="inline-block bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-bold ring-1 ring-inset ring-red-300 dark:ring-red-800">
              ⚠ 뚜껑
            </span>
          )}
          {pick.detection_meta?.hill_price != null && (
            <span className="inline-block bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded font-medium">
              언덕
            </span>
          )}
        </div>

        <dl className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <dt className="text-gray-500 dark:text-gray-400">
              {pick.kind === "trend_extended" ? "매수타점 (hill)" : "매수타점"}
            </dt>
            <dd className={`font-mono tabular-nums font-semibold ${
              pick.kind === "trend_extended"
                ? "text-blue-700 dark:text-blue-300"
                : "text-emerald-700 dark:text-emerald-300"
            }`}>
              {priceFmt(pick.entry_price)}
            </dd>
          </div>
          {pick.current_price != null && (
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">현재가</dt>
              <dd className="flex items-center gap-1.5">
                <span className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {priceFmt(pick.current_price)}
                </span>
                {diff != null && (
                  <span className={`font-mono tabular-nums text-[10px] ${diffColor}`}>
                    {diff >= 0 ? "+" : ""}
                    {diff.toFixed(1)}%
                  </span>
                )}
              </dd>
            </div>
          )}
          {pick.stop_loss != null && (
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">손절가</dt>
              <dd className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
                {priceFmt(pick.stop_loss)}
              </dd>
            </div>
          )}
          {pick.rrr != null && (
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">R/R</dt>
              <dd className="font-mono tabular-nums text-violet-700 dark:text-violet-300">
                {pick.rrr.toFixed(1)}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Link>
  );
}
