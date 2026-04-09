"use client";

import { useEffect, useRef } from "react";

type AdSize = "horizontal" | "rectangle" | "square";

const SIZE_MIN_HEIGHT: Record<AdSize, string> = {
  horizontal: "90px",
  rectangle:  "280px",
  square:     "250px",
};

type Props = {
  size?: AdSize;
  className?: string;
};

const AD_CLIENT = "ca-pub-2088845697780578";
const AD_SLOT   = "3715901846";

export default function AdSlot({ size = "horizontal", className = "" }: Props) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      // 이미 push된 ins는 다시 push하지 않음
      if (insRef.current && insRef.current.getAttribute("data-adsbygoogle-status") === null) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch {}
  }, []);

  return (
    <div
      className={className}
      style={{ minHeight: SIZE_MIN_HEIGHT[size], overflow: "hidden" }}
    >
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
