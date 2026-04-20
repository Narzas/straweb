"use client";

type DexChain = {
  chain: string;
  tvl: number;
  change_1d: number;
  flow_usd: number;
};

function fmt(n: number) {
  const a = Math.abs(n);
  const s = n >= 0 ? "+" : "−";
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(0)}M`;
  return `${s}$${a.toFixed(0)}`;
}

const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#eab308",
  "#06b6d4", "#3b82f6", "#a855f7", "#f43f5e", "#14b8a6",
  "#84cc16", "#fb923c",
];

const W = 500;
const NW = 12;
const LX = 130;
const RX = W - 130;
const NODE_GAP = 4;
const MIN_H = 13;

function band(sx: number, sy1: number, sy2: number, tx: number, ty1: number, ty2: number) {
  const mx = (sx + tx) / 2;
  return (
    `M${sx},${sy1} C${mx},${sy1} ${mx},${ty1} ${tx},${ty1}` +
    ` L${tx},${ty2} C${mx},${ty2} ${mx},${sy2} ${sx},${sy2} Z`
  );
}

function centerLine(sx: number, sy: number, tx: number, ty: number) {
  const mx = (sx + tx) / 2;
  return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
}

const ANIM_STYLE = `
  @keyframes dexFlowDash {
    from { stroke-dashoffset: 30; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes dexNodePulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
  @keyframes dexBandBreath {
    0%, 100% { opacity: 0.14; }
    50%       { opacity: 0.26; }
  }
  @keyframes dexGlowPulse {
    0%, 100% { r: 35; opacity: 0.12; }
    50%       { r: 45; opacity: 0.06; }
  }
`;

export default function DexChainsSection({
  dexChains,
  dexComment,
}: {
  dexChains: DexChain[];
  dexComment?: string | null;
}) {
  if (!dexChains?.length) return null;

  const outChains = [...dexChains]
    .filter((c) => c.flow_usd < 0)
    .sort((a, b) => a.flow_usd - b.flow_usd);
  const inChains = [...dexChains]
    .filter((c) => c.flow_usd > 0)
    .sort((a, b) => b.flow_usd - a.flow_usd);

  const totalOut = outChains.reduce((s, c) => s + Math.abs(c.flow_usd), 0);
  const totalIn = inChains.reduce((s, c) => s + c.flow_usd, 0);
  const total = totalOut + totalIn;

  const hasMixed = outChains.length > 0 && inChains.length > 0;

  // ── Bipartite Sankey: outflows (left) → inflows (right) ──
  if (hasMixed) {
    const nOut = outChains.length;
    const nIn = inChains.length;
    const svgH = Math.max(200, Math.max(nOut, nIn) * (MIN_H + NODE_GAP) + 20);

    const leftExtra = svgH - nOut * MIN_H - (nOut - 1) * NODE_GAP;
    const rightExtra = svgH - nIn * MIN_H - (nIn - 1) * NODE_GAP;

    let leftY = 0;
    const leftNodes = outChains.map((c, i) => {
      const h = MIN_H + (Math.abs(c.flow_usd) / totalOut) * leftExtra;
      const node = { chain: c.chain, flow: c.flow_usd, y: leftY, h, color: PALETTE[i % PALETTE.length] };
      leftY += h + NODE_GAP;
      return node;
    });

    let rightY = 0;
    const rightNodes = inChains.map((c, i) => {
      const h = MIN_H + (c.flow_usd / totalIn) * rightExtra;
      const node = { chain: c.chain, flow: c.flow_usd, y: rightY, h, color: PALETTE[(nOut + i) % PALETTE.length] };
      rightY += h + NODE_GAP;
      return node;
    });

    // Band: left_i → right_j
    // At left node i: bands stacked top-to-bottom by j order
    // At right node j: bands stacked top-to-bottom by i order
    const leftOffsets: number[][] = leftNodes.map(() => Array(nIn).fill(0));
    const rightOffsets: number[][] = rightNodes.map(() => Array(nOut).fill(0));

    for (let i = 0; i < nOut; i++) {
      let acc = 0;
      for (let j = 0; j < nIn; j++) {
        leftOffsets[i][j] = acc;
        acc += leftNodes[i].h * (inChains[j].flow_usd / totalIn);
      }
    }
    for (let j = 0; j < nIn; j++) {
      let acc = 0;
      for (let i = 0; i < nOut; i++) {
        rightOffsets[j][i] = acc;
        acc += rightNodes[j].h * (Math.abs(outChains[i].flow_usd) / totalOut);
      }
    }

    let bandIdx = 0;
    const bands: { d: string; center: string; color: string; flow: number; idx: number }[] = [];
    for (let i = 0; i < nOut; i++) {
      for (let j = 0; j < nIn; j++) {
        const lh = leftNodes[i].h * (inChains[j].flow_usd / totalIn);
        const rh = rightNodes[j].h * (Math.abs(outChains[i].flow_usd) / totalOut);
        const sy1 = leftNodes[i].y + leftOffsets[i][j];
        const sy2 = sy1 + lh;
        const ty1 = rightNodes[j].y + rightOffsets[j][i];
        const ty2 = ty1 + rh;
        bands.push({
          d: band(LX + NW, sy1, sy2, RX, ty1, ty2),
          center: centerLine(LX + NW, (sy1 + sy2) / 2, RX, (ty1 + ty2) / 2),
          color: leftNodes[i].color,
          flow: Math.abs(outChains[i].flow_usd),
          idx: bandIdx++,
        });
      }
    }

    return (
      <section>
        <style>{ANIM_STYLE}</style>
        <div className="rounded-2xl border border-slate-700/60 bg-[#080e1a] overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <h2 className="text-sm font-bold text-slate-200 tracking-wide">체인별 자금 흐름</h2>
            <span className="text-[10px] text-slate-500 ml-auto">24h</span>
          </div>
          <div className="px-3 pb-3">
            <svg viewBox={`0 0 ${W} ${svgH}`} className="w-full" style={{ display: "block", height: "auto" }}>
              <defs>
                {/* Per-chain gradients */}
                {leftNodes.map((node) => (
                  <linearGradient key={`grad-${node.chain}-out`} id={`grad-${node.chain}-out`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={node.color} stopOpacity={0.7} />
                    <stop offset="45%" stopColor={node.color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.45} />
                  </linearGradient>
                ))}
                {rightNodes.map((node) => (
                  <linearGradient key={`grad-${node.chain}-in`} id={`grad-${node.chain}-in`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={node.color} stopOpacity={0.7} />
                    <stop offset="45%" stopColor={node.color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.45} />
                  </linearGradient>
                ))}
                {/* Glow filter */}
                <filter id="dexGlow">
                  <feGaussianBlur stdDeviation="2.5" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Node shadow */}
                <filter id="dexNodeShadow">
                  <feDropShadow dx={0} dy={2} stdDeviation={3} floodColor="#000" floodOpacity={0.5} />
                </filter>
                {/* Background gradient */}
                <radialGradient id="bgGrad" cx="60%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0c1120" stopOpacity={0} />
                </radialGradient>
              </defs>

              {/* Background */}
              <rect x={0} y={0} width={W} height={svgH} fill="url(#bgGrad)" />

              {/* Bands */}
              {bands.map((b, i) => {
                const leftNodeIdx = Math.floor(i / nIn);
                const rightNodeIdx = i % nIn;
                const gradId = leftNodeIdx < leftNodes.length ? `grad-${leftNodes[leftNodeIdx].chain}-out` : `grad-out`;
                return (
                  <path key={`band-${i}`} d={b.d} fill={`url(#${gradId})`}
                    style={{ animation: `dexBandBreath ${2.4 + i * 0.15}s ease-in-out ${i * 0.12}s infinite` }} />
                );
              })}

              {/* Flowing particles - dual chasing dots per link */}
              {bands.map((b, i) => {
                const weight = b.flow / totalOut;
                const speed = Math.max(0.6, 1.6 - weight);
                const sw = Math.max(1, weight * 6);
                const delay = i * 0.1;
                return (
                  <g key={`flow-${i}`}>
                    {/* Particle A */}
                    <path d={b.center} fill="none" stroke={b.color}
                      strokeWidth={sw} strokeDasharray="5 35" strokeLinecap="round"
                      filter="url(#dexGlow)"
                      style={{ animation: `dexFlowDash ${speed}s linear ${delay}s infinite` }} />
                    {/* Particle B (offset by half cycle) */}
                    <path d={b.center} fill="none" stroke={b.color}
                      strokeWidth={sw * 0.6} strokeDasharray="5 35" strokeLinecap="round"
                      opacity={0.5}
                      style={{ animation: `dexFlowDash ${speed}s linear ${delay + speed / 2}s infinite` }} />
                  </g>
                );
              })}

              {/* Left nodes (outflows) */}
              {leftNodes.map((node) => {
                const cy = node.y + node.h / 2;
                const fs = node.h < 14 ? 8 : 10;
                return (
                  <g key={node.chain}>
                    <rect x={LX} y={node.y} width={NW} height={node.h} rx={3} fill={node.color} filter="url(#dexNodeShadow)" />
                    <text x={LX - 6} y={cy - (node.h >= 24 ? 5 : 0)}
                      textAnchor="end" dominantBaseline="middle" fontSize={fs} fontWeight="700" fill={node.color}>
                      {node.chain}
                    </text>
                    {node.h >= 24 && (
                      <text x={LX - 6} y={cy + 6} textAnchor="end" dominantBaseline="middle"
                        fontSize={9} fill={node.color} opacity={0.7}>
                        {fmt(node.flow)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Right nodes (inflows) */}
              {rightNodes.map((node) => {
                const cy = node.y + node.h / 2;
                const fs = node.h < 14 ? 8 : 10;
                return (
                  <g key={node.chain}>
                    <rect x={RX - 3} y={node.y - 2} width={NW + 6} height={node.h + 4} rx={4}
                      fill={node.color} opacity={0.12}
                      style={{ animation: "dexNodePulse 2s ease-in-out infinite" }} />
                    <rect x={RX} y={node.y} width={NW} height={node.h} rx={3} fill={node.color} filter="url(#dexNodeShadow)" />
                    <text x={RX + NW + 7} y={cy - (node.h >= 24 ? 5 : 0)}
                      dominantBaseline="middle" fontSize={fs} fontWeight="700" fill={node.color}>
                      {node.chain}
                    </text>
                    {node.h >= 24 && (
                      <text x={RX + NW + 7} y={cy + 6} dominantBaseline="middle"
                        fontSize={9} fill={node.color} opacity={0.7}>
                        {fmt(node.flow)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        {dexComment && (
          <p className="mt-3 text-xs text-slate-400 bg-slate-800/40 border border-slate-700/50 rounded-xl px-3 py-2">
            {dexComment}
          </p>
        )}
      </section>
    );
  }

  // ── Single-direction: all chains → one aggregate node ──
  const allChains = [...dexChains].sort((a, b) => Math.abs(b.flow_usd) - Math.abs(a.flow_usd));
  const n = allChains.length;
  const svgH = Math.max(200, n * (MIN_H + NODE_GAP) + 20);
  const extra = svgH - n * MIN_H - (n - 1) * NODE_GAP;

  let ly = 0;
  const leftNodes = allChains.map((c, i) => {
    const h = MIN_H + (Math.abs(c.flow_usd) / total) * extra;
    const node = { chain: c.chain, flow: c.flow_usd, y: ly, h, color: PALETTE[i % PALETTE.length] };
    ly += h + NODE_GAP;
    return node;
  });

  const isAllOut = totalOut > 0 && totalIn === 0;
  const aggColor = isAllOut ? "#ef4444" : "#10b981";
  const aggLabel = isAllOut ? "유출" : "유입";
  const aggAmt = isAllOut ? -totalOut : totalIn;

  let off = 0;
  const links = leftNodes.map((node) => {
    const rightH = (Math.abs(node.flow) / total) * (svgH - (n - 1) * NODE_GAP);
    const rightY = off;
    off += rightH;
    return { ...node, rightY, rightH };
  });

  return (
    <section>
      <style>{ANIM_STYLE}</style>
      <div className="rounded-2xl border border-slate-700/60 bg-[#080e1a] overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h2 className="text-sm font-bold text-slate-200 tracking-wide">체인별 자금 흐름</h2>
          <span className="text-[10px] text-slate-500 ml-auto">24h</span>
        </div>
        <div className="px-3 pb-3">
          <svg viewBox={`0 0 ${W} ${svgH}`} className="w-full" style={{ display: "block", height: "auto" }}>
            <defs>
              {/* Per-chain gradients */}
              {links.map((link) => (
                <linearGradient key={`grad-${link.chain}`} id={`grad-${link.chain}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={link.color} stopOpacity={0.7} />
                  <stop offset="45%" stopColor={link.color} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={aggColor} stopOpacity={0.45} />
                </linearGradient>
              ))}
              {/* Glow filter */}
              <filter id="dexGlow">
                <feGaussianBlur stdDeviation="2.5" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Node shadow */}
              <filter id="dexNodeShadow">
                <feDropShadow dx={0} dy={2} stdDeviation={3} floodColor="#000" floodOpacity={0.5} />
              </filter>
              {/* Radial glow for aggregate node */}
              <radialGradient id="aggGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={aggColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={aggColor} stopOpacity={0} />
              </radialGradient>
              {/* Background gradient */}
              <radialGradient id="bgGrad" cx="60%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#1e293b" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#0c1120" stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* Background */}
            <rect x={0} y={0} width={W} height={svgH} fill="url(#bgGrad)" />

            {/* Bands */}
            {links.map((l, i) => (
              <path key={`band-${l.chain}`}
                d={band(LX + NW, l.y, l.y + l.h, RX, l.rightY, l.rightY + l.rightH)}
                fill={`url(#grad-${l.chain})`}
                style={{ animation: `dexBandBreath ${2.4 + i * 0.2}s ease-in-out ${i * 0.18}s infinite` }} />
            ))}

            {/* Flowing particles - dual chasing dots per link */}
            {links.map((l, i) => {
              const weight = Math.abs(l.flow) / total;
              const speed = Math.max(0.6, 1.8 - weight * 1.2);
              const sw = Math.max(1.2, weight * 8);
              const delay = i * 0.12;
              return (
                <g key={`flow-${l.chain}`}>
                  {/* Particle A */}
                  <path d={centerLine(LX + NW, l.y + l.h / 2, RX, l.rightY + l.rightH / 2)}
                    fill="none" stroke={l.color}
                    strokeWidth={sw} strokeDasharray="5 35" strokeLinecap="round"
                    filter="url(#dexGlow)"
                    style={{ animation: `dexFlowDash ${speed}s linear ${delay}s infinite` }} />
                  {/* Particle B (offset by half cycle) */}
                  <path d={centerLine(LX + NW, l.y + l.h / 2, RX, l.rightY + l.rightH / 2)}
                    fill="none" stroke={l.color}
                    strokeWidth={sw * 0.6} strokeDasharray="5 35" strokeLinecap="round"
                    opacity={0.5}
                    style={{ animation: `dexFlowDash ${speed}s linear ${delay + speed / 2}s infinite` }} />
                </g>
              );
            })}

            {/* Left nodes (source chains) */}
            {links.map((node) => {
              const cy = node.y + node.h / 2;
              const fs = node.h < 14 ? 8 : 10;
              return (
                <g key={node.chain}>
                  <rect x={LX} y={node.y} width={NW} height={node.h} rx={3} fill={node.color} filter="url(#dexNodeShadow)" />
                  <text x={LX - 6} y={cy - (node.h >= 24 ? 5 : 0)}
                    textAnchor="end" dominantBaseline="middle" fontSize={fs} fontWeight="700" fill={node.color}>
                    {node.chain}
                  </text>
                  {node.h >= 24 && (
                    <text x={LX - 6} y={cy + 6} textAnchor="end" dominantBaseline="middle"
                      fontSize={9} fill={node.color} opacity={0.75}>
                      {fmt(node.flow)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Aggregate right node with glow */}
            <g>
              {/* Glow circle behind rect */}
              <circle cx={RX + NW / 2} cy={svgH / 2} r={35} fill="url(#aggGlow)"
                style={{ animation: "dexGlowPulse 3s ease-in-out infinite" }} />
              {/* Pulsing halo rect */}
              <rect x={RX - 3} y={-3} width={NW + 6} height={svgH + 6} rx={5}
                fill={aggColor} opacity={0.1}
                style={{ animation: "dexNodePulse 1.8s ease-in-out infinite" }} />
              {/* Main node rect */}
              <rect x={RX} y={0} width={NW} height={svgH} rx={3} fill={aggColor} filter="url(#dexNodeShadow)" />
              {/* Labels */}
              <text x={RX + NW + 7} y={svgH / 2 - 8}
                dominantBaseline="middle" fontSize={13} fontWeight="800" fill={aggColor}>
                {aggLabel}
              </text>
              <text x={RX + NW + 7} y={svgH / 2 + 8}
                dominantBaseline="middle" fontSize={10} fill={aggColor} opacity={0.8}>
                {fmt(aggAmt)}
              </text>
            </g>
          </svg>
        </div>
      </div>
      {dexComment && (
        <p className="mt-3 text-xs text-slate-400 bg-slate-800/40 border border-slate-700/50 rounded-xl px-3 py-2">
          {dexComment}
        </p>
      )}
    </section>
  );
}
