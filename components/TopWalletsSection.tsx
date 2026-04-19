type TopWalletItem = {
  address: string;
  label: string;
  chain: string;
  token_symbol: string;
  pnl_usd_realised: number;
  roi_percent_realised: number;
  nof_trades: number;
};

const CHAIN_BADGE: Record<string, string> = {
  ethereum: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  solana:   "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  base:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

const RANK_STYLE = [
  "text-yellow-500 font-black",
  "text-gray-400 font-black",
  "text-orange-400 font-black",
];

function fmtPnl(n: number) {
  if (n >= 1e6) return `+$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `+$${(n / 1e3).toFixed(0)}K`;
  return `+$${n.toFixed(0)}`;
}

function shortenAddr(addr: string, chain: string) {
  if (chain === "solana") return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function cleanLabel(label: string) {
  if (!label) return null;
  // strip emoji prefix like "🤖 " or "🐳 "
  return label.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u, "").trim();
}

export default function TopWalletsSection({ items }: { items: TopWalletItem[] }) {
  if (!items?.length) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
          🏆 고수익 지갑 TOP {items.length}
        </h2>
        <span className="text-[11px] text-gray-400">Nansen · 30일 실현 수익 기준</span>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => {
          const badgeCls = CHAIN_BADGE[item.chain] ?? "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300";
          const rankCls = RANK_STYLE[i] ?? "text-gray-500 font-bold";
          const roiPct = (item.roi_percent_realised * 100).toFixed(1);
          const label = cleanLabel(item.label);

          return (
            <div
              key={item.address}
              className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              {/* 순위 */}
              <span className={`text-sm w-5 text-center shrink-0 ${rankCls}`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
              </span>

              {/* 체인 + 주소 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${badgeCls}`}>
                    {item.chain.slice(0, 3).toUpperCase()}
                  </span>
                  <code className="text-xs font-mono text-gray-700 dark:text-gray-300">
                    {shortenAddr(item.address, item.chain)}
                  </code>
                  <span className="text-[10px] text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded">
                    {item.token_symbol}
                  </span>
                </div>
                {label && (
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{label}</p>
                )}
              </div>

              {/* 수익 지표 */}
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-emerald-500 tabular-nums leading-tight">
                  {fmtPnl(item.pnl_usd_realised)}
                </p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="text-[10px] text-gray-400 tabular-nums">ROI {roiPct}%</span>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-[10px] text-gray-400">{item.nof_trades}회</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
