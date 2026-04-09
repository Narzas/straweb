import Link from "next/link";
import { getAllCategories } from "@/lib/posts";

export default function Header() {
  const categories = getAllCategories();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
          StraWeb
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/about"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            About
          </Link>
          <Link
            href="/posts"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            Posts
          </Link>

          {/* Categories dropdown */}
          <div className="group relative">
            <button className="flex items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              Categories
              <svg className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className="invisible absolute right-0 top-full mt-2 w-44 rounded-xl border border-gray-200 bg-white py-1.5 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
              {categories.map(({ name, count }) => (
                <Link
                  key={name}
                  href={`/category/${encodeURIComponent(name.toLowerCase())}`}
                  className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span>{name}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
