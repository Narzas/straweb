function ShimmerLine({ width = "100%" }: { width?: string }) {
  return (
    <div className="relative h-3 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden" style={{ width }}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-gray-200/80 dark:via-slate-500/40 to-transparent" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-2.5">
      <ShimmerLine width="60%" />
      <ShimmerLine />
      <ShimmerLine width="80%" />
      <ShimmerLine width="40%" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white/75 dark:bg-slate-900/75 backdrop-blur-sm">
      <div className="w-full max-w-lg px-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
