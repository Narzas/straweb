import Link from "next/link";
import VisitorCounter from "./VisitorCounter";

const links = [
  { href: "/about",   label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} StraWeb. All rights reserved.
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            본 사이트는 쿠팡 파트너스 활동의 일환으로 수수료를 받을 수 있습니다.
          </span>
          <VisitorCounter />
        </div>
        <nav className="flex gap-5">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
