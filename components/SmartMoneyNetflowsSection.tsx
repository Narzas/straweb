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

export default function SmartMoneyNetflowsSection({ items }: { items: NetflowItem[] }) {
  const [tab, setTab] = useState<"accumulation" | "distribution">("accumulation");

  if (!items?.length) return null;

  const sorted = [...items].sort((a, b) => b.net_flow_24h_usd - a.net_flow_24h_usd);
  const accumulation = sorted.filter((i) => i.net_flow_24h_usd > 0);
  const distribution = sorted.filter((i) => i.net_flow_24h_usd < 0).reverse();
  const displayed = tab === "accumulation" ? accumulation : distribution;
  const maxAbs = Math.max(...displayed.map((i) => Math.abs(i.net_flow_24h_usd)), 1);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
            💸 스마트머니 넷플로우
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Nansen · 스테이블코인 제외 · 24h</p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 text-[11px]">
          <button
            onClick={() => setTab("accumulation")}
            className={`px-2.5 py-1 font-semibold transition-colors ${
              tab === "accumulation"
                ? "bg-emerald-500 text-white"
                : "bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400"
            }`}
          >
            매집 {accumulation.length}
          </button>
          <button
            onClick={() => setTab("distribution")}
            className={`px-2.5 py-1 font-semibold transition-colors border-l border-gray-200 dark:border-slate-700 ${
              tab === "distribution"
                ? "bg-red-500 text-white"
                : "bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400"
            }`}
          >
            배분 {distribution.length}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 text-[11px] text-gray-500 dark:text-gray-400">
              <th className="text-left px-3 py-2 font-semibold">토큰</th>
              <th className="text-right px-3 py-2 font-semibold">가격</th>
              <th className="text-right px-3 py-2 font-semibold">24h 넷플로우</th>
              <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">7d</th>
              <th className="px-3 py-2 hidden sm:table-cell w-24"></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((item, i) => {
              const isPos = item.net_flow_24h_usd >= 0;
              const barWidth = Math.max((Math.abs(item.net_flow_24h_usd) / maxAbs) * 100, 4);
              const badgeCls = CHAIN_BADGE[item.chain] ?? "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300";
              const price = fmtPrice(item.price_usd);

              return (
                <tr
                  key={`${item.chain}-${item.token_address}`}
                  className="border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-300 dark:text-gray-600 w-3 shrink-0">{i + 1}</span>
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${badgeCls}`}>
                        {item.chain.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="font-black text-gray-900 dark:text-gray-100">{item.token_symbol}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                    {price ?? "–"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={`font-black ${isPos ? "text-emerald-500" : "text-red-500"}`}>
                      {fmtFlow(item.net_flow_24h_usd)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                    {item.net_flow_7d_usd != null ? (
                      <span className={`text-[11px] ${item.net_flow_7d_usd >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {fmtFlow(item.net_flow_7d_usd)}
                      </span>
                    ) : <span className="text-gray-300 dark:text-gray-600">–</span>}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <div className="h-1 w-full rounded-full bg-gray-100 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isPos ? "bg-emerald-400" : "bg-red-400"}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {displayed.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">데이터 없음</p>
        )}
      </div>
    </section>
  );
}
