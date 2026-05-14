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
  surge_high_date?: string;
  a_low?: number;
  a_low_date?: string;
  b_high?: number;
  b_high_date?: string;
  c_low?: number;
  c_low_date?: string;
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

// 차트 데이터 fetch 범위 — 3.5년 줌이 가능하도록 최소 3.5년 + 여유
const TF_MONTHS: Record<string, number> = {
  DAILY: 48,     // 4년 (3.5년 줌 + 여유)
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

// 기본 줌 우선순위: 3.5년 → 1년 → 3개월 → 전체
const TF_BARS_3Y: Record<string, number> = {
  DAILY: 875,    // ~3.5년 거래일
  WEEKLY: 182,   // 3.5년 = 182주
  MONTHLY: 42,   // 3.5년 = 42개월
  YEARLY: 4,
};
const TF_BARS_1Y: Record<string, number> = {
  DAILY: 252,
  WEEKLY: 52,
  MONTHLY: 12,
  YEARLY: 1,
};
const TF_BARS_3M: Record<string, number> = {
  DAILY: 63,
  WEEKLY: 13,
  MONTHLY: 3,
  YEARLY: 1,
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
  const tooltipRef = useRef<HTMLDivElement>(null);
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

        // swing date(일봉) → 차트 봉(resample 후)의 동일 시간 키로 변환
        // resample 함수와 동일한 로직이어야 마커·곡선이 동일 봉에 매핑됨
        const tfKey = (raw: string): string => {
          if (timeframe === "DAILY") return raw;
          const d = new Date(raw);
          if (timeframe === "WEEKLY") {
            const day = d.getDay();
            const offset = day === 0 ? -6 : 1 - day;
            const monday = new Date(d);
            monday.setDate(d.getDate() + offset);
            return monday.toISOString().slice(0, 10);
          }
          if (timeframe === "MONTHLY") {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
          }
          return `${d.getFullYear()}-01-01`;
        };

        const { createChart, CandlestickSeries, HistogramSeries, LineSeries } =
          await import("lightweight-charts");
        if (aborted || !ref.current) return;

        chart = createChart(ref.current, {
          width: ref.current.clientWidth,
          height: 540,
          localization: {
            // 주가는 정수(원) 단위 — RSI(0~100)는 소수점 1자리 유지
            priceFormatter: (price: number) =>
              price < 200
                ? price.toFixed(1)
                : Math.round(price).toLocaleString("ko-KR"),
          },
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
            // rightOffset 0 — visible range는 setVisibleLogicalRange로만 결정 (이중 padding 방지)
            rightOffset: 0,
            lockVisibleTimeRangeOnResize: true,  // 페이지 이동 후 ResizeObserver 발화 시 줌 reset 방지
          },
          crosshair: { mode: 1 },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#dc2626",
          downColor: "#2563eb",
          wickUpColor: "#dc2626",
          wickDownColor: "#2563eb",
          borderVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
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
          priceLineVisible: false,
          lastValueVisible: false,
        });
        // 메인 pane 영역: 캔들 위 / 거래량 아래
        chart.priceScale("right").applyOptions({
          scaleMargins: { top: 0.05, bottom: 0.25 },
        });
        chart.priceScale("vol").applyOptions({
          scaleMargins: { top: 0.78, bottom: 0 },
        });
        volSeries.setData(
          data.rows.map((r) => ({
            time: r.date,
            value: r.volume,
            color: r.close >= r.open ? "rgba(220, 38, 38, 0.4)" : "rgba(37, 99, 235, 0.4)",
          }))
        );

        // 타임프레임에 맞는 이동평균 (라벨은 모두 "240일선" 으로 통일 — 사용자 요청)
        const maPeriod = timeframe === "DAILY" ? 240 : timeframe === "WEEKLY" ? 40 : 12;
        if (data.rows.length >= maPeriod) {
          const maSeries = chart.addSeries(LineSeries, {
            color: "#000000",
            lineWidth: 3,
            title: "240일선",
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

        // RSI(14) — 하단 별도 pane
        const rsiPeriod = 14;
        if (data.rows.length > rsiPeriod) {
          const closes = data.rows.map((r) => r.close);
          const rsi: number[] = new Array(closes.length).fill(NaN);
          let gain = 0, loss = 0;
          for (let i = 1; i <= rsiPeriod; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) gain += diff;
            else loss -= diff;
          }
          let avgGain = gain / rsiPeriod;
          let avgLoss = loss / rsiPeriod;
          rsi[rsiPeriod] = 100 - 100 / (1 + avgGain / Math.max(avgLoss, 1e-9));
          for (let i = rsiPeriod + 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            const g = diff >= 0 ? diff : 0;
            const l = diff < 0 ? -diff : 0;
            avgGain = (avgGain * (rsiPeriod - 1) + g) / rsiPeriod;
            avgLoss = (avgLoss * (rsiPeriod - 1) + l) / rsiPeriod;
            rsi[i] = 100 - 100 / (1 + avgGain / Math.max(avgLoss, 1e-9));
          }
          // 별도 pane (index 1) 에 그려서 y축이 자동 분리됨
          const rsiSeries = chart.addSeries(
            LineSeries,
            {
              color: "#8b5cf6",
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
              title: "RSI(14)",
            },
            1
          );
          rsiSeries.setData(
            rsi
              .map((v, i) => ({ time: data.rows[i].date as string, value: v }))
              .filter((x) => Number.isFinite(x.value))
          );
          // 30 / 70 가이드라인
          rsiSeries.createPriceLine({
            price: 70,
            color: "rgba(239, 68, 68, 0.5)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "70",
          });
          rsiSeries.createPriceLine({
            price: 30,
            color: "rgba(34, 197, 94, 0.5)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "30",
          });
          // RSI pane 높이 (메인 pane 대비 작게)
          try {
            const panes = chart.panes();
            if (panes.length >= 2 && typeof panes[1].setHeight === "function") {
              panes[1].setHeight(120);
            }
          } catch {
            /* 일부 버전에서 panes API 미지원 시 무시 */
          }
        }

        // 매수타점 / 목표 / 손절 가격선
        candleSeries.createPriceLine({
          price: entry,
          color: "#10b981",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "매수타점",
        });
        if (stop != null) {
          candleSeries.createPriceLine({
            price: stop,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "손절가",
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
          const lb = swingByLabel("1차 바닥");
          const nl = swingByLabel("저항선");
          const rb = swingByLabel("2차 바닥");

          // W자형 연결선
          if (lb && nl && rb) {
            const wPts = [
              { time: tfKey(lb.date), value: lb.price },
              { time: tfKey(nl.date), value: nl.price },
              { time: tfKey(rb.date), value: rb.price },
            ];
            const wSeries = chart.addSeries(LineSeries, {
              color: "#6d28d9",
              lineWidth: 3,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            wSeries.setData(wPts);
          }

          // 수평 저항선
          if (nl) {
            candleSeries.createPriceLine({
              price: nl.price,
              color: "#a78bfa",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "저항선",
            });
          }
        }

        if (pattern === "TRIPLE_BOTTOM") {
          const nl = avgPrice("1차 피크", "2차 피크");
          if (nl) {
            candleSeries.createPriceLine({
              price: nl,
              color: "#a78bfa",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "저항선",
            });
          }
        }

        if (pattern === "INVERSE_HS") {
          const nl = avgPrice("1차 피크", "2차 피크");
          if (nl) {
            candleSeries.createPriceLine({
              price: nl,
              color: "#a78bfa",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "저항선",
            });
          }
        }

        if (pattern === "CUP_HANDLE") {
          // 4점(좌림·컵바닥·우림·핸들) 좌표를 resample 된 OHLC 인덱스에 매핑
          const findIdx = (label: string) => {
            const s = swingByLabel(label);
            if (!s) return -1;
            const key = tfKey(s.date);
            return data.rows.findIndex((r) => r.date === key);
          };
          const idxL = findIdx("좌림");
          const idxC = findIdx("컵바닥");
          const idxR = findIdx("우림");
          const idxH = findIdx("핸들");
          const pL = swingByLabel("좌림")?.price;
          const pC = swingByLabel("컵바닥")?.price;
          const pR = swingByLabel("우림")?.price;
          const pH = swingByLabel("핸들")?.price;

          // Lagrange 2차 보간: 3점 (x1,y1)(x2,y2)(x3,y3) 통과하는 포물선
          const lagrange3 = (
            x: number,
            x1: number, y1: number,
            x2: number, y2: number,
            x3: number, y3: number,
          ) =>
            y1 * ((x - x2) * (x - x3)) / ((x1 - x2) * (x1 - x3)) +
            y2 * ((x - x1) * (x - x3)) / ((x2 - x1) * (x2 - x3)) +
            y3 * ((x - x1) * (x - x2)) / ((x3 - x1) * (x3 - x2));

          if (
            idxL >= 0 && idxC > idxL && idxR > idxC && idxH > idxR &&
            pL != null && pC != null && pR != null && pH != null
          ) {
            // ─── 컵 U곡선 (좌림 ~ 우림) ───
            const cupPts: { time: string; value: number }[] = [];
            for (let i = idxL; i <= idxR; i++) {
              const y = lagrange3(i, idxL, pL, idxC, pC, idxR, pR);
              if (Number.isFinite(y)) {
                cupPts.push({
                  time: data.rows[i].date as string,
                  value: y,
                });
              }
            }
            const cupSeries = chart.addSeries(LineSeries, {
              color: "#ec4899",
              lineWidth: 3,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            cupSeries.setData(cupPts);

            // ─── 핸들 V dip + 회복선 (우림 ~ 핸들 ~ 회복점) ───
            const handleWidth = idxH - idxR;
            const idxRecovery = Math.min(
              idxH + handleWidth,
              data.rows.length - 1
            );
            const handlePts: { time: string; value: number }[] = [];
            if (idxRecovery > idxH) {
              // 회복점이 데이터에 존재 — Lagrange V dip + 회복선
              const pRecovery = pR;  // 핸들 돌파 후 림 수준으로 복귀 가정
              for (let i = idxR; i <= idxRecovery; i++) {
                const y = lagrange3(
                  i,
                  idxR, pR,
                  idxH, pH,
                  idxRecovery, pRecovery,
                );
                if (Number.isFinite(y)) {
                  handlePts.push({
                    time: data.rows[i].date as string,
                    value: y,
                  });
                }
              }
            } else {
              // 핸들이 마지막 봉 — 우림→핸들 직선만 (회복선 못 그림)
              handlePts.push(
                { time: data.rows[idxR].date as string, value: pR },
                { time: data.rows[idxH].date as string, value: pH },
              );
            }
            const handleSeries = chart.addSeries(LineSeries, {
              color: "#ec4899",
              lineWidth: 3,
              lineStyle: idxRecovery > idxH ? 1 : 0,  // 회복선 부분은 점선처럼 (예측)
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            handleSeries.setData(handlePts);
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

        let abcMarkers: { time: string; position: "aboveBar" | "belowBar"; color: string; shape: "arrowUp" | "arrowDown"; text: string }[] = [];

        if (pattern === "ELLIOTT_ABC_ENTRY" && detectionMeta) {
          // ABC 지그재그 연결선 (날짜 필드 있는 새 데이터에서만)
          const { surge_high_date: shD, a_low_date: alD, b_high_date: bhD, c_low_date: clD } = detectionMeta;
          if (shD && alD && bhD && clD &&
              detectionMeta.surge_high != null && detectionMeta.a_low != null &&
              detectionMeta.b_high != null && detectionMeta.c_low != null) {
            const abcPts = [
              { time: tfKey(shD), value: detectionMeta.surge_high as number },
              { time: tfKey(alD), value: detectionMeta.a_low as number },
              { time: tfKey(bhD), value: detectionMeta.b_high as number },
              { time: tfKey(clD), value: detectionMeta.c_low as number },
            ];
            const abcSeries = chart.addSeries(LineSeries, {
              color: "#c2410c",
              lineWidth: 3,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            abcSeries.setData(abcPts);
          }

          if (shD && alD && bhD && clD &&
              detectionMeta.surge_high != null && detectionMeta.a_low != null &&
              detectionMeta.b_high != null && detectionMeta.c_low != null) {
            abcMarkers.push(
              { time: tfKey(shD), position: "aboveBar" as const, color: "#f43f5e", shape: "arrowDown" as const, text: `시세고 ${detectionMeta.surge_high}` },
              { time: tfKey(alD), position: "belowBar" as const, color: "#14b8a6", shape: "arrowUp" as const, text: `A ${detectionMeta.a_low}` },
              { time: tfKey(bhD), position: "aboveBar" as const, color: "#f97316", shape: "arrowDown" as const, text: `B ${detectionMeta.b_high}` },
              { time: tfKey(clD), position: "belowBar" as const, color: "#14b8a6", shape: "arrowUp" as const, text: `C ${detectionMeta.c_low}` },
            );
          }
        }

        // 역대 저점 가로선
        const allTimeLow = Math.min(...data.rows.map((r) => r.low));
        candleSeries.createPriceLine({
          price: allTimeLow,
          color: "#6366f1",
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `역대저점 ₩${allTimeLow.toLocaleString("ko-KR")}`,
        });

        // 스윙 마커 (한 번에 set 해야 lightweight-charts 가 덮어쓰기 안 함)
        const { createSeriesMarkers } = await import("lightweight-charts");
        const swingMarkers = swings.map((s) => ({
          time: tfKey(s.date),
          position: (s.kind === "low" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
          color: s.kind === "low" ? "#10b981" : "#ef4444",
          shape: (s.kind === "low" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
          text: s.label,
          price: s.price,
        }));

        const allMarkers = [...swingMarkers, ...abcMarkers].sort((a, b) =>
          a.time < b.time ? -1 : a.time > b.time ? 1 : 0
        );
        if (allMarkers.length > 0) {
          createSeriesMarkers(candleSeries, allMarkers);
        }

        // 기본 줌: 데이터 길이에 따라 3년 → 1년 → 3개월 → 전체 순으로 선택
        const len = data.rows.length;
        const bars3y = TF_BARS_3Y[timeframe] ?? 750;
        const bars1y = TF_BARS_1Y[timeframe] ?? 252;
        const bars3m = TF_BARS_3M[timeframe] ?? 63;
        let zoomBars: number;
        // 쌍바닥·ABC는 패턴 형성 구간이 수개월~1년 — 1년 줌이 최적 (3년이면 디테일 보기 어려움)
        const forceOneYear = pattern === "DOUBLE_BOTTOM" || pattern === "ELLIOTT_ABC_ENTRY";
        if (forceOneYear && len >= bars1y) zoomBars = bars1y;
        else if (len >= bars3y) zoomBars = bars3y;
        else if (len >= bars1y) zoomBars = bars1y;
        else if (len >= bars3m) zoomBars = bars3m;
        else zoomBars = len;
        // 우측 여백: timeframe 무관 동일 비율 (zoomBars의 15%) — DAILY/WEEKLY 모두 ~13% 여백
        const padBars = Math.max(10, Math.round(zoomBars * 0.15));
        const applyZoom = () => {
          if (aborted || !chart) return;
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, len - zoomBars),
            to: len - 1 + padBars,
          });
        };
        // 1차: 동기 호출
        applyZoom();
        setLoading(false);
        // 2차: 다음 frame (DOM hidden→visible 전환 후)
        requestAnimationFrame(applyZoom);
        // 3차: ResizeObserver 첫 발화 race 회피
        setTimeout(applyZoom, 100);
        // 4차: 추가 안전망 (느린 디바이스 / 늦은 layout shift 대비)
        setTimeout(applyZoom, 500);

        // OHLC 툴팁 (crosshair hover)
        const rowByTime = new Map(data.rows.map((r) => [r.date, r]));
        const fmt = (n: number) => n.toLocaleString("ko-KR");
        chart.subscribeCrosshairMove((param) => {
          const tip = tooltipRef.current;
          const container = ref.current;
          if (!tip || !container) return;
          if (
            !param.time ||
            !param.point ||
            param.point.x < 0 ||
            param.point.x > container.clientWidth ||
            param.point.y < 0 ||
            param.point.y > container.clientHeight
          ) {
            tip.style.display = "none";
            return;
          }
          const row = rowByTime.get(param.time as string);
          if (!row) {
            tip.style.display = "none";
            return;
          }
          const isUp = row.close >= row.open;
          const headColor = isUp ? "#dc2626" : "#2563eb";
          tip.innerHTML =
            `<div style="color:${headColor};font-weight:600;margin-bottom:4px">${row.date}</div>` +
            `<div>시 <b>${fmt(row.open)}</b></div>` +
            `<div>고 <b>${fmt(row.high)}</b></div>` +
            `<div>저 <b>${fmt(row.low)}</b></div>` +
            `<div>종 <b style="color:${headColor}">${fmt(row.close)}</b></div>` +
            `<div style="color:#94a3b8;margin-top:4px">거래량 ${fmt(row.volume)}</div>`;
          tip.style.display = "block";
          const tipW = tip.offsetWidth || 140;
          const tipH = tip.offsetHeight || 120;
          let left = param.point.x + 16;
          let top = param.point.y + 16;
          if (left + tipW > container.clientWidth) left = param.point.x - tipW - 16;
          if (top + tipH > container.clientHeight) top = param.point.y - tipH - 16;
          tip.style.left = `${Math.max(0, left)}px`;
          tip.style.top = `${Math.max(0, top)}px`;
        });

        // resize — width 동기화 + zoom 재적용 (lockVisibleTimeRangeOnResize 보조)
        resizeObserver = new ResizeObserver(() => {
          if (ref.current && chart) {
            chart.applyOptions({ width: ref.current.clientWidth });
            applyZoom();
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
      <div className={loading || error ? "hidden" : "relative w-full"}>
        <div ref={ref} className="w-full" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-10 rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-xs leading-relaxed shadow-md dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
