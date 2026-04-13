export const siteConfig = {
  name: "StraWeb",
  description: "개발, 리뷰, 투자 등 관심 있는 것들을 편하게 기록하는 블로그입니다.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "ko_KR",
} as const;
