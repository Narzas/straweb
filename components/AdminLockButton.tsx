"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLockButton() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setOpen(false);
        setPassword("");
        router.push("/admin/analytics");
        router.refresh();
      } else if (res.status === 429) {
        setError("시도 너무 많음. 5분 후 재시도");
      } else {
        setError("비밀번호 틀림");
      }
    } catch {
      setError("네트워크 에러");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="관리자 로그인"
        className="ml-1 text-gray-300 dark:text-slate-600 hover:text-teal-500 dark:hover:text-cyan-400 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5"
        >
          <path
            fillRule="evenodd"
            d="M10 1a4 4 0 00-4 4v3H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 7V5a2 2 0 10-4 0v3h4z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[90%] max-w-sm rounded-xl bg-white dark:bg-slate-800 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 text-teal-500 dark:text-cyan-400"
              >
                <path
                  fillRule="evenodd"
                  d="M10 1a4 4 0 00-4 4v3H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 7V5a2 2 0 10-4 0v3h4z"
                  clipRule="evenodd"
                />
              </svg>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                관리자 로그인
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                disabled={submitting}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-teal-500 dark:focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-cyan-400"
              />
              {error && (
                <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="flex-1 rounded-md border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting || !password}
                  className="flex-1 rounded-md bg-teal-500 dark:bg-cyan-500 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 dark:hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "확인 중…" : "로그인"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
