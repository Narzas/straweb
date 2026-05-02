import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "방명록",
  description: "StraWeb 방명록입니다. 방문 인사나 짧은 메시지를 남겨주세요.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/guestbook" },
  openGraph: {
    title: "방명록 — StraWeb",
    description: "StraWeb 방명록입니다. 방문 인사나 짧은 메시지를 남겨주세요.",
    type: "website",
    locale: "ko_KR",
    url: `${siteConfig.url}/guestbook`,
    images: [{ url: `${siteConfig.url}/og?title=${encodeURIComponent("방명록")}`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "방명록 — StraWeb",
    description: "StraWeb 방명록입니다. 방문 인사나 짧은 메시지를 남겨주세요.",
    images: [`${siteConfig.url}/og?title=${encodeURIComponent("방명록")}`],
  },
};

export default function GuestbookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
