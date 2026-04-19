type NewTokenItem = {
  chain: string;
  symbol: string;
  age_days: number;
  market_cap: number;
  price_usd: number;
  volume: number;
  netflow: number;
  address: string;
};

const CHAIN_COLOR: Record<string, { badge: string; glow: string; bar: string }> = {
  ethereum: {
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    glow: "border-indigo-200 dark:border-indigo-800/60",
    bar: "bg-indigo-400",
  },
  solana: {
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    glow: "border-purple-200 dark:border-purple-800/60",
    bar: "bg-purple-400",
  },
  base: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    glow: "border-blue-200 dark:border-blue-800/60",
    bar: "bg-blue-400",
  },
};

const FALLBACK = {
  badge: "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300",
  glow: "border-gray-200 dark:border-slate-700",
  bar: "bg-gray-400",
};

function fmtUsd(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPrice(n: number) {
  if (n === 0) return "$0";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function NetFlow({ v }: { v: number }) {
  if (!v) return <span className="text-gray-400 text-[10px]">–</span>;
  const pos = v > 0;
  return (
    <span className={`text-[10px] font-semibold ${pos ? "text-emerald-500" : "text-red-500"}`}>
      {pos ? "▲" : "▼"} {fmtUsd(Math.abs(v))}
    </span>
  );
}

export default function NewTokensSection({ items }: { items: NewTokenItem[] }) {
  if (!items?.length) return null;

  const maxVol = Math.max(...items.map((t) => t.volume), 1);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
          🌱 신규 토큰 발굴
        </h2>
        <span className="text-[11px] text-gray-400">Nansen · 7일 이내 출시</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {items.map((item) => {
          const cc = CHAIN_COLOR[item.chain] ?? FALLBACK;
          const volRatio = item.volume / maxVol;
          const ageLabel = item.age_days < 1 ? "오늘 출시" : `${Math.floor(item.age_days)}일 전`;

          return (
            <div
              key={item.address}
              className={`rounded-2xl border ${cc.glow} bg-white dark:bg-slate-800 p-3 flex flex-col gap-2 hover:shadow-md transition-shadow`}
            >
              {/* 상단: 체인 뱃지 + 심볼 */}
              <div className="flex items-start justify-between">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cc.badge}`}>
                  {item.chain.slice(0, 3).toUpperCase()}
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                  {ageLabel}
                </span>
              </div>

              {/* 심볼 + 가격 */}
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight truncate">
                  {item.symbol}
                </p>
                <p className="text-[11px] text-gray-500 tabular-nums mt-0.5">
                  {fmtPrice(item.price_usd)}
                </p>
              </div>

              {/* 핵심 수치 */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">시총</p>
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                    {fmtUsd(item.market_cap)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">넷플로우</p>
                  <NetFlow v={item.netflow} />
                </div>
              </div>

              {/* 거래량 바 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">거래량</p>
                  <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 tabular-nums">
                    {fmtUsd(item.volume)}
                  </p>
                </div>
                <div className="h-1 w-full rounded-full bg-gray-100 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full ${cc.bar}`}
                    style={{ width: `${Math.max(volRatio * 100, 4)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
