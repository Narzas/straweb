"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  contentHtml: string;
}

export default function PostBody({ contentHtml }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 코드 블록 복사 버튼
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;

    container.querySelectorAll<HTMLElement>("figure[data-rehype-pretty-code-figure]").forEach((fig) => {
      if (fig.querySelector(".copy-btn")) return;
      const pre = fig.querySelector("pre");
      if (!pre) return;
      const btn = document.createElement("button");
      btn.className = "copy-btn absolute right-2 top-2 z-10 rounded-md bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20 transition-colors";
      btn.style.cursor = "pointer";
      btn.setAttribute("aria-label", "코드 복사");
      btn.textContent = "복사";
      btn.addEventListener("click", () => {
        const text = pre.textContent ?? "";
        const markDone = () => {
          btn.textContent = "복사됨";
          setTimeout(() => { btn.textContent = "복사"; }, 2000);
        };
        const fallback = () => {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;opacity:0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          markDone();
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(markDone).catch(fallback);
        } else {
          fallback();
        }
      });
      fig.style.position = "relative";
      fig.appendChild(btn);
    });
  }, [contentHtml]);

  // 이미지 클릭 → 라이트박스 열기
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;

    container.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      img.style.cursor = "zoom-in";
    });

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        const img = target as HTMLImageElement;
        setLightboxSrc(img.getAttribute("src") ?? img.src);
        setLightboxAlt(img.alt ?? "");
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [contentHtml]);

  // 라이트박스 열릴 때 줌 초기화
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    dragRef.current = null;
  }, [lightboxSrc]);

  // ESC 닫기
  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  // 휠 줌 (passive: false 필요)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !lightboxSrc) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => Math.min(8, Math.max(0.5, s - e.deltaY * 0.002)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [lightboxSrc]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, tx: translate.x, ty: translate.y };
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setTranslate({
      x: dragRef.current.tx + (e.clientX - dragRef.current.startX),
      y: dragRef.current.ty + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const resetZoom = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return (
    <>
      <div
        ref={bodyRef}
        className="post-body"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-modal="true"
          aria-label="이미지 확대"
        >
          {/* 줌 컨트롤 */}
          <div
            className="absolute left-1/2 bottom-5 -translate-x-1/2 flex items-center gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="rounded-full bg-white/20 w-9 h-9 flex items-center justify-center text-white text-lg font-bold hover:bg-white/40 transition-colors"
              onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(8, s + 0.5)); }}
              aria-label="확대"
            >+</button>
            <span className="text-white/70 text-xs w-12 text-center tabular-nums select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              className="rounded-full bg-white/20 w-9 h-9 flex items-center justify-center text-white text-lg font-bold hover:bg-white/40 transition-colors"
              onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(0.5, s - 0.5)); }}
              aria-label="축소"
            >−</button>
            <button
              className="rounded-full bg-white/20 px-3 h-9 flex items-center justify-center text-white text-xs hover:bg-white/40 transition-colors ml-1"
              onClick={resetZoom}
              aria-label="원래 크기"
            >초기화</button>
          </div>

          {/* 닫기 버튼 */}
          <button
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors z-10"
            onClick={() => setLightboxSrc(null)}
            aria-label="닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* 이미지 영역 */}
          <div
            ref={containerRef}
            className="flex items-center justify-center overflow-hidden"
            style={{
              width: "90vw",
              height: "90vh",
              cursor: dragRef.current ? "grabbing" : scale > 1 ? "grab" : "zoom-in",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={() => resetZoom()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxSrc}
              alt={lightboxAlt}
              draggable={false}
              style={{
                maxHeight: "85vh",
                maxWidth: "85vw",
                width: "auto",
                height: "auto",
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: dragRef.current ? "none" : "transform 0.15s ease",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
