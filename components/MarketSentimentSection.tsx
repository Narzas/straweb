"use client";


type FearGreed = { value: number; classification_ko: string };

function GaugeCell({ v, label, title }: { v: number; label: string; title: string }) {
  const R = 44;
  const cx = 54, cy = 54;
  const arcLen = Math.PI * R;
  const filled = (v / 100) * arcLen;
  const angle = (1 - v / 100) * Math.PI;
  const nx = Math.round((cx + 37 * Math.cos(angle)) * 1e4) / 1e4;
  const ny = Math.round((cy - 37 * Math.sin(angle)) * 1e4) / 1e4;
  const color =
    v <= 25 ? "#ef4444" : v <= 45 ? "#f97316" :
    v <= 55 ? "#eab308" : v <= 75 ? "#84cc16" : "#10b981";
  const cls =
    v <= 25 ? "text-red-500" : v <= 45 ? "text-orange-500" :
    v <= 55 ? "text-yellow-500" : v <= 75 ? "text-lime-500" : "text-emerald-500";

  return (
    <div className="flex flex-col items-center py-3 px-2">
      <p className="text-[10px] text-gray-500 font-medium mb-1 text-center">{title}</p>
      <svg viewBox="0 0 108 60" style={{ width: 90, height: 50 }}>
        <path d="M 10 54 A 44 44 0 0 1 98 54" fill="none" strokeWidth="8" strokeLinecap="round" stroke="#e5e7eb" />
        <path d="M 10 54 A 44 44 0 0 1 98 54" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${filled} ${arcLen}`} />
        <text x="8" y="60" fontSize="7" textAnchor="middle" fill="#6b7280">0</text>
        <text x="54" y="10" fontSize="7" textAnchor="middle" fill="#6b7280">50</text>
        <text x="100" y="60" fontSize="7" textAnchor="middle" fill="#6b7280">100</text>
        <line x1={cx} y1={cy} x2={nx} y2={ny} strokeWidth="2" strokeLinecap="round" stroke="#374151" />
        <circle cx={cx} cy={cy} r="3.5" fill="#374151" />
      </svg>
      <span className={`text-2xl font-black tabular-nums leading-none ${cls}`}>{v}</span>
      <span className={`text-[11px] font-semibold mt-0.5 ${cls}`}>{label}</span>
    </div>
  );
}

function altcoinLabel(v: number) {
  if (v >= 75) return "알트 시즌";
  if (v >= 50) return "알트 우세";
  if (v >= 25) return "BTC 우세";
  return "BTC 시즌";
}

function lsLabel(v: number) {
  if (v >= 65) return "롱 우세";
  if (v >= 55) return "롱 편향";
  if (v >= 45) return "숏 편향";
  return "숏 우세";
}

export default function MarketSentimentSection({
  fearGreed,
  fngComment,
  altcoinSeason,
  longShortRatio,
}: {
  fearGreed: FearGreed | null;
  fngComment?: string | null;
  altcoinSeason?: number | null;
  longShortRatio?: number | null;
}) {
  if (!fearGreed && altcoinSeason == null && longShortRatio == null) return null;

  return (
    <section style={{ contentVisibility: "visible" }}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pl-3 border-l-2 border-indigo-500">
        📊 시장 심리 &amp; 자금 흐름
      </h2>

      <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/80 to-slate-900 overflow-hidden">

        <div className="grid grid-cols-3 divide-x divide-slate-700/60 border-b border-slate-700/60">
          {fearGreed && (
            <div className="bg-slate-800/30">
              <GaugeCell v={fearGreed.value} label={fearGreed.classification_ko} title="공포·탐욕" />
            </div>
          )}
          {altcoinSeason != null && (
            <div className="bg-slate-800/30">
              <GaugeCell v={altcoinSeason} label={altcoinLabel(altcoinSeason)} title="알트코인 시즌" />
            </div>
          )}
          {longShortRatio != null && (
            <div className="bg-slate-800/30">
              <GaugeCell v={longShortRatio} label={lsLabel(longShortRatio)} title="롱/숏 비율" />
            </div>
          )}
        </div>


      </div>
    </section>
  );
}
