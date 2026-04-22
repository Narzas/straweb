type PerpItem = {
  token_symbol: string;
  volume: number;
  buy_volume: number | null;
  sell_volume: number | null;
  buy_sell_ratio: number | null;
  buy_sell_pressure: number | null;
  funding_rate: number | null;
  open_interest: number | null;
  mark_price: number | null;
};

function fmtVol(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtFunding(n: number | null) {
  if (n == null) return null;
  const pct = (n * 100).toFixed(4);
  const pos = n >= 0;
  return { label: `${pos ? "+" : ""}${pct}%`, pos };
}

function BuySellBar({ ratio }: { ratio: number }) {
  const buyPct = ratio;
  const sellPct = 100 - ratio;
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden">
      <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${buyPct}%` }} />
      <div className="bg-red-400 h-full transition-all duration-500" style={{ width: `${sellPct}%` }} />
    </div>
  );
}

export default function HyperliquidPerpsSection({ items }: { items: PerpItem[] }) {
  if (!items?.length) return null;

  const maxVol = Math.max(...items.map((i) => i.volume), 1);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            ⚡ 스마트머니 퍼프 포지션
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Hyperliquid · 스마트머니 거래량 상위 · 24h</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400">#</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400">심볼</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400">스마트머니 거래량</th>
              <th className="text-center px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">매수/매도 압력</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">펀딩</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const barWidth = Math.max((item.volume / maxVol) * 100, 6);
              const funding = fmtFunding(item.funding_rate);
              const ratio = item.buy_sell_ratio;

              return (
                <tr
                  key={item.token_symbol}
                  className="border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] font-black text-gray-300 dark:text-gray-600">{i + 1}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-black text-gray-900 dark:text-gray-100">{item.token_symbol}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                        {fmtVol(item.volume)}
                      </span>
                      <div className="w-16 h-1 rounded-full bg-gray-100 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {ratio != null ? (
                      <div className="flex flex-col gap-1 items-center">
                        <BuySellBar ratio={ratio} />
                        <div className="flex justify-between w-full">
                          <span className="text-[9px] text-emerald-500 font-semibold">매수 {ratio}%</span>
                          <span className="text-[9px] text-red-500 font-semibold">매도 {100 - ratio}%</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                    {funding ? (
                      <span className={`font-semibold tabular-nums ${funding.pos ? "text-emerald-500" : "text-red-500"}`}>
                        {funding.label}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">–</span>
                    )}
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
