"use client";

type TickerItem = {
  symbol: string;
  change: number;
};

const DEFAULT_ITEMS: TickerItem[] = [
  { symbol: "BTC", change: 2.34 },
  { symbol: "ETH", change: -1.12 },
  { symbol: "SOL", change: 5.67 },
  { symbol: "BNB", change: 0.89 },
  { symbol: "XRP", change: -2.45 },
  { symbol: "DOGE", change: 8.21 },
  { symbol: "ADA", change: -0.73 },
  { symbol: "AVAX", change: 3.15 },
  { symbol: "MATIC", change: -1.88 },
  { symbol: "LINK", change: 4.02 },
  { symbol: "DOT", change: -3.11 },
  { symbol: "UNI", change: 1.54 },
];

function Chip({ symbol, change }: TickerItem) {
  const pos = change >= 0;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap select-none"
      style={{
        background: pos ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)",
        border: `1px solid ${pos ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)"}`,
        color: pos ? "#10b981" : "#f43f5e",
      }}
    >
      <span className="text-gray-400 dark:text-gray-500 font-semibold">{symbol}</span>
      <span>{pos ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%</span>
    </span>
  );
}

export function CryptoTicker({
  items = DEFAULT_ITEMS,
  label = "24h 변동률",
}: {
  items?: TickerItem[];
  label?: string;
}) {
  const doubled = [...items, ...items];

  return (
    <div className="relative flex items-center gap-3 py-2 overflow-hidden">
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          gap: 8px;
          animation: ticker-scroll 28s linear infinite;
          will-change: transform;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>

      {/* 좌측 라벨 */}
      <div
        className="shrink-0 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase"
        style={{
          background: "rgba(99,102,241,0.12)",
          border: "1px solid rgba(99,102,241,0.3)",
          color: "#818cf8",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#818cf8",
            display: "inline-block",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        LIVE
      </div>

      {/* 좌측 페이드 */}
      <div className="absolute left-[68px] top-0 bottom-0 w-12 z-10 pointer-events-none bg-gradient-to-r from-white dark:from-[#0f172a] to-transparent" />

      {/* 티커 스크롤 영역 */}
      <div className="flex-1 overflow-hidden">
        <div className="ticker-track">
          {doubled.map((item, i) => (
            <Chip key={i} {...item} />
          ))}
        </div>
      </div>

      {/* 우측 페이드 + 라벨 */}
      <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none flex items-center justify-end pr-2 bg-gradient-to-l from-white dark:from-[#0f172a] to-transparent">
        <span className="text-[10px] text-gray-300 dark:text-gray-600 font-medium">{label}</span>
      </div>
    </div>
  );
}
