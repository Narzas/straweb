import Link from "next/link";
import { getAllCategories } from "@/lib/posts";
import HeaderClient from "./HeaderClient";

export default function Header() {
  const categories = getAllCategories();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
          StraWeb
        </Link>

        <HeaderClient categories={categories} />
      </div>
    </header>
  );
}
