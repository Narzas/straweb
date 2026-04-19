"use client";

type DexChain = {
  chain: string;
  tvl: number;
  change_1d: number;
  flow_usd: number;
};

function fmtFlow(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${n > 0 ? "+" : "−"}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${n > 0 ? "+" : "−"}$${(abs / 1e6).toFixed(0)}M`;
  return `${n > 0 ? "+" : "−"}$${abs.toFixed(0)}`;
}

function FlowArrows({ inflow, speed }: { inflow: boolean; speed: number }) {
  return (
    <div className="flex items-center gap-0.5 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={`text-lg font-black leading-none ${inflow ? "text-emerald-400" : "text-red-400"}`}
          style={{
            animation: `${inflow ? "arrowIn" : "arrowOut"} ${speed}s ease-in-out ${(i * (speed / 4)).toFixed(2)}s infinite`,
            display: "inline-block",
            opacity: 0,
          }}
        >
          {inflow ? "›" : "‹"}
        </span>
      ))}
    </div>
  );
}

export default function DexChainsSection({
  dexChains,
  dexComment,
}: {
  dexChains: DexChain[];
  dexComment?: string | null;
}) {
  if (!dexChains?.length) return null;

  const inflows = dexChains.filter((c) => c.flow_usd > 0).sort((a, b) => b.flow_usd - a.flow_usd);
  const outflows = dexChains.filter((c) => c.flow_usd <= 0).sort((a, b) => a.flow_usd - b.flow_usd);
  const maxAbs = Math.max(...dexChains.map((c) => Math.abs(c.flow_usd)), 1);

  return (
    <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
            💸 체인별 자금 흐름 (24h)
          </h2>
          <span className="text-[11px] text-gray-400">TVL 변화 기준 · DefiLlama</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* 유입 */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-1">
              <span>▲</span> 유입
            </p>
            <div className="space-y-2">
              {inflows.slice(0, 4).map((c) => {
                const ratio = Math.abs(c.flow_usd) / maxAbs;
                const speed = 0.9 + (1 - ratio) * 0.8;
                return (
                  <div
                    key={c.chain}
                    className="rounded-xl px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate max-w-[80px]">
                        {c.chain}
                      </span>
                      <FlowArrows inflow={true} speed={speed} />
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {fmtFlow(c.flow_usd)}
                      </p>
                      <p className="text-[10px] text-emerald-400 tabular-nums">
                        +{c.change_1d.toFixed(1)}%
                      </p>
                    </div>
                    {/* 강도 바 */}
                    <div className="mt-1.5 h-0.5 w-full rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 유출 */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-400 mb-2 flex items-center gap-1">
              <span>▼</span> 유출
            </p>
            <div className="space-y-2">
              {outflows.slice(0, 4).map((c) => {
                const ratio = Math.abs(c.flow_usd) / maxAbs;
                const speed = 0.9 + (1 - ratio) * 0.8;
                return (
                  <div
                    key={c.chain}
                    className="rounded-xl px-3 py-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate max-w-[80px]">
                        {c.chain}
                      </span>
                      <FlowArrows inflow={false} speed={speed} />
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-xs font-black text-red-500 dark:text-red-400 tabular-nums">
                        {fmtFlow(c.flow_usd)}
                      </p>
                      <p className="text-[10px] text-red-400 tabular-nums">
                        {c.change_1d.toFixed(1)}%
                      </p>
                    </div>
                    <div className="mt-1.5 h-0.5 w-full rounded-full bg-red-100 dark:bg-red-900/40">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {dexComment && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2">
            💡 {dexComment}
          </p>
        )}
    </section>
  );
}
