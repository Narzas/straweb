import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-7xl font-black text-indigo-200 dark:text-indigo-900 select-none mb-6">404</p>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
        요청하신 페이지가 삭제되었거나 주소가 변경되었을 수 있습니다.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          홈으로 돌아가기
        </Link>
        <Link
          href="/posts"
          className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          글 목록 보기
        </Link>
      </div>
    </div>
  );
}
