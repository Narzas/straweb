@AGENTS.md

## 프로젝트 현황 (2026-04-20 기준)

### 서비스
- **도메인**: stragos.xyz (Vercel 배포)
- **스택**: Next.js 16, TypeScript, Supabase, Tailwind

### 주인장 관심뉴스 피드 (`components/OwnerNewsFeed.tsx`)
- WuBlockchain (Twitter) + TOP 7 ICO (Telegram) 슬라이드 피드
- Twitter: `app/api/twitter-feed/[username]/route.ts` — syndication API로 트윗 파싱, fxtwitter API로 전문 보완, Jina로 기사 본문 fetch
- Telegram: `app/api/top7ico-feed/route.ts` — `t.me/s/top7ico` HTML 파싱
- 번역: 프론트엔드 Google Translate 버튼 (DeepL Free 쿼터 소진)
- localStorage 캐시 키: `owner-news-feed-v2`

### 크립토 브리핑 (`scripts/generate-crypto-daily.mjs`)
- GitHub Actions로 KST 06·12·18·00시 자동 실행
- Telegram 채널로 발송
- DeepL API 키: Vercel + `.env.local`에 `DEEPL_API_KEY` (현재 500K 쿼터 소진 상태)

### 환경변수 (`.env.local` + Vercel)
- `DEEPL_API_KEY` — 소진됨, 충전 필요
- Supabase, Telegram Bot Token 등 기타

### 다음 작업 후보
- DeepL 쿼터 충전 또는 서버사이드 번역 대안 검토
