"use client";

import { useEffect } from "react";

export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    if (sessionStorage.getItem(key)) return;
    fetch(`/api/views/${slug}`, { method: "POST" })
      .then(() => sessionStorage.setItem(key, "1"))
      .catch(() => {});
  }, [slug]);

  return null;
}
