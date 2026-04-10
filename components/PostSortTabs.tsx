"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const TABS = [
  { key: "date", label: "최신순" },
  { key: "views", label: "조회수순" },
] as const;

export default function PostSortTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "date";

  function setSort(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === "date") params.delete("sort");
    else params.set("sort", sort);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setSort(key)}
          className={[
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            current === key
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
