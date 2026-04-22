type SmartMoneyItem = {
  chain: string;
  symbol: string;
  balance_usd: string;
  change_24h: string;
  holders: string;
  sectors: string;
};

const CHAIN_BADGE: Record<string, string> = {
  ethereum: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  solana: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  base: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

function Change24h({ v }: { v: string }) {
  if (!v || v === "nan" || v === "0.0%") return <span className="text-gray-400">–</span>;
  const isPos = !v.startsWith("-");
  return (
    <span className={isPos ? "text-emerald-500" : "text-red-500"}>
      {isPos ? "▲" : "▼"} {v.replace("-", "").replace("%", "")}%
    </span>
  );
}

export default function SmartMoneySection({ items }: { items: SmartMoneyItem[] }) {
  if (!items?.length) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          🐳 스마트머니 보유 현황
        </h2>
        <span className="text-[11px] text-gray-400">Nansen · 24h 변화</span>
      </div>

      <div className="rounded-2xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-gray-500 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80">
              <th className="text-left px-4 py-2.5 font-medium">토큰</th>
              <th className="text-right px-4 py-2.5 font-medium">보유 잔액</th>
              <th className="text-right px-4 py-2.5 font-medium">24h</th>
              <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">홀더 수</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const badgeCls = CHAIN_BADGE[item.chain] ?? "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300";
              return (
                <tr key={i} className="border-b border-gray-100 dark:border-slate-700/60 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${badgeCls}`}>
                        {item.chain.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-100">{item.symbol}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-200">
                    {item.balance_usd}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                    <Change24h v={item.change_24h} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-500 hidden sm:table-cell">
                    {item.holders}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
