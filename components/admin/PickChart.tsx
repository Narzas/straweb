"use client";

import { useEffect, useRef, useState } from "react";

type SwingPoint = {
  date: string;
  price: number;
  kind: "high" | "low";
  label: string;
};

type PatternMeta = {
  gap_bottom?: number;
  gap_top?: number;
  surge_high?: number;
  a_low?: number;
  b_high?: number;
  c_low?: number;
  [key: string]: unknown;
};

type Props = {
  ticker: string;
  swings: SwingPoint[];
  entry: number;
  target: number | null;
  stop: number | null;
  pattern?: string;
  detectionMeta?: PatternMeta | null;
  months?: number;
  timeframe?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
};

type Ohlcv = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const TF_MONTHS: Record<string, number> = {
  DAILY: 18,
  WEEKLY: 60,    // 5년
  MONTHLY: 120,  // 10년
  YEARLY: 120,
};

const TF_RESAMPLE_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  YEARLY: 365,
};

function resample(
  rows: Ohlcv[],
  tf: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
): Ohlcv[] {
  if (tf === "DAILY") return rows;
  if (rows.length === 0) return rows;

  const buckets = new Map<string, Ohlcv>();
  for (const r of rows) {
    const d = new Date(r.date);
    let key: string;
    if (tf === "WEEKLY") {
      // ISO week (월요일 시작) — date to nearest Monday
      const day = d.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + offset);
      key = monday.toISOString().slice(0, 10);
    } else if (tf === "MONTHLY") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    } else {
      // YEARLY
      key = `${d.getFullYear()}-01-01`;
    }
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...r, date: key });
    } else {
      existing.high = Math.max(existing.high, r.high);
      existing.low = Math.min(existing.low, r.low);
      existing.close = r.close; // last value wins
      existing.volume += r.volume;
    }
  }
  return Array.from(buckets.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
}

const TF_ZOOM_BARS: Record<string, number> = {
  DAILY: 60,
  WEEKLY: 26,
  MONTHLY: 18,
  YEARLY: 5,
};

export default function PickChart({
  ticker,
  swings,
  entry,
  target,
  stop,
  pattern,
  detectionMeta,
  months,
  timeframe = "DAILY",
}: Props) {
  const effectiveMonths = months ?? TF_MONTHS[timeframe] ?? 18;
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let chart: import("lightweight-charts").IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let aborted = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/admin/picks/${ticker}/ohlcv?months=${effectiveMonths}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw: { rows: Ohlcv[] } = await res.json();
        const data = { rows: resample(raw.rows, timeframe) };
        if (aborted || !ref.current) return;

        const { createChart, CandlestickSeries, HistogramSeries, LineSeries } =
          await import("lightweight-charts");
        if (aborted || !ref.current) return;

        chart = createChart(ref.current, {
          width: ref.current.clientWidth,
          height: 460,
          layout: {
            background: { color: "transparent" },
            textColor: "#94a3b8",
          },
          grid: {
            vertLines: { color: "rgba(148, 163, 184, 0.1)" },
            horzLines: { color: "rgba(148, 163, 184, 0.1)" },
          },
          rightPriceScale: { borderColor: "rgba(148, 163, 184, 0.2)" },
          timeScale: {
            borderColor: "rgba(148, 163, 184, 0.2)",
            timeVisible: false,
          },
          crosshair: { mode: 1 },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#dc2626",
          downColor: "#2563eb",
          wickUpColor: "#dc2626",
          wickDownColor: "#2563eb",
          borderVisible: false,
        });
        candleSeries.setData(
          data.rows.map((r) => ({
            time: r.date,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
          }))
        );

        // 거래량 (별도 pane)
        const volSeries = chart.addSeries(HistogramSeries, {
          color: "#94a3b8",
          priceFormat: { type: "volume" },
          priceScaleId: "vol",
        });
        chart.priceScale("vol").applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
        });
        volSeries.setData(
          data.rows.map((r) => ({
            time: r.date,
            value: r.volume,
            color: r.close >= r.open ? "rgba(220, 38, 38, 0.4)" : "rgba(37, 99, 235, 0.4)",
          }))
        );

        // 타임프레임에 맞는 이동평균
        const maPeriod = timeframe === "DAILY" ? 240 : timeframe === "WEEKLY" ? 40 : 12;
        const maLabel = timeframe === "DAILY" ? "MA240" : timeframe === "WEEKLY" ? "MA40" : "MA12";
        if (data.rows.length >= maPeriod) {
          const maSeries = chart.addSeries(LineSeries, {
            color: "#8b5cf6",
            lineWidth: 2,
            title: maLabel,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          const maData: { time: string; value: number }[] = [];
          for (let i = maPeriod - 1; i < data.rows.length; i++) {
            let sum = 0;
            for (let j = i - (maPeriod - 1); j <= i; j++) sum += data.rows[j].close;
            maData.push({ time: data.rows[i].date, value: sum / maPeriod });
          }
          maSeries.setData(maData);
        }

        // 매수타점 / 목표 / 손절 가격선
        candleSeries.createPriceLine({
          price: entry,
          color: "#10b981",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Entry",
        });
        if (stop != null) {
          candleSeries.createPriceLine({
            price: stop,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "Stop",
          });
        }

        // 패턴별 보조선 — swing 레이블 기반 넥라인
        const swingByLabel = (label: string) =>
          swings.find((s) => s.label === label);
        const avgPrice = (...labels: string[]) => {
          const pts = labels.map(swingByLabel).filter(Boolean);
          if (pts.length === 0) return null;
          return pts.reduce((acc, s) => acc + s!.price, 0) / pts.length;
        };

        if (pattern === "DOUBLE_BOTTOM") {
          const nl = swingByLabel("Neckline");
          if (nl) {
            candleSeries.createPriceLine({
              price: nl.price,
              color: "#a78bfa",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "넥라인",
            });
          }
        }

        if (pattern === "TRIPLE_BOTTOM") {
          const nl = avgPrice("P1", "P2");
          if (nl) {
            candleSeries.createPriceLine({
              price: nl,
              color: "#a78bfa",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "넥라인",
            });
          }
        }

        if (pattern === "INVERSE_HS") {
          const nl = avgPrice("P1", "P2");
          if (nl) {
            candleSeries.createPriceLine({
              price: nl,
              color: "#a78bfa",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "넥라인",
            });
          }
        }

        if (pattern === "CUP_HANDLE") {
          const rim = avgPrice("좌림", "우림(피벗)");
          if (rim) {
            candleSeries.createPriceLine({
              price: rim,
              color: "#a78bfa",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "Rim",
            });
          }
        }

        if (pattern === "GAP_UP_SUPPORT" && detectionMeta) {
          if (detectionMeta.gap_top != null) {
            candleSeries.createPriceLine({
              price: detectionMeta.gap_top,
              color: "#06b6d4",
              lineWidth: 1,
              lineStyle: 3,
              axisLabelVisible: true,
              title: "갭 상단",
            });
          }
          if (detectionMeta.gap_bottom != null) {
            candleSeries.createPriceLine({
              price: detectionMeta.gap_bottom,
              color: "#06b6d4",
              lineWidth: 1,
              lineStyle: 3,
              axisLabelVisible: true,
              title: "갭 하단",
            });
          }
        }

        if (pattern === "ELLIOTT_ABC_ENTRY" && detectionMeta) {
          if (detectionMeta.surge_high != null) {
            candleSeries.createPriceLine({
              price: detectionMeta.surge_high,
              color: "#f43f5e",
              lineWidth: 1,
              lineStyle: 1,
              axisLabelVisible: true,
              title: "시세고",
            });
          }
          if (detectionMeta.b_high != null) {
            candleSeries.createPriceLine({
              price: detectionMeta.b_high,
              color: "#f97316",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "B고",
            });
          }
          if (detectionMeta.a_low != null) {
            candleSeries.createPriceLine({
              price: detectionMeta.a_low,
              color: "#14b8a6",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "A저",
            });
          }
          if (detectionMeta.c_low != null) {
            candleSeries.createPriceLine({
              price: detectionMeta.c_low,
              color: "#14b8a6",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "C저",
            });
          }
        }

        // 스윙 마커
        if (swings.length > 0) {
          const { createSeriesMarkers } = await import("lightweight-charts");
          createSeriesMarkers(
            candleSeries,
            swings.map((s) => ({
              time: s.date,
              position: s.kind === "low" ? "belowBar" : "aboveBar",
              color: s.kind === "low" ? "#10b981" : "#ef4444",
              shape: s.kind === "low" ? "arrowUp" : "arrowDown",
              text: s.label,
            }))
          );
        }

        // 최근 N봉 기본 확대
        const zoomBars = TF_ZOOM_BARS[timeframe] ?? 120;
        const rows = data.rows;
        if (rows.length > zoomBars) {
          chart.timeScale().setVisibleRange({
            from: rows[rows.length - zoomBars].date as import("lightweight-charts").Time,
            to: rows[rows.length - 1].date as import("lightweight-charts").Time,
          });
        } else {
          chart.timeScale().fitContent();
        }
        setLoading(false);

        // resize
        resizeObserver = new ResizeObserver(() => {
          if (ref.current && chart) {
            chart.applyOptions({ width: ref.current.clientWidth });
          }
        });
        resizeObserver.observe(ref.current);
      } catch (e) {
        if (!aborted) setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();

    return () => {
      aborted = true;
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [ticker, swings, entry, target, stop, pattern, detectionMeta, effectiveMonths, timeframe]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {error && (
        <div className="p-4 text-sm text-rose-600 dark:text-rose-400">
          차트 로드 실패: {error}
        </div>
      )}
      {loading && !error && (
        <div className="p-12 text-center text-sm text-gray-400">차트 로딩…</div>
      )}
      <div ref={ref} className={loading || error ? "hidden" : "w-full"} />
    </div>
  );
}
