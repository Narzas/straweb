import { createServiceClient } from "@/lib/supabase";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

type LogRow = {
  ts: string;
  slug: string | null;
  path: string | null;
  referrer: string | null;
  ua_browser: string | null;
  ua_os: string | null;
  ua_device: string | null;
  country: string | null;
  ip_hash: string | null;
};

function topN<T extends string | null>(
  rows: LogRow[],
  key: keyof LogRow,
  n = 10
): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = (r[key] as T) ?? "(none)";
    const k = String(v);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function uniqueVisitors(rows: LogRow[]): number {
  return new Set(rows.map((r) => r.ip_hash).filter(Boolean)).size;
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  const kst = new Date(d.getTime() + 9 * 3600_000);
  return kst.toISOString().replace("T", " ").slice(0, 19);
}

export default async function AnalyticsPage() {
  const supabase = createServiceClient();

  const now = Date.now();
  const day1Ago = new Date(now - 24 * 3600_000).toISOString();
  const day7Ago = new Date(now - 7 * 24 * 3600_000).toISOString();

  const [logs7d, logs1d, recent] = await Promise.all([
    supabase
      .from("visitor_logs")
      .select("ts,slug,path,referrer,ua_browser,ua_os,ua_device,country,ip_hash")
      .gte("ts", day7Ago)
      .order("ts", { ascending: false })
      .limit(5000),
    supabase
      .from("visitor_logs")
      .select("ts,slug,path,referrer,ua_browser,ua_os,ua_device,country,ip_hash")
      .gte("ts", day1Ago)
      .order("ts", { ascending: false })
      .limit(5000),
    supabase
      .from("visitor_logs")
      .select("ts,slug,path,referrer,ua_browser,ua_os,ua_device,country,ip_hash")
      .order("ts", { ascending: false })
      .limit(50),
  ]);

  const rows7d: LogRow[] = (logs7d.data ?? []) as LogRow[];
  const rows1d: LogRow[] = (logs1d.data ?? []) as LogRow[];
  const recentRows: LogRow[] = (recent.data ?? []) as LogRow[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Analytics
        </h1>
        <LogoutButton />
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="24시간 방문" value={rows1d.length} />
        <Kpi label="24시간 고유" value={uniqueVisitors(rows1d)} />
        <Kpi label="7일 방문" value={rows7d.length} />
        <Kpi label="7일 고유" value={uniqueVisitors(rows7d)} />
      </div>

      {/* TOP 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ListCard title="유입 경로 (24h)" items={topN(rows1d, "referrer")} />
        <ListCard title="인기 페이지 (24h)" items={topN(rows1d, "path")} />
        <ListCard title="유입 경로 (7d)" items={topN(rows7d, "referrer")} />
        <ListCard title="인기 페이지 (7d)" items={topN(rows7d, "path")} />
      </div>

      {/* 분포 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ListCard title="브라우저 (7d)" items={topN(rows7d, "ua_browser")} />
        <ListCard title="OS (7d)" items={topN(rows7d, "ua_os")} />
        <ListCard title="디바이스 (7d)" items={topN(rows7d, "ua_device")} />
        <ListCard title="국가 (7d)" items={topN(rows7d, "country")} />
      </div>

      {/* 최근 로그 */}
      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="border-b border-gray-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            최근 50건 (raw)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-slate-900/50 text-left text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 font-medium">KST</th>
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 font-medium">Referrer</th>
                <th className="px-3 py-2 font-medium">Browser</th>
                <th className="px-3 py-2 font-medium">OS</th>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">IP hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {recentRows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-900/50">
                  <td className="px-3 py-2 font-mono text-gray-500 dark:text-gray-400">
                    {formatTs(r.ts)}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                    {r.path ?? r.slug ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                    {r.referrer ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {r.ua_browser ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {r.ua_os ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {r.ua_device ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {r.country ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-400 dark:text-gray-500">
                    {r.ip_hash?.slice(0, 8) ?? "—"}
                  </td>
                </tr>
              ))}
              {recentRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    아직 로그가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: { name: string; count: number }[];
}) {
  const max = items[0]?.count ?? 1;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">데이터 없음</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.name} className="relative">
              <div
                className="absolute inset-y-0 left-0 rounded bg-teal-50 dark:bg-cyan-900/20"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
              <div className="relative flex justify-between px-2 py-1 text-xs">
                <span className="truncate text-gray-700 dark:text-gray-300">
                  {item.name}
                </span>
                <span className="ml-2 font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {item.count.toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
