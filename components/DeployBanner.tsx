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
        "fixed bottom-6 right-6 z-[200] flex flex-col gap-1.5 rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-md transition-all",
        "border",
        status === "building"
          ? "bg-slate-900/80 border-teal-500/40 text-white"
          : "bg-slate-900/80 border-emerald-500/40 text-white",
      ].join(" ")}
      style={{ minWidth: "220px" }}
    >
      {status === "building" ? (
        <>
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-300">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            새 버전 업데이트 중
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            사이트를 개선하고 있습니다.<br />
            잠시 후 새로고침하면 최신 버전을 볼 수 있어요.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <span>✓</span> 업데이트 완료
            </span>
            <button
              onClick={() => setStatus("idle")}
              className="text-slate-500 hover:text-slate-300 transition-colors text-xs"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            새 버전이 준비됐습니다.<br />
            새로고침하면 바로 적용돼요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 transition-colors py-1.5 text-xs font-semibold text-white"
          >
            지금 새로고침
          </button>
        </>
      )}
    </div>
  );
}
