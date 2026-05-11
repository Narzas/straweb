import Link from "next/link";
import { DayCard } from "@/components/admin/DayCard";
import { getBuyPickDays } from "@/lib/buy-picks";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "매수타점",
  robots: { index: false, follow: false },
};

export default async function AdminPicksPage() {
  const days = await getBuyPickDays();

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            매수타점
          </h1>
          <Link
            href="/admin/analytics"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Analytics
          </Link>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          휴장일 제외 매일 업데이트
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        대한민국 주식 차트의 특정 패턴을 기반으로 산출한 매수타점입니다.
        투자 권유가 아닌 참고용 자료입니다.
      </p>

      {days.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-sm text-gray-400">
          아직 등록된 매수타점이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {days.map((day) => (
            <DayCard key={day.date} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
