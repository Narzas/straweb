"use client";

const SPARKLINE = "M 0 20 L 22 15 L 40 22 L 58 8 L 74 16 L 90 5 L 108 13 L 124 7 L 140 18 L 158 4 L 174 12 L 190 8 L 200 10";
const SPARKLINE2 = "M 0 16 L 18 22 L 34 12 L 52 24 L 68 10 L 84 20 L 100 14 L 118 22 L 134 6 L 150 18 L 166 10 L 182 20 L 200 14";

const VARIANTS = {
  bull:    { color: "#10b981", path: SPARKLINE },
  bear:    { color: "#f43f5e", path: SPARKLINE2 },
  neutral: { color: "#6366f1", path: SPARKLINE },
} as const;

export function MarketPulseDivider({ variant = "neutral" }: { variant?: "bull" | "bear" | "neutral" }) {
  const { color, path } = VARIANTS[variant];

  return (
    <div className="relative flex items-center justify-center overflow-hidden" style={{ height: 32 }}>
      <style>{`
        @keyframes mpDash {
          0%   { stroke-dashoffset: 500; opacity: 0; }
          15%  { opacity: 0.9; }
          85%  { opacity: 0.9; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes mpDot {
          0%, 100% { opacity: 0.2; r: 2; }
          50%       { opacity: 1;   r: 3.5; }
        }
      `}</style>

      {/* 배경 그라디언트 라인 */}
      <div className="absolute inset-0 flex items-center px-8">
        <div className="w-full h-px" style={{
          background: `linear-gradient(to right, transparent, ${color}25, ${color}60, ${color}25, transparent)`
        }} />
      </div>

      {/* 스파크라인 */}
      <svg viewBox="0 0 200 28" fill="none" style={{ width: "min(280px, 70%)", height: 28 }}>
        <path
          d={path}
          stroke={color} strokeWidth={1.2}
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="500"
          strokeDashoffset="500"
          style={{ animation: "mpDash 2.8s ease-in-out infinite" }}
        />
        <circle cx="200" cy="10" r="2" fill={color}
          style={{ animation: "mpDot 2.8s ease-in-out infinite" }}
        />
      </svg>
    </div>
  );
}
