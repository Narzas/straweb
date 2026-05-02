export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-[6px] border-teal-100 dark:border-cyan-900" />
        <div className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-teal-500 animate-spin" />
      </div>
      <p className="mt-6 text-base font-semibold text-teal-400 dark:text-cyan-400 animate-pulse">
        로딩 중…
      </p>
    </div>
  );
}
