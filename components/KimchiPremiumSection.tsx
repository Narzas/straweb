"use client";

type DwStatus = "OK" | "DEPOSIT_ONLY" | "WITHDRAW_ONLY" | "SUSPENDED" | null;

type KimchiCoin = {
  symbol: string;
  upbit_krw: number | null;
  upbit_volume_24h_krw: number | null;
  bithumb_krw: number | null;
  bithumb_volume_24h_krw: number | null;
  combined_krw: number;
  binance_usdt: number;
  premium_pct: number;
  total_volume_24h_krw: number;
  change_24h_pct: number;
  bithumb_dw_status: DwStatus;
  upbit_warning: boolean;
  upbit_kimchi_caution: boolean;
};

type KimchiPremium = {
  usd_krw: number;
  avg_premium_pct: number | null;
  fixed: KimchiCoin[];
  outliers: KimchiCoin[];
  reverse: KimchiCoin[];
};

function fmtPct(n: number | null | undefined, digits = 2) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtKrw(n: number | null) {
  if (n == null) return "—";
  if (n >= 1e8) return `₩${(n / 1e8).toFixed(2)}억`;
  if (n >= 1e4) return `₩${(n / 1e4).toFixed(0)}만`;
  if (n >= 1) return `₩${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `₩${n.toFixed(2)}`;
}

function fmtUsdt(n: number) {
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function fmtVolKrw(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(0)}억`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)}만`;
  return `${n.toFixed(0)}`;
}

function premiumColor(pct: number) {
  if (pct >= 5) return "text-rose-600 dark:text-rose-400";
  if (pct >= 1) return "text-orange-500 dark:text-orange-400";
  if (pct >= -0.5) return "text-gray-500 dark:text-gray-400";
  if (pct >= -2) return "text-sky-500 dark:text-sky-400";
  return "text-blue-600 dark:text-blue-400";
}

function premiumBg(pct: number) {
  if (pct >= 5) return "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60";
  if (pct >= 1) return "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50";
  if (pct >= -0.5) return "bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700";
  if (pct >= -2) return "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/50";
  return "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60";
}

function ExchangeBadge({ c }: { c: KimchiCoin }) {
  const onUpbit = c.upbit_krw != null;
  const onBithumb = c.bithumb_krw != null;
  const txt = onUpbit && onBithumb ? "업·빗" : onUpbit ? "업비트" : "빗썸";
  return (
    <span className="text-[8px] font-bold tracking-wider text-gray-400 dark:text-gray-500">
      {txt}
    </span>
  );
}

function isArbBroken(c: KimchiCoin) {
  // 빗썸 D/W가 정상이 아니면 차익거래 단절. 업비트 김프 주의도 동일하게 취급.
  return (c.bithumb_dw_status != null && c.bithumb_dw_status !== "OK") || c.upbit_kimchi_caution;
}

function StatusBadge({ c }: { c: KimchiCoin }) {
  const dw = c.bithumb_dw_status;
  const labels: { txt: string; cls: string }[] = [];
  if (dw === "SUSPENDED") {
    labels.push({ txt: "🚫 입출금 정지", cls: "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60" });
  } else if (dw === "DEPOSIT_ONLY") {
    labels.push({ txt: "⛔ 출금 정지", cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50" });
  } else if (dw === "WITHDRAW_ONLY") {
    labels.push({ txt: "⛔ 입금 정지", cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50" });
  } else if (dw === "OK") {
    labels.push({ txt: "🟢 입출금", cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50" });
  }
  if (c.upbit_kimchi_caution) {
    labels.push({ txt: "⚠️ 김프 주의", cls: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50" });
  } else if (c.upbit_warning) {
    labels.push({ txt: "⚠️ 투자유의", cls: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50" });
  }
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <span key={l.txt} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${l.cls}`}>
          {l.txt}
        </span>
      ))}
    </div>
  );
}

function CoinRow({ c }: { c: KimchiCoin }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="shrink-0 w-14 flex flex-col">
        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{c.symbol}</span>
        <ExchangeBadge c={c} />
      </div>
      <span className={`shrink-0 w-16 text-right text-sm font-black tabular-nums ${premiumColor(c.premium_pct)}`}>
        {fmtPct(c.premium_pct, 1)}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
          {fmtKrw(c.combined_krw)} <span className="text-gray-300 dark:text-slate-600">/</span> {fmtUsdt(c.binance_usdt)}
        </span>
        <StatusBadge c={c} />
      </div>
      <div className="shrink-0 flex items-center gap-2 text-[10px] tabular-nums">
        <span className={c.change_24h_pct >= 0 ? "text-emerald-500" : "text-red-500"}>
          {c.change_24h_pct >= 0 ? "▲" : "▼"} {Math.abs(c.change_24h_pct).toFixed(1)}%
        </span>
        <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">{fmtVolKrw(c.total_volume_24h_krw)}원</span>
      </div>
    </div>
  );
}

export default function KimchiPremiumSection({ data }: { data: KimchiPremium }) {
  if (!data) return null;
  const { usd_krw, avg_premium_pct, fixed, outliers, reverse } = data;

  // outliers 분리: 정상 차익거래 가능 vs 단절(D/W 정지·김프 주의)
  const realOutliers = outliers.filter((c) => !isArbBroken(c));
  const brokenOutliers = outliers.filter((c) => isArbBroken(c));

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pl-3 border-l-2 border-indigo-500">
            🇰🇷 김치프리미엄
          </h2>
          <p className="text-[11px] text-gray-400 mt-1 pl-3">
            업비트 + 빗썸 vs Binance · USD/KRW {usd_krw.toFixed(2)}
          </p>
        </div>
        {avg_premium_pct != null && (
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">평균 김프</span>
            <span className={`text-2xl font-black tabular-nums ${premiumColor(avg_premium_pct)}`}>
              {fmtPct(avg_premium_pct)}
            </span>
          </div>
        )}
      </div>

      {/* 고정 4종 카드 */}
      {fixed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {fixed.map((c) => (
            <div key={c.symbol} className={`rounded-xl border px-3 py-2.5 ${premiumBg(c.premium_pct)}`}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{c.symbol}</span>
                <span className={`text-sm font-black tabular-nums ${premiumColor(c.premium_pct)}`}>
                  {fmtPct(c.premium_pct)}
                </span>
              </div>
              <div className="space-y-0.5 text-[10px] tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">업비트</span>
                  <span className="text-gray-600 dark:text-gray-300">{fmtKrw(c.upbit_krw)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">빗썸</span>
                  <span className="text-gray-600 dark:text-gray-300">{fmtKrw(c.bithumb_krw)}</span>
                </div>
                <div className="flex items-center justify-between pt-0.5 border-t border-gray-200/60 dark:border-slate-700/40">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">Binance</span>
                  <span className="text-gray-600 dark:text-gray-300">{fmtUsdt(c.binance_usdt)}</span>
                </div>
              </div>
              <div className="mt-1.5">
                <StatusBadge c={c} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 김프 알람 — 정상 차익거래 가능 outlier */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
            🔥 김프 알람 <span className="text-[10px] font-medium text-rose-500/80 dark:text-rose-400/80 ml-1">(김프 5%+ · 차익거래 정상)</span>
          </p>
          <span className="text-[10px] text-rose-500/70 dark:text-rose-400/70 tabular-nums">
            {realOutliers.length}개
          </span>
        </div>
        {realOutliers.length === 0 ? (
          <p className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
            정상 차익거래 환경에서 5% 이상 김프 코인은 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {realOutliers.map((c) => <CoinRow key={c.symbol} c={c} />)}
          </div>
        )}
      </div>

      {/* 차익거래 단절 — 입출금 정지·김프 주의로 인한 김프 (노이즈) */}
      {brokenOutliers.length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
              🚫 차익거래 단절 <span className="text-[10px] font-medium text-amber-600/80 dark:text-amber-400/80 ml-1">(입출금 정지·주의 — 김프 노이즈)</span>
            </p>
            <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 tabular-nums">
              {brokenOutliers.length}개
            </span>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-950/40">
            {brokenOutliers.map((c) => <CoinRow key={c.symbol} c={c} />)}
          </div>
        </div>
      )}

      {/* 역김프 */}
      {reverse.length > 0 && (
        <div className="mt-3 rounded-2xl border border-blue-200 dark:border-blue-900/60 overflow-hidden">
          <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900/60 flex items-center justify-between">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
              ❄️ 역김프 — 한국이 더 쌈 <span className="text-[10px] font-medium text-blue-500/80 dark:text-blue-400/80 ml-1">(매도세 시그널)</span>
            </p>
            <span className="text-[10px] text-blue-500/70 dark:text-blue-400/70 tabular-nums">
              {reverse.length}개
            </span>
          </div>
          <div className="divide-y divide-blue-100 dark:divide-blue-950/50">
            {reverse.map((c) => <CoinRow key={c.symbol} c={c} />)}
          </div>
        </div>
      )}
    </section>
  );
}
