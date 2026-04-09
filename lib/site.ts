export const siteConfig = {
  name: "StraWeb",
  description: "A modern blog built with Next.js and Tailwind CSS.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "ko_KR",
} as const;
