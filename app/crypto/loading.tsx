export default function Loading() {
  const bars = [55, 75, 45, 85, 60, 70, 40, 80, 65, 50, 72, 58];

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-white/75 dark:bg-slate-900/75 backdrop-blur-sm">
      <div className="flex items-end gap-1.5" style={{ height: 72 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-3.5 rounded-t bg-indigo-500 dark:bg-indigo-400"
            style={{
              height: `${h}%`,
              animation: `bar-wave 1.4s ease-in-out ${i * 0.1}s infinite alternate`,
              transformOrigin: "bottom",
            }}
          />
        ))}
      </div>
      <p className="mt-6 text-sm font-semibold text-indigo-500 dark:text-indigo-400 tracking-wide animate-pulse">
        시장 데이터 불러오는 중…
      </p>
      <style>{`
        @keyframes bar-wave {
          from { transform: scaleY(0.35); opacity: 0.35; }
          to   { transform: scaleY(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
