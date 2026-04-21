"use client";

type RsiItem = {
  symbol: string;
  rsi_4h: number | null;
  rsi_1d: number | null;
  rsi_1w: number | null;
};

type RsiData = {
  overbought: RsiItem[];
  oversold: RsiItem[];
  all?: RsiItem[];
};

const CHART_H = 200;
const Y_AXIS_W = 32;
const PAD_X = 16;
const DOT_R = 7;

const Y_LABELS = [100, 80, 70, 50, 30, 20, 0];

function rsiToY(rsi: number) {
  return ((100 - rsi) / 100) * CHART_H;
}

function dotColor(rsi: number): { fill: string; stroke: string; label: string } {
  if (rsi >= 80) return { fill: "#ef4444", stroke: "#b91c1c", label: "#fee2e2" };
  if (rsi >= 70) return { fill: "#f97316", stroke: "#c2410c", label: "#ffedd5" };
  if (rsi <= 20) return { fill: "#10b981", stroke: "#059669", label: "#d1fae5" };
  if (rsi <= 30) return { fill: "#22c55e", stroke: "#15803d", label: "#dcfce7" };
  return { fill: "#94a3b8", stroke: "#64748b", label: "#f1f5f9" };
}

function dotRadius(rsi: number): number {
  const dist = Math.max(rsi - 70, 30 - rsi, 0);
  return DOT_R + Math.min(dist / 10, 1) * 4;
}

export default function RsiHeatmapSection({ data }: { data: RsiData }) {
  const { overbought, oversold } = data;
  if (!overbought.length && !oversold.length) return null;

  const items = [
    ...overbought.filter((r) => r.rsi_4h != null),
    ...oversold.filter((r) => r.rsi_4h != null),
  ].sort((a, b) => (b.rsi_4h ?? 0) - (a.rsi_4h ?? 0));

  if (!items.length) return null;

  const totalW_ref = 480;
  const plotW = totalW_ref - Y_AXIS_W - PAD_X;
  const step = plotW / (items.length + 1);

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pl-3 border-l-2 border-indigo-500">
        📈 RSI 산점도 <span className="text-[11px] font-normal text-gray-400">(4H 기준)</span>
      </h2>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pt-4 pb-0 overflow-x-auto">
        <svg
          viewBox={`0 -10 ${totalW_ref} ${CHART_H + 34}`}
          className="w-full"
          style={{ minWidth: 320, maxWidth: "100%" }}
        >
          {/* 그라디언트 정의 */}
          <defs>
            <linearGradient id="rsi-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="28%"  stopColor="#f97316" stopOpacity="0.12" />
              <stop offset="50%"  stopColor="#6366f1" stopOpacity="0.06" />
              <stop offset="72%"  stopColor="#22d3ee" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          {/* 전체 배경 그라디언트 */}
          <rect x={Y_AXIS_W} y={0} width={plotW + PAD_X} height={CHART_H} fill="url(#rsi-bg)" />
          {/* 과매수 밴드 (RSI 70~100) */}
          <rect
            x={Y_AXIS_W} y={rsiToY(100)}
            width={plotW + PAD_X} height={rsiToY(70) - rsiToY(100)}
            fill="#ef4444" opacity={0.08}
          />
          {/* 과매도 밴드 (RSI 0~30) */}
          <rect
            x={Y_AXIS_W} y={rsiToY(30)}
            width={plotW + PAD_X} height={rsiToY(0) - rsiToY(30)}
            fill="#22c55e" opacity={0.08}
          />

          {/* 그리드 라인 */}
          {Y_LABELS.map((v) => (
            <line
              key={v}
              x1={Y_AXIS_W}
              y1={rsiToY(v)}
              x2={totalW_ref}
              y2={rsiToY(v)}
              stroke={v === 70 ? "#ef444460" : v === 30 ? "#22c55e60" : "#e2e8f0"}
              strokeWidth={v === 70 || v === 30 ? 1.5 : 0.8}
              strokeDasharray={v === 70 || v === 30 ? "4 3" : "2 4"}
            />
          ))}

          {/* Y축 레이블 */}
          {Y_LABELS.map((v) => (
            <text
              key={v}
              x={Y_AXIS_W - 5}
              y={rsiToY(v) + 4}
              textAnchor="end"
              fontSize={9}
              fill="#94a3b8"
              fontFamily="monospace"
            >
              {v}
            </text>
          ))}

          {/* 존 레이블 */}
          <text x={Y_AXIS_W + 4} y={rsiToY(100) + 13} fontSize={9} fill="#ef4444" opacity={0.7}>과매수</text>
          <text x={Y_AXIS_W + 4} y={rsiToY(0) - 4} fontSize={9} fill="#22c55e" opacity={0.7}>과매도</text>

          {/* 점 + 심볼 레이블 */}
          {items.map((item, i) => {
            const rsi = item.rsi_4h!;
            const cx = Y_AXIS_W + step * (i + 1);
            const cy = rsiToY(rsi);
            const { fill, stroke, label } = dotColor(rsi);
            const r = dotRadius(rsi);

            return (
              <g key={item.symbol}>
                {/* 수직 점선 */}
                <line
                  x1={cx} y1={cy + r + 1}
                  x2={cx} y2={CHART_H}
                  stroke={fill}
                  strokeWidth={0.5}
                  opacity={0.25}
                />
                {/* 글로우 */}
                <circle cx={cx} cy={cy} r={r + 4} fill={fill} opacity={0.12} />
                {/* 점 */}
                <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
                {/* RSI 숫자 (점 위) */}
                <text x={cx} y={cy - r - 3} textAnchor="middle" fontSize={8} fill={fill} fontWeight="700" fontFamily="monospace">
                  {rsi.toFixed(0)}
                </text>
                {/* 심볼 (하단) */}
                <text x={cx} y={CHART_H + 14} textAnchor="middle" fontSize={8.5} fill="#64748b" fontWeight="600">
                  {item.symbol.length > 5 ? item.symbol.slice(0, 5) : item.symbol}
                </text>
              </g>
            );
          })}

          {/* 테두리 */}
          <rect
            x={Y_AXIS_W}
            y={0}
            width={plotW + PAD_X}
            height={CHART_H}
            fill="none"
            stroke="#e2e8f040"
            strokeWidth={1}
          />
        </svg>
      </div>
    </section>
  );
}
