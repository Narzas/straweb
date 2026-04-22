type PredictionMarketItem = {
  market_id: string;
  question: string;
  yes_price: number | null;
  volume_24hr: number;
  total_volume: number;
  end_date: string | null;
  platform: string;
  market_url?: string | null;
};

function fmtVol(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function daysLeft(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "종료";
  if (diff === 0) return "오늘";
  return `${diff}일`;
}

function dominanceLabel(pct: number) {
  if (pct >= 70) return { text: "YES 우세", cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" };
  if (pct >= 55) return { text: "YES 약세", cls: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" };
  if (pct >= 45) return { text: "팽팽함",   cls: "text-gray-500 bg-gray-100 dark:bg-slate-700" };
  if (pct >= 30) return { text: "NO 약세",  cls: "text-red-500 bg-red-50 dark:bg-red-900/20" };
  return             { text: "NO 우세",  cls: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30" };
}

export default function PredictionMarketsSection({ items }: { items: PredictionMarketItem[] }) {
  if (!items?.length) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            🔮 실시간 인기 예측 시장
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Polymarket · 전체 카테고리 · 인기 마켓 중 선정</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {items.map((item, idx) => {
          const days = daysLeft(item.end_date);
          const href = item.market_url ?? `https://polymarket.com/market/${item.market_id}`;
          const pct = item.yes_price != null ? Math.round(item.yes_price * 100) : null;
          const dom = pct != null ? dominanceLabel(pct) : null;

          return (
            <a
              key={item.market_id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors ${
                idx > 0 ? "border-t border-gray-100 dark:border-slate-800" : ""
              }`}
            >
              {/* YES% 원형 badge */}
              {pct != null && (
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-xs tabular-nums border-2 ${
                  pct >= 55 ? "border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" :
                  pct >= 45 ? "border-gray-300 text-gray-500 bg-gray-50 dark:bg-slate-700 dark:border-slate-600" :
                  "border-red-400 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                }`}>
                  {pct}%
                </div>
              )}

              {/* 질문 + 메타 */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2">
                  {item.question}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {dom && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dom.cls}`}>
                      {dom.text}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    24h {fmtVol(item.volume_24hr)}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    총 {fmtVol(item.total_volume)}
                  </span>
                  {days && (
                    <span className="text-[10px] text-gray-400">
                      {days} 남음
                    </span>
                  )}
                </div>
              </div>

              {/* 링크 아이콘 */}
              <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          );
        })}
      </div>
    </section>
  );
}
