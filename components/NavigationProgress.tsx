"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathname = useRef(pathname);
  const tickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (!a) return;
      const href = (a as HTMLAnchorElement).getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || (a as HTMLAnchorElement).target === "_blank") return;
      if (href === pathname) return;

      if (hideRef.current) clearTimeout(hideRef.current);
      if (tickRef.current) clearTimeout(tickRef.current);
      setVisible(true);
      setWidth(25);
      tickRef.current = setTimeout(() => setWidth(65), 200);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  useEffect(() => {
    if (pathname === prevPathname.current) return;
    prevPathname.current = pathname;

    if (tickRef.current) clearTimeout(tickRef.current);
    setWidth(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 400);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-1 pointer-events-none transition-[width] ease-out"
      style={{
        width: `${width}%`,
        transitionDuration: width === 100 ? "200ms" : "400ms",
        background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
        boxShadow: "0 0 8px 1px #6366f1aa",
      }}
    />
  );
}
