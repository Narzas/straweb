import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[72vh] flex-col items-center justify-center px-4">
      <div className="relative w-full max-w-sm text-center">

        {/* 배경 글로우 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-20 dark:opacity-10"
          style={{ background: "radial-gradient(ellipse at center, #14b8a6 0%, transparent 70%)" }}
        />

        {/* 패널 */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-inset ring-black/5 dark:ring-white/5">

          {/* 상단 라인 */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-teal-400/60 dark:via-cyan-400/40 to-transparent" />

          <div className="px-10 py-10 space-y-5">

            {/* ERROR 레이블 */}
            <p className="text-[10px] font-bold tracking-[0.5em] uppercase text-teal-500 dark:text-cyan-400">
              E R R O R
            </p>

            {/* 404 숫자 */}
            <div className="relative py-2">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9rem] font-black leading-none text-black/[0.04] dark:text-white/[0.04] select-none blur-sm"
              >
                404
              </span>
              <p className="relative text-[6rem] font-black leading-none tabular-nums bg-gradient-to-b from-gray-900 via-gray-700 to-gray-400 dark:from-white dark:via-slate-300 dark:to-slate-500 bg-clip-text text-transparent select-none">
                404
              </p>
            </div>

            {/* GAME OVER */}
            <div className="space-y-1.5">
              <h1 className="text-lg font-black tracking-[0.15em] uppercase text-gray-800 dark:text-slate-200">
                GAME OVER
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                요청한 페이지가 삭제되었거나<br />주소가 변경되었을 수 있습니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/"
                className="rounded-lg bg-teal-600 hover:bg-teal-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white transition-colors shadow-lg shadow-teal-500/20"
              >
                CONTINUE →
              </Link>
              <Link
                href="/posts"
                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600 hover:text-gray-900 dark:hover:text-slate-100 transition-colors"
              >
                ALL POSTS
              </Link>
            </div>

          </div>

          {/* 하단 라인 */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-slate-700 to-transparent" />

          {/* 하단 상태바 */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-gray-50 dark:bg-slate-800/60">
            <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">HTTP 404</span>
            <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">stragos.xyz</span>
          </div>
        </div>

      </div>
    </div>
  );
}
