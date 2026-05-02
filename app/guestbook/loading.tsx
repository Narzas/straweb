function BubbleDot({ delay }: { delay: string }) {
  return (
    <div
      className="w-3 h-3 rounded-full bg-teal-400 dark:bg-cyan-500"
      style={{ animation: `bubble-bounce 1.2s ease-in-out ${delay} infinite` }}
    />
  );
}

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-white/75 dark:bg-slate-900/75 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-5 py-4 rounded-2xl bg-teal-50 dark:bg-cyan-950/40 border border-teal-100 dark:border-cyan-800">
        <BubbleDot delay="0s" />
        <BubbleDot delay="0.2s" />
        <BubbleDot delay="0.4s" />
      </div>
      <p className="mt-5 text-sm font-semibold text-teal-400 animate-pulse">방명록 불러오는 중…</p>
      <style>{`
        @keyframes bubble-bounce {
          0%, 100% { transform: translateY(0);    opacity: 0.5; }
          50%       { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
