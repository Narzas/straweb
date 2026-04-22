import Link from "next/link";
import VisitorCounter from "./VisitorCounter";

const NAV_LINKS = [
  { href: "/about",   label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

          {/* 브랜드 */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900 dark:text-white">StraWeb</p>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400 max-w-xs">
              개발·크립토·게임을 직접 경험하고 기록하는 공간입니다.
            </p>
            <VisitorCounter />
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              본 사이트는 쿠팡 파트너스 활동의 일환으로 수수료를 받을 수 있습니다.
            </p>
          </div>

          {/* 링크 + SNS */}
          <div className="flex flex-col gap-3 sm:items-end">
            <nav className="flex gap-5" aria-label="푸터 내비게이션">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline underline-offset-2 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <a
                href="https://x.com/0xStragos"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter) @0xStragos"
                className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>

            <span className="text-xs text-gray-400 dark:text-gray-500">
              © {new Date().getFullYear()} StraWeb. All rights reserved.
            </span>
          </div>

        </div>
      </div>
    </footer>
  );
}
