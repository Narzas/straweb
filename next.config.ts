import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30일
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image7.coupangcdn.com",
      },
    ],
  },

  async headers() {
    const csp = [
      "default-src 'self'",
      // GTM 인라인 부트스트랩 + 테마 초기화 스크립트 때문에 unsafe-inline 필요
      // 개발 환경에서는 React 디버깅용 unsafe-eval 추가 허용
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://pagead2.googlesyndication.com https://adservice.google.com https://tpc.googlesyndication.com https://partner.googleadservices.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // 이미지: Supabase, Coupang 제휴, 외부 OG 이미지 허용
      "img-src 'self' data: blob: https:",
      // API 연결 허용 대상
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.coingecko.com https://query1.finance.yahoo.com https://open.er-api.com https://www.googletagmanager.com https://analytics.google.com https://stats.g.doubleclick.net https://www.google-analytics.com https://*.adtrafficquality.google https://adservice.google.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com",
      // GTM noscript iframe
      "frame-src https://www.googletagmanager.com",
      // Flash / 플러그인 완전 차단
      "object-src 'none'",
      // base 태그 인젝션 방지
      "base-uri 'self'",
      // 폼 액션 자사 도메인만
      "form-action 'self'",
      // 클릭재킹 방지 (frame-ancestors는 X-Frame-Options보다 강력)
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        // 정적 에셋 장기 캐싱 (_next/ 제외 — Vercel이 직접 처리)
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // 보안 헤더 — _next/ 경로 제외
        source: "/((?!_next/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HTTPS 강제 (2년, preload 포함)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
