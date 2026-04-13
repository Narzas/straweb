"use client";

import { useEffect, useState } from "react";

export default function ViewCount({
  slug,
  initialCount,
}: {
  slug: string;
  initialCount?: number;
}) {
  const [count, setCount] = useState<number | null>(initialCount ?? null);

  useEffect(() => {
    if (initialCount !== undefined) return; // 서버에서 미리 받은 경우 fetch 생략
    fetch(`/api/views/${slug}`)
      .then((r) => r.json())
      .then((d) => setCount(d.count))
      .catch(() => {});
  }, [slug, initialCount]);

  if (count === null) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path
          fillRule="evenodd"
          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z"
          clipRule="evenodd"
        />
      </svg>
      {count.toLocaleString()}
    </span>
  );
}
