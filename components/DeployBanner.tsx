"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "building" | "done";

export default function DeployBanner() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let wasBuilding = false;

    const check = async () => {
      try {
        const res = await fetch("/api/deploy-status");
        if (!res.ok) return;
        const { building } = await res.json();

        if (building) {
          wasBuilding = true;
          setStatus("building");
        } else if (wasBuilding) {
          wasBuilding = false;
          setStatus("done");
        }
      } catch {
        // 조용히 무시
      }
    };

    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  if (status === "idle") return null;

  return (
    <div
      className={[
        "fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 py-1.5 px-4 text-xs font-medium transition-colors",
        status === "building"
          ? "bg-indigo-600 text-white"
          : "bg-emerald-500 text-white",
      ].join(" ")}
    >
      {status === "building" ? (
        <>
          {/* 스피너 */}
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          새 버전 배포 중...
        </>
      ) : (
        <>
          ✓ 배포 완료
          <button
            onClick={() => window.location.reload()}
            className="ml-2 underline underline-offset-2 hover:no-underline"
          >
            새로고침
          </button>
          <button
            onClick={() => setStatus("idle")}
            className="ml-3 opacity-70 hover:opacity-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
