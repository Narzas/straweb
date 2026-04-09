/**
 * AdSlot — 애드센스 자리 예약 컴포넌트
 *
 * 실제 애드센스 삽입 방법:
 *   1. <script> 태그를 app/layout.tsx의 <head>에 추가
 *   2. placeholder div를 <ins class="adsbygoogle" ...>로 교체
 *   3. 아래 주석 처리된 useEffect 블록을 활성화
 */

"use client";

// import { useEffect } from "react";

type AdSize = "horizontal" | "rectangle" | "square";

const SIZE_STYLES: Record<AdSize, { minHeight: string; label: string }> = {
  horizontal:  { minHeight: "90px",  label: "광고 (728×90)" },
  rectangle:   { minHeight: "280px", label: "광고 (336×280)" },
  square:      { minHeight: "250px", label: "광고 (300×250)" },
};

type Props = {
  size?: AdSize;
  /** 실제 AdSense data-ad-slot 값 */
  slot?: string;
  className?: string;
};

export default function AdSlot({ size = "horizontal", slot, className = "" }: Props) {
  const { minHeight, label } = SIZE_STYLES[size];

  // --- 실제 애드센스 활성화 시 이 블록을 주석 해제 ---
  // useEffect(() => {
  //   try {
  //     ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
  //   } catch {}
  // }, []);

  /* ── placeholder (애드센스 미적용 상태) ── */
  if (!slot) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400 ${className}`}
        style={{ minHeight }}
        aria-hidden="true"
      >
        {label}
      </div>
    );
  }

  /* ── 실제 애드센스 ins 태그 ── */
  return (
    <div className={className} style={{ minHeight }}>
      {/* <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      /> */}
    </div>
  );
}
