"use client";

import { useState } from "react";

type NetflowItem = {
  chain: string;
  token_symbol: string;
  token_address: string;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number | null;
  price_usd: number | null;
  smart_money_inflow_24h: number | null;
  smart_money_outflow_24h: number | null;
};

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

const CHAIN_BADGE: Record<string, string> = {
  ethereum: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  solana:   "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  base:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

function fmtFlow(n: number) {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPrice(n: number | null) {
  if (n == null) return null;
  if (n < 0.001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  return `$${(n / 1000).toFixed(1)}K`;
}

function fmtVol(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtFunding(n: number | null) {
  if (n == null) return null;
  const pct = (n * 100).toFixed(4);
  return { label: `${n >= 0 ? "+" : ""}${pct}%`, pos: n >= 0 };
}

function BuySellBar({ ratio }: { ratio: number }) {
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden">
      <div className="bg-emerald-400 h-full" style={{ width: `${ratio}%` }} />
      <div className="bg-red-400 h-full" style={{ width: `${100 - ratio}%` }} />
    </div>
  );
}

function NetflowTable({ items, mode }: { items: NetflowItem[]; mode: "accumulation" | "distribution" }) {
  const sorted = [...items].sort((a, b) => b.net_flow_24h_usd - a.net_flow_24h_usd);
  const displayed = mode === "accumulation"
    ? sorted.filter((i) => i.net_flow_24h_usd > 0)
    : sorted.filter((i) => i.net_flow_24h_usd < 0).reverse();
  const maxAbs = Math.max(...displayed.map((i) => Math.abs(i.net_flow_24h_usd)), 1);

  if (displayed.length === 0) return <p className="text-xs text-gray-400 text-center py-4">데이터 없음</p>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 text-[11px] text-gray-500 dark:text-gray-400">
          <th className="text-left px-3 py-2 font-semibold">토큰</th>
          <th className="text-right px-3 py-2 font-semibold">가격</th>
          <th className="text-right px-3 py-2 font-semibold">24h 넷플로우</th>
          <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">7d</th>
          <th className="px-3 py-2 hidden sm:table-cell w-20"></th>
        </tr>
      </thead>
      <tbody>
        {displayed.map((item, i) => {
          const isPos = item.net_flow_24h_usd >= 0;
          const barWidth = Math.max((Math.abs(item.net_flow_24h_usd) / maxAbs) * 100, 4);
          const badgeCls = CHAIN_BADGE[item.chain] ?? "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300";
          const price = fmtPrice(item.price_usd);
          return (
            <tr key={`${item.chain}-${item.token_address}`}
              className="border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-300 dark:text-gray-600 w-3 shrink-0">{i + 1}</span>
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${badgeCls}`}>
                    {item.chain.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="font-black text-gray-900 dark:text-gray-100">{item.token_symbol}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{price ?? "–"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={`font-black ${isPos ? "text-emerald-500" : "text-red-500"}`}>
                  {fmtFlow(item.net_flow_24h_usd)}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                {item.net_flow_7d_usd != null
                  ? <span className={`text-[11px] ${item.net_flow_7d_usd >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtFlow(item.net_flow_7d_usd)}</span>
                  : <span className="text-gray-300 dark:text-gray-600">–</span>}
              </td>
              <td className="px-3 py-2 hidden sm:table-cell">
                <div className="h-1 w-full rounded-full bg-gray-100 dark:bg-slate-700">
                  <div className={`h-full rounded-full ${isPos ? "bg-emerald-400" : "bg-red-400"}`} style={{ width: `${barWidth}%` }} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PerpsTable({ items }: { items: PerpItem[] }) {
  const maxVol = Math.max(...items.map((i) => i.volume), 1);
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 text-[11px] text-gray-500 dark:text-gray-400">
          <th className="text-left px-3 py-2 font-semibold">#</th>
          <th className="text-left px-3 py-2 font-semibold">심볼</th>
          <th className="text-right px-3 py-2 font-semibold">거래량</th>
          <th className="text-center px-3 py-2 font-semibold hidden sm:table-cell">매수/매도</th>
          <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">펀딩</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const barWidth = Math.max((item.volume / maxVol) * 100, 6);
          const funding = fmtFunding(item.funding_rate);
          const ratio = item.buy_sell_ratio;
          return (
            <tr key={item.token_symbol}
              className="border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-3 py-2">
                <span className="text-[11px] font-black text-gray-300 dark:text-gray-600">{i + 1}</span>
              </td>
              <td className="px-3 py-2">
                <span className="font-black text-gray-900 dark:text-gray-100">{item.token_symbol}</span>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold text-gray-700 dark:text-gray-200 tabular-nums">{fmtVol(item.volume)}</span>
                  <div className="w-16 h-1 rounded-full bg-gray-100 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              </td>
              <td className="px-3 py-2 hidden sm:table-cell">
                {ratio != null ? (
                  <div className="flex flex-col gap-1 items-center">
                    <BuySellBar ratio={ratio} />
                    <div className="flex justify-between w-full">
                      <span className="text-[9px] text-emerald-500 font-semibold">매수 {ratio}%</span>
                      <span className="text-[9px] text-red-500 font-semibold">매도 {100 - ratio}%</span>
                    </div>
                  </div>
                ) : <span className="text-gray-300 dark:text-gray-600">–</span>}
              </td>
              <td className="px-3 py-2 text-right hidden sm:table-cell">
                {funding
                  ? <span className={`font-semibold tabular-nums ${funding.pos ? "text-emerald-500" : "text-red-500"}`}>{funding.label}</span>
                  : <span className="text-gray-300 dark:text-gray-600">–</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type Tab = "accumulation" | "distribution" | "perps";

export default function SmartMoneyDashboardSection({
  netflows,
  perps,
}: {
  netflows: NetflowItem[];
  perps: PerpItem[];
}) {
  const [tab, setTab] = useState<Tab>("accumulation");

  const hasNetflows = netflows?.length > 0;
  const hasPerps = perps?.length > 0;
  if (!hasNetflows && !hasPerps) return null;

  const sorted = hasNetflows ? [...netflows].sort((a, b) => b.net_flow_24h_usd - a.net_flow_24h_usd) : [];
  const accCount = sorted.filter((i) => i.net_flow_24h_usd > 0).length;
  const distCount = sorted.filter((i) => i.net_flow_24h_usd < 0).length;

  const subtitle =
    tab === "accumulation" ? "Nansen · 스테이블코인 제외 · 24h" :
    tab === "distribution" ? "Nansen · 스테이블코인 제외 · 24h" :
    "Hyperliquid · 스마트머니 거래량 상위 · 24h";

  const TABS: { key: Tab; icon: string; label: string; sub: string; count: number; activeText: string; activeBg: string }[] = [
    { key: "accumulation", icon: "📈", label: "매집",  sub: "순매수",   count: accCount,          activeText: "text-emerald-600 dark:text-emerald-400", activeBg: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400" },
    { key: "distribution", icon: "📉", label: "배분",  sub: "순매도",   count: distCount,         activeText: "text-red-600 dark:text-red-400",         activeBg: "bg-red-50 dark:bg-red-900/30 border-red-400" },
    { key: "perps",        icon: "⚡", label: "선물",  sub: "포지션",   count: perps?.length ?? 0, activeText: "text-indigo-600 dark:text-indigo-400",   activeBg: "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400" },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">🧠 스마트머니 동향</h2>
      </div>
      <div className="flex gap-2 mb-3 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border transition-all duration-200 ${
              tab === t.key
                ? `${t.activeBg} shadow-sm ${t.activeText}`
                : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <div className="text-left min-w-0">
              <div className="text-xs font-black leading-none">{t.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{t.sub} · {t.count}개</div>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {tab !== "perps" && hasNetflows && (
          <NetflowTable items={netflows} mode={tab} />
        )}
        {tab === "perps" && hasPerps && (
          <PerpsTable items={perps} />
        )}
        {((tab !== "perps" && !hasNetflows) || (tab === "perps" && !hasPerps)) && (
          <p className="text-xs text-gray-400 text-center py-4">데이터 없음</p>
        )}
      </div>
    </section>
  );
}
