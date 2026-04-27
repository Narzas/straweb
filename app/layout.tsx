import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import Header from "@/components/Header";
import DeployBanner from "@/components/DeployBanner";
import { NavigationProgress } from "@/components/NavigationProgress";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.author, url: siteConfig.url }],
  creator: siteConfig.author,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [{ url: `${siteConfig.url}/og?title=${encodeURIComponent(siteConfig.name)}`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [`${siteConfig.url}/og?title=${encodeURIComponent(siteConfig.name)}`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
  publisher: {
    "@type": "Person",
    name: siteConfig.author,
    url: siteConfig.url,
    sameAs: ["https://x.com/0xStragos"],
  },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* RSS 자동 발견 */}
        <link rel="alternate" type="application/rss+xml" title={`${siteConfig.name} RSS`} href="/rss.xml" />
        {/* Google Fonts preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch for external services */}
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        {/* Google AdSense — SSR HTML에 실제 <script> 태그를 박아 AdSense 봇이 검증 가능하게 함 */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088845697780578"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 antialiased">
        {/* 다크 모드 FOUC 방지 — hydration 전에 실행 */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();` }}
        />
        {/* Google Tag Manager */}
        <Script
          id="gtm"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-56CDQRKW');` }}
        />
        {/* Google Tag Manager (noscript) */}
        <noscript dangerouslySetInnerHTML={{ __html: '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-56CDQRKW" height="0" width="0" style="display:none;visibility:hidden"></iframe>' }} />
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[99999] -translate-y-20 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0"
        >
          본문 바로가기
        </a>
        <NavigationProgress />
        <DeployBanner />
        <Header />
        <main id="main-content" className="mx-auto w-full max-w-screen-xl flex-1 px-4 sm:px-6 lg:px-8 py-10">
          {children}
        </main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  );
}
