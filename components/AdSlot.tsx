"use client";

import { useEffect, useRef } from "react";

type Props = {
  size?: "horizontal" | "rectangle" | "square";
  className?: string;
};

const AD_CLIENT = "ca-pub-2088845697780578";
const AD_SLOT   = "3715901846";

export default function AdSlot({ size: _size, className = "" }: Props) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      if (insRef.current && insRef.current.getAttribute("data-adsbygoogle-status") === null) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch {}
  }, []);

  return (
    <div className={className} style={{ overflow: "hidden" }}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
