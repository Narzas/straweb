"use client";

import { useEffect, useState } from "react";

type FearGreed = { value: number; classification_ko: string };
type DexChain = { chain: string; tvl: number; change_1d: number; flow_usd: number };

function fmtFlow(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(0)}M`;
  return `$${abs.toFixed(0)}`;
}

function GaugeCell({ v, label, title }: { v: number; label: string; title: string }) {
  const R = 44;
  const cx = 54, cy = 54;
  const arcLen = Math.PI * R;
  const filled = (v / 100) * arcLen;
  const angle = (1 - v / 100) * Math.PI;
  const nx = Math.round((cx + 37 * Math.cos(angle)) * 1e4) / 1e4;
  const ny = Math.round((cy - 37 * Math.sin(angle)) * 1e4) / 1e4;
  const color =
    v <= 25 ? "#ef4444" : v <= 45 ? "#f97316" :
    v <= 55 ? "#eab308" : v <= 75 ? "#84cc16" : "#10b981";
  const cls =
    v <= 25 ? "text-red-500" : v <= 45 ? "text-orange-500" :
    v <= 55 ? "text-yellow-500" : v <= 75 ? "text-lime-500" : "text-emerald-500";

  return (
    <div className="flex flex-col items-center py-3 px-2">
      <p className="text-[10px] text-gray-500 font-medium mb-1 text-center">{title}</p>
      <svg viewBox="0 0 108 60" style={{ width: 90, height: 50 }}>
        <path d="M 10 54 A 44 44 0 0 1 98 54" fill="none" strokeWidth="8" strokeLinecap="round" stroke="#e5e7eb" />
        <path d="M 10 54 A 44 44 0 0 1 98 54" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${filled} ${arcLen}`} />
        <text x="8" y="60" fontSize="7" textAnchor="middle" fill="#6b7280">0</text>
        <text x="54" y="10" fontSize="7" textAnchor="middle" fill="#6b7280">50</text>
        <text x="100" y="60" fontSize="7" textAnchor="middle" fill="#6b7280">100</text>
        <line x1={cx} y1={cy} x2={nx} y2={ny} strokeWidth="2" strokeLinecap="round" stroke="#374151" />
        <circle cx={cx} cy={cy} r="3.5" fill="#374151" />
      </svg>
      <span className={`text-2xl font-black tabular-nums leading-none ${cls}`}>{v}</span>
      <span className={`text-[11px] font-semibold mt-0.5 ${cls}`}>{label}</span>
    </div>
  );
}

const OUT_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#ec4899", "#8b5cf6"];

function FlowBarList({ chains, maxAbs, allNegative }: { chains: DexChain[]; maxAbs: number; allNegative: boolean }) {
  const sorted = allNegative
    ? [...chains].sort((a, b) => a.flow_usd - b.flow_usd)
    : [...chains].sort((a, b) => b.flow_usd - a.flow_usd);
  const label = allNegative ? "전체 유출 구간" : "전체 유입 구간";
  const color = allNegative ? "#f43f5e" : "#10b981";
  return (
    <div>
      <p className="text-[10px] font-bold mb-2" style={{ color }}>{label} — 모든 체인 동시 {allNegative ? "유출" : "유입"}</p>
      <div className="space-y-1.5">
        {sorted.map((c) => {
          const ratio = Math.max((Math.abs(c.flow_usd) / maxAbs) * 100, 4);
          const amt = Math.abs(c.flow_usd);
          const fmt = amt >= 1e9 ? `$${(amt/1e9).toFixed(1)}B` : `$${(amt/1e6).toFixed(0)}M`;
          return (
            <div key={c.chain} className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 w-24 shrink-0 truncate">{c.chain}</span>
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${ratio}%`, background: color, opacity: 0.8 }} />
              </div>
              <span className="text-[11px] tabular-nums font-semibold w-16 text-right shrink-0" style={{ color }}>
                {allNegative ? "−" : "+"}{fmt}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowSankey({ outflows, inflows, maxAbs }: {
  outflows: DexChain[];
  inflows: DexChain[];
  maxAbs: number;
}) {
  const outs = outflows.slice(0, 5);
  const ins = inflows.slice(0, 8);
  if (!outs.length && !ins.length) return <p className="text-xs text-gray-400 py-3">데이터 없음</p>;

  const rowH = 32;
  const rowGap = 5;
  const svgW = 340;
  const labelW = 88;
  const nodeW = 7;
  const lx = labelW + nodeW;
  const rx = svgW - labelW - nodeW;
  const midX = svgW / 2;

  const nIn = ins.length;
  const nOut = outs.length;
  const svgH = Math.max(nIn, nOut) * (rowH + rowGap);

  const inCY = (i: number) => i * (rowH + rowGap) + rowH / 2;
  const outCY = (i: number) =>
    nOut === 1 ? svgH / 2 : (i / (nOut - 1)) * (svgH - rowH) + rowH / 2;

  return (
    <>
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: `${svgH}px` }}>
      <defs>
        {outs.map((_, i) => {
          const c = OUT_COLORS[i % OUT_COLORS.length];
          return (
            <marker key={i} id={`arr${i}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <polygon points="0 0, 5 2.5, 0 5" fill={c} fillOpacity="0.85" />
            </marker>
          );
        })}
      </defs>

      {/* 연결선: 각 outflow → 모든 inflow */}
      {outs.map((out, oi) =>
        ins.map((inn, ii) => {
          const y0 = outCY(oi);
          const y1 = inCY(ii);
          const ratio = inn.flow_usd / maxAbs;
          const w = Math.max(1.5, ratio * 6);
          const op = 0.45 + ratio * 0.45;
          const speed = (1.2 + (1 - ratio) * 1.8).toFixed(2);
          const delay = ((oi * ins.length + ii) * 0.15).toFixed(2);
          const color = OUT_COLORS[oi % OUT_COLORS.length];
          return (
            <path
              key={`${oi}-${ii}`}
              d={`M ${lx} ${y0} C ${midX} ${y0}, ${midX} ${y1}, ${rx - 4} ${y1}`}
              fill="none"
              stroke={color}
              strokeWidth={w}
              strokeOpacity={op}
              strokeDasharray="10 8"
              markerEnd={`url(#arr${oi})`}
              style={{
                animation: `flowLine ${speed}s linear ${delay}s infinite`,
              }}
            />
          );
        })
      )}

      {/* 유출 노드 (좌) */}
      {outs.map((c, i) => {
        const cy = outCY(i);
        const color = OUT_COLORS[i % OUT_COLORS.length];
        const nh = Math.max(6, (Math.abs(c.flow_usd) / maxAbs) * rowH * 0.85);
        return (
          <g key={`out-${c.chain}`}>
            <rect x={labelW} y={cy - nh / 2} width={nodeW} height={nh} fill={color} rx={2} />
            <text x={labelW - 7} y={cy - 3} fontSize="13" fontWeight="800" textAnchor="end" fill={color}>
              {c.chain.length > 12 ? c.chain.slice(0, 12) : c.chain}
            </text>
            <text x={labelW - 7} y={cy + 11} fontSize="11" fontWeight="700" textAnchor="end" fill={color}>
              −{fmtFlow(Math.abs(c.flow_usd))}
            </text>
          </g>
        );
      })}

      {/* 유입 노드 (우) */}
      {ins.map((c, i) => {
        const cy = inCY(i);
        const nh = Math.max(6, (c.flow_usd / maxAbs) * rowH * 0.85);
        return (
          <g key={`in-${c.chain}`}>
            <rect x={rx} y={cy - nh / 2} width={nodeW} height={nh} fill="#10b981" rx={2} />
            <text x={rx + nodeW + 7} y={cy - 3} fontSize="13" fontWeight="800" textAnchor="start" fill="#059669">
              {c.chain.length > 12 ? c.chain.slice(0, 12) : c.chain}
            </text>
            <text x={rx + nodeW + 7} y={cy + 11} fontSize="11" fontWeight="700" textAnchor="start" fill="#10b981">
              +{fmtFlow(c.flow_usd)}
            </text>
          </g>
        );
      })}
    </svg>
    </>
  );
}

function altcoinLabel(v: number) {
  if (v >= 75) return "알트 시즌";
  if (v >= 50) return "알트 우세";
  if (v >= 25) return "BTC 우세";
  return "BTC 시즌";
}

function lsLabel(v: number) {
  if (v >= 65) return "롱 우세";
  if (v >= 55) return "롱 편향";
  if (v >= 45) return "숏 편향";
  return "숏 우세";
}

export default function MarketSentimentSection({
  fearGreed,
  dexChains,
  fngComment,
  dexComment,
  altcoinSeason,
  longShortRatio,
}: {
  fearGreed: FearGreed | null;
  dexChains: DexChain[];
  fngComment?: string | null;
  dexComment?: string | null;
  altcoinSeason?: number | null;
  longShortRatio?: number | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!fearGreed && !dexChains?.length) return null;

  const inflows = [...(dexChains ?? [])].filter((c) => c.flow_usd > 0).sort((a, b) => b.flow_usd - a.flow_usd);
  const outflows = [...(dexChains ?? [])].filter((c) => c.flow_usd <= 0).sort((a, b) => a.flow_usd - b.flow_usd);
  const maxAbs = Math.max(...(dexChains ?? []).map((c) => Math.abs(c.flow_usd)), 1);

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        📊 시장 심리 &amp; 자금 흐름
      </h2>

      <div className="rounded-2xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">

        <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-slate-700 border-b border-gray-200 dark:border-slate-700">
          {fearGreed && (
            <GaugeCell v={fearGreed.value} label={fearGreed.classification_ko} title="공포·탐욕" />
          )}
          {altcoinSeason != null && (
            <GaugeCell v={altcoinSeason} label={altcoinLabel(altcoinSeason)} title="알트코인 시즌" />
          )}
          {longShortRatio != null && (
            <GaugeCell v={longShortRatio} label={lsLabel(longShortRatio)} title="롱/숏 비율" />
          )}
        </div>

        <div className="px-4 py-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-extrabold text-red-400">유출</span>
            <span className="text-[11px] text-gray-500 font-medium">24h 자금 흐름</span>
            <span className="text-sm font-extrabold text-emerald-500">유입</span>
          </div>
          {mounted && (
            (!inflows.length || !outflows.length)
              ? <FlowBarList chains={dexChains ?? []} maxAbs={maxAbs} allNegative={!inflows.length} />
              : <FlowSankey outflows={outflows} inflows={inflows} maxAbs={maxAbs} />
          )}
          {dexComment && (
            <p className="mt-3 text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-200 dark:border-slate-700 pt-3">
              {dexComment}
            </p>
          )}
        </div>

      </div>
    </section>
  );
}
