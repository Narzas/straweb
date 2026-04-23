import Link from "next/link";
import { siteConfig } from "@/lib/site";

type BreadcrumbItem = { label: string; href?: string };

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${siteConfig.url}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="breadcrumb" className="mb-6">
      <ol className="flex items-center flex-wrap gap-1.5 text-sm text-gray-400 dark:text-gray-500">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300 dark:text-slate-600" aria-hidden="true">/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-teal-600 dark:hover:text-cyan-400 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[200px] sm:max-w-xs"
                aria-current="page"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
    </>
  );
}
