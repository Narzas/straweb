"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  contentHtml: string;
}

export default function PostBody({ contentHtml }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>("");

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

  // 이벤트 위임 방식 — 컨테이너에 핸들러 하나만 등록, cleanup 정확히 동작
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;

    // cursor 스타일만 개별 적용
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

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  return (
    <>
      <div
        ref={bodyRef}
        className="post-body"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-modal="true"
          aria-label="이미지 확대"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt={lightboxAlt}
            className="rounded-lg shadow-2xl"
            style={{ maxHeight: "90vh", maxWidth: "90vw", width: "auto", height: "auto" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors"
            onClick={() => setLightboxSrc(null)}
            aria-label="닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
