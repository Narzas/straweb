import Link from "next/link";

const links = [
  { href: "/about",   label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <span className="text-sm text-gray-500">
          © {new Date().getFullYear()} StraWeb. All rights reserved.
        </span>
        <nav className="flex gap-5">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
