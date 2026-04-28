import Link from "next/link";
import { getAllCategories } from "@/lib/posts";
import HeaderClient from "./HeaderClient";
import AdminLockButton from "./AdminLockButton";

export default function Header() {
  const categories = getAllCategories();

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#080f1a]/95 backdrop-blur-md shadow-sm">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/60 dark:via-cyan-400/40 to-transparent" />
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-500 to-teal-600 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent"
          >
            StraWeb
          </Link>
          <AdminLockButton />
        </div>

        <HeaderClient categories={categories} />
      </div>
    </header>
  );
}
