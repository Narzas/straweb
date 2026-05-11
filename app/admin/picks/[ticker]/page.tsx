import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import {
  labelCandle,
  labelPattern,
  TIMEFRAME_COLORS,
  TIMEFRAME_LABELS,
  type Timeframe,
} from "@/lib/buy-picks";
import PickChart from "@/components/admin/PickChart";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "매수타점 상세",
  robots: { index: false, follow: false },
};

type DetectionMeta = {
  swings?: Array<{
    date: string;
    price: number;
    kind: "high" | "low";
    label: string;
  }>;
  checks?: Record<string, unknown>;
  score_breakdown?: {
    pattern?: number;
    candle?: string | null;
    volume?: number;
    trend?: { yearly?: string; monthly?: string; ma240?: string };
    rrr?: number;
    cycle_surged?: boolean;
    cycle_abc_complete?: boolean;
    cycle_penalty?: number;
  };
  context?: {
    candle_confirm?: string | null;
    current_close?: number;
    market_cap?: number;
  };
};

type PickRow = {
  id: number;
  date: string;
  ticker: string;
  pattern: string;
  timeframe: Timeframe;
  score: number;
  entry_price: number;
  current_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  candle_confirm: string | null;
  note: string | null;
  trend_yearly: string | null;
  trend_monthly: string | null;
  ma240_position: string | null;
  rrr: number | null;
  pattern_height: number | null;
  detection_meta: DetectionMeta | null;
  generated_at: string;
};

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtCap(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}조`;
  if (n >= 100_000_000_000) return `${Math.round(n / 100_000_000)}억`;
  return `${Math.round(n / 100_000_000)}억`;
}

export default async function PickDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ tf?: string }>;
}) {
  const { ticker } = await params;
  const { tf } = await searchParams;
  if (!/^\d{6}$/.test(ticker)) notFound();

  const sb = createServiceClient();
  let query = sb
    .from("buy_picks")
    .select("*")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .order("score", { ascending: false });

  if (tf && ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(tf)) {
    query = query.eq("timeframe", tf);
  }

  const { data: picks } = await query.limit(1);

  // 이 종목의 다른 timeframe 매칭들 (탭으로 표시)
  const { data: allTimeframes } = await sb
    .from("buy_picks")
    .select("date,timeframe,pattern,score")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(20);

  const pick = picks?.[0] as PickRow | undefined;

  const { data: stockRow } = await sb
    .from("stocks")
    .select("ticker,name,market")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!stockRow) notFound();

  const meta = (pick?.detection_meta as DetectionMeta | null) ?? null;
  const swings = meta?.swings ?? [];

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/admin/picks"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← 매수타점
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stockRow.name}{" "}
            <span className="text-gray-400 font-mono text-base">{ticker}</span>
          </h1>
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
            {stockRow.market}
          </span>
          {pick && (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ring-inset ${
                TIMEFRAME_COLORS[pick.timeframe].bg
              } ${TIMEFRAME_COLORS[pick.timeframe].text} ${
                TIMEFRAME_COLORS[pick.timeframe].ring
              }`}
            >
              {TIMEFRAME_LABELS[pick.timeframe]} 매수타점
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={`https://finance.naver.com/item/main.naver?code=${ticker}`}
            target="_blank"
            rel="noopener"
            className="text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            네이버금융
          </a>
          <a
            href={`https://www.tradingview.com/chart/?symbol=KRX%3A${ticker}`}
            target="_blank"
            rel="noopener"
            className="text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            TradingView
          </a>
        </div>
      </div>

      {/* 같은 종목 다른 타임프레임 탭 */}
      {allTimeframes && allTimeframes.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as Timeframe[]).map(
            (t) => {
              const found = allTimeframes.find(
                (x: { timeframe: string }) => x.timeframe === t
              );
              if (!found) return null;
              const active = pick?.timeframe === t;
              return (
                <Link
                  key={t}
                  href={`/admin/picks/${ticker}?tf=${t}`}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                    active
                      ? `${TIMEFRAME_COLORS[t].bg} ${TIMEFRAME_COLORS[t].text} ring-1 ring-inset ${TIMEFRAME_COLORS[t].ring}`
                      : "border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {TIMEFRAME_LABELS[t]}
                </Link>
              );
            }
          )}
        </div>
      )}

      {pick ? (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat
              label="패턴"
              value={labelPattern(pick.pattern)}
              accent="emerald"
            />
            <Stat label="점수" value={`${pick.score}점`} accent="amber" />
            <Stat
              label="매수타점"
              value={fmt(pick.entry_price)}
              accent="emerald"
            />
            <Stat
              label="목표 / 손절"
              value={`${fmt(pick.target_price ?? 0)} / ${fmt(pick.stop_loss ?? 0)}`}
            />
            <Stat label="R/R" value={`${pick.rrr ?? "—"}`} accent="violet" />
          </div>

          {/* 차트 */}
          <PickChart
            ticker={ticker}
            swings={swings}
            entry={pick.entry_price}
            target={pick.target_price}
            stop={pick.stop_loss}
            pattern={pick.pattern}
            detectionMeta={meta}
            timeframe={pick.timeframe}
          />

          {/* 검증 체크리스트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                패턴 조건 (자동 채점)
              </h3>
              <CheckList meta={meta} pattern={pick.pattern} />
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                필터 / 컨텍스트
              </h3>
              <dl className="space-y-2 text-sm">
                <Row
                  label="년봉 추세"
                  value={pick.trend_yearly ?? "—"}
                  ok={pick.trend_yearly === "UP"}
                />
                <Row
                  label="월봉 추세"
                  value={pick.trend_monthly ?? "—"}
                  ok={pick.trend_monthly === "UP"}
                />
                <Row
                  label="240일선"
                  value={pick.ma240_position ?? "—"}
                  ok={pick.ma240_position === "ABOVE"}
                />
                <Row
                  label="시가총액"
                  value={fmtCap(meta?.context?.market_cap)}
                  ok={(meta?.context?.market_cap ?? 0) >= 100_000_000_000}
                />
                <Row
                  label="시세 준 종목"
                  value={meta?.score_breakdown?.cycle_surged ? "YES" : "NO"}
                  ok={
                    !meta?.score_breakdown?.cycle_surged ||
                    !!meta?.score_breakdown?.cycle_abc_complete
                  }
                />
                {meta?.score_breakdown?.cycle_surged && (
                  <Row
                    label="ABC 조정 완성"
                    value={meta.score_breakdown.cycle_abc_complete ? "YES" : "NO (-30점)"}
                    ok={!!meta.score_breakdown.cycle_abc_complete}
                  />
                )}
                <Row
                  label="캔들 보조"
                  value={labelCandle(pick.candle_confirm) ?? "없음"}
                  ok={!!pick.candle_confirm}
                />
                <Row
                  label="거래량 점수"
                  value={`${meta?.score_breakdown?.volume ?? 0}/15`}
                  ok={(meta?.score_breakdown?.volume ?? 0) >= 5}
                />
                <Row
                  label="현재가"
                  value={fmt(pick.current_price ?? 0)}
                />
              </dl>
            </section>
          </div>

          {pick.note && (
            <div className="rounded-lg bg-gray-50 dark:bg-slate-900 px-4 py-3 text-sm text-gray-600 dark:text-gray-400 border-l-2 border-gray-300 dark:border-slate-600">
              <span className="font-semibold mr-2">메모:</span>
              {pick.note}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-sm text-gray-400">
          이 종목은 현재 매수타점에 등록되어 있지 않습니다.
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber" | "violet";
}) {
  const colorMap = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    violet: "text-violet-700 dark:text-violet-300",
  } as const;
  const c = accent ? colorMap[accent] : "text-gray-900 dark:text-gray-100";
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-base font-bold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string | number;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
          {value}
        </span>
        {ok != null && (
          <span
            className={
              ok
                ? "text-emerald-600 dark:text-emerald-400 text-xs"
                : "text-rose-600 dark:text-rose-400 text-xs"
            }
          >
            {ok ? "✓" : "✗"}
          </span>
        )}
      </dd>
    </div>
  );
}

function CheckList({
  meta,
  pattern,
}: {
  meta: DetectionMeta | null;
  pattern: string;
}) {
  if (!meta?.checks) {
    return (
      <p className="text-xs text-gray-400">
        탐지 메타 정보가 없습니다. 다음 cron 실행 후 갱신됩니다.
      </p>
    );
  }
  const c = meta.checks as Record<string, number | boolean>;
  const rows: Array<{ label: string; value: string; ok: boolean }> = [];

  if (pattern === "DOUBLE_BOTTOM") {
    const sym = Number(c.price_symmetry_pct ?? 0);
    const bars = Number(c.bars_between ?? 0);
    const rise = Number(c.neckline_rise_pct ?? 0);
    rows.push(
      { label: "두 저점 가격 차", value: `±${sym}% (≤3%)`, ok: sym <= 3 },
      { label: "저점 간격", value: `${bars}일 (10~50)`, ok: bars >= 10 && bars <= 50 },
      {
        label: "Neckline 상승률",
        value: `${rise}% (≥10%)`,
        ok: rise >= 10,
      },
      {
        label: "사전 하락 추세",
        value: c.prior_downtrend ? "YES" : "NO",
        ok: !!c.prior_downtrend,
      }
    );
  } else if (pattern === "INVERSE_HS") {
    const depth = Number(c.head_depth_pct ?? 0);
    const sym = Number(c.shoulder_symmetry_pct ?? 0);
    const flat = Number(c.neckline_flat_pct ?? 0);
    rows.push(
      { label: "Head 깊이", value: `${depth}% (≥5%)`, ok: depth >= 5 },
      { label: "어깨 대칭", value: `±${sym}% (≤5%)`, ok: sym <= 5 },
      { label: "Neckline 수평", value: `±${flat}% (≤3%)`, ok: flat <= 3 },
      {
        label: "사전 하락 추세",
        value: c.prior_downtrend ? "YES" : "NO",
        ok: !!c.prior_downtrend,
      }
    );
  } else if (pattern === "TRIPLE_BOTTOM") {
    const spread = Number(c.bottom_spread_pct ?? 0);
    const peakDiff = Number(c.peak_diff_pct ?? 0);
    const rise = Number(c.neckline_rise_pct ?? 0);
    const dur = Number(c.total_duration_bars ?? 0);
    rows.push(
      { label: "3개 저점 spread", value: `±${spread}% (≤3%)`, ok: spread <= 3 },
      { label: "두 봉우리 차", value: `±${peakDiff}% (≤5%)`, ok: peakDiff <= 5 },
      { label: "Neckline 상승률", value: `${rise}% (≥10%)`, ok: rise >= 10 },
      { label: "패턴 기간", value: `${dur}일 (30~150)`, ok: dur >= 30 && dur <= 150 },
      {
        label: "사전 하락 추세",
        value: c.prior_downtrend ? "YES" : "NO",
        ok: !!c.prior_downtrend,
      }
    );
  } else if (pattern === "CUP_HANDLE") {
    const rimSym = Number(c.rim_symmetry_pct ?? 0);
    const cupDepth = Number(c.cup_depth_pct ?? 0);
    const cupDur = Number(c.cup_duration_bars ?? 0);
    const handleDepth = Number(c.handle_depth_pct ?? 0);
    const handleDur = Number(c.handle_duration_bars ?? 0);
    const handlePos = Number(c.handle_position_pct ?? 0);
    rows.push(
      { label: "양쪽 Rim 대칭", value: `±${rimSym}% (≤5%)`, ok: rimSym <= 5 },
      { label: "Cup 깊이", value: `${cupDepth}% (12~50%)`, ok: cupDepth >= 12 && cupDepth <= 50 },
      { label: "Cup 기간", value: `${cupDur}일 (35~325)`, ok: cupDur >= 35 && cupDur <= 325 },
      { label: "Handle 깊이", value: `${handleDepth}% (3~15%)`, ok: handleDepth >= 3 && handleDepth <= 15 },
      { label: "Handle 기간", value: `${handleDur}일 (5~25)`, ok: handleDur >= 5 && handleDur <= 25 },
      { label: "Handle 위치", value: `Rim의 ${handlePos}% (≥85%)`, ok: handlePos >= 85 },
      { label: "거래량 핸들에서 감소", value: c.volume_decreases_in_handle ? "YES" : "NO", ok: !!c.volume_decreases_in_handle },
      { label: "U자 형태", value: c.u_shape_ok ? "YES" : "NO", ok: !!c.u_shape_ok },
    );
  }

  return (
    <dl className="space-y-2 text-sm">
      {rows.map((r) => (
        <Row key={r.label} {...r} />
      ))}
    </dl>
  );
}
