"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  size?: "horizontal" | "rectangle" | "square";
  className?: string;
};

const AD_CLIENT = "ca-pub-2088845697780578";
const AD_SLOT   = "3715901846";

export default function AdSlot({ size: _size, className = "" }: Props) {
  const insRef = useRef<HTMLModElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = insRef.current;
    if (!el || el.getAttribute("data-adsbygoogle-status") !== null) return;

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {}

    // data-ad-status 설정될 때까지 polling → "unfilled" 이외면 표시
    const timer = setInterval(() => {
      const status = el.getAttribute("data-ad-status");
      if (status !== null) {
        clearInterval(timer);
        clearTimeout(fallback);
        if (status !== "unfilled") setVisible(true);
      }
    }, 300);

    // 3초 안에 상태 없으면 unfilled로 간주 → 숨김 유지
    const fallback = setTimeout(() => clearInterval(timer), 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(fallback);
    };
  }, []);

  return (
    // visible 아닐 때 높이 0으로 완전히 접어버림
    <div
      className={visible ? className : ""}
      style={visible ? { overflow: "hidden" } : { height: 0, overflow: "hidden" }}
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
