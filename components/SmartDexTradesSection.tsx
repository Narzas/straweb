"use client";

type SmartDexTradeItem = {
  chain: string;
  block_timestamp: string;
  trader_address: string;
  trader_label: string;
  token_bought_symbol: string;
  token_sold_symbol: string;
  trade_value_usd: number;
  token_bought_market_cap: number;
};

const CHAIN_BADGE: Record<string, string> = {
  ethereum: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  solana:   "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  base:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

function fmtUsd(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtMcap(n: number) {
  if (!n) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return null;
}

function shortenAddr(addr: string, chain: string) {
  if (chain === "solana") return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function cleanLabel(label: string) {
  if (!label || label.startsWith("[0x") || label.startsWith("[")) return null;
  return label.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u, "").trim();
}

function relativeTime(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts + "Z").getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function SmartDexTradesSection({ items }: { items: SmartDexTradeItem[] }) {
  if (!items?.length) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
          ⚡ 스마트머니 DEX 거래
        </h2>
        <span className="text-[11px] text-gray-400">Nansen · $10K+ 거래</span>
      </div>

      <div className="space-y-1.5">
        {items.map((item, i) => {
          const badgeCls = CHAIN_BADGE[item.chain] ?? "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300";
          const label = cleanLabel(item.trader_label);
          const mcap = fmtMcap(item.token_bought_market_cap);

          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              {/* 체인 뱃지 */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${badgeCls}`}>
                {item.chain.slice(0, 3).toUpperCase()}
              </span>

              {/* 트레이더 */}
              <div className="min-w-0 w-28 shrink-0">
                <code className="text-[11px] font-mono text-gray-600 dark:text-gray-400">
                  {shortenAddr(item.trader_address, item.chain)}
                </code>
                {label && (
                  <p className="text-[10px] text-indigo-400 truncate">{label}</p>
                )}
              </div>

              {/* 거래 방향 */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-gray-400 shrink-0">매도</span>
                <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded truncate max-w-[60px]">
                  {item.token_sold_symbol}
                </span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600">→</span>
                <span className="text-[11px] text-gray-400 shrink-0">매수</span>
                <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded truncate max-w-[60px]">
                  {item.token_bought_symbol}
                </span>
                {mcap && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded shrink-0">
                    시총 {mcap}
                  </span>
                )}
              </div>

              {/* 금액 + 시간 */}
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-gray-800 dark:text-gray-100 tabular-nums">
                  {fmtUsd(item.trade_value_usd)}
                </p>
                <p className="text-[10px] text-gray-400 tabular-nums">
                  {relativeTime(item.block_timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
