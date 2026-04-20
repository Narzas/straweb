@AGENTS.md

## 프로젝트 현황 (2026-04-20 기준)

### 서비스
- **도메인**: https://www.stragos.xyz (Vercel 배포, master 브랜치 자동 배포)
- `stragos.xyz` → `www.stragos.xyz` 리다이렉트 (Vercel 설정)
- **스택**: Next.js 16, TypeScript, Supabase, Tailwind
- `NEXT_PUBLIC_SITE_URL=https://www.stragos.xyz`

### 주인장 관심뉴스 피드 (`components/OwnerNewsFeed.tsx`)
- Telegram 채널 4개 슬라이드 피드 (Twitter 제거됨)
- API: `app/api/telegram-feed/[channel]/route.ts` — `t.me/s/{channel}` HTML 스크래핑
- **ALLOWED 채널**:
  - `wublockchainkr` — 번역 버튼 없음 (noTranslate)
  - `top7ico`
  - `lookonchainchannel`
  - `WatcherGuru`
- 채널별 텍스트 후처리:
  - top7ico: `Top 7 Ecosystem:.*` 제거
  - lookonchainchannel: 맨뒤 `x.com/lookonchain/` 링크 제거
  - WatcherGuru: `@WatcherGuru` 제거
- **사진**: `photos: string[]` (복수 지원), 2장 이상 시 ‹ › 버튼 + n/n 캐러셀
- **라이트박스**: `ImageLightbox` (createPortal)
- 클라이언트 폴링: 60초, 서버 fetch 캐시: `next: { revalidate: 120 }`
- Edge runtime 제거 (Node.js 기본 — revalidate 정상 작동)
- localStorage 키: `owner-news-feed-v6`
- `TelegramPost` 타입: `{ id, text, photos: string[], time, url }`
- 번역: 프론트엔드 Google Translate 버튼

### 크립토 브리핑 (`scripts/generate-crypto-daily.mjs`)
- **GitHub Actions**: cron-job.org → workflow_dispatch, **매시간 정각** 실행
- **Telegram 발송**: KST 0·6·12·18시에만 자동 발송 (나머지 시간은 DB만 업데이트)
  ```js
  const kstHour = new Date(Date.now() + 9 * 3600_000).getUTCHours();
  const isTelegramHour = [0, 6, 12, 18].includes(kstHour);
  const noTelegram = process.argv.includes("--no-telegram") || !isTelegramHour;
  ```
- `--no-telegram`: Telegram 건너뛰고 DB만 저장
- `--dry-run`: DB·Telegram 모두 건너뜀
- **롱숏비율**: OKX 우선, Binance·Bybit 폴백 (GitHub Actions US 서버 geo-block)
- **예측시장**: 전체 카테고리 (crypto 필터 제거), 거래량순
- **스마트머니**: `Math.abs(net_flow_24h_usd) >= 10_000` 필터
- **Telegram 푸터**:
  ```
  ➡️ 최신 브리핑 전체 보기 (링크)
  🔄 웹 브리핑 매시간 갱신
  📨 텔레그램 알림 6시간마다 발송
  ```

### 크립토 페이지 (`app/crypto/page.tsx`)
- `revalidate = 3600` (1시간)
- Supabase에서 데이터 읽기 (외부 API 직접 호출 없음)
- canonical: `https://www.stragos.xyz/crypto`

### Posts 페이지 (`app/posts/page.tsx`)
- 상단에 카테고리 섹션 추가 (홈페이지와 동일 스타일)

### Sitemap (`app/sitemap.ts`)
- `/crypto` 포함: `changeFrequency: "daily"`, `priority: 0.9`

### CoinGecko 주의사항
- 무료 티어: 분당 30회 rate limit
- 스크립트 1회 실행당 CoinGecko 5회 호출
- 매시간 실행 = 120회/일 — 여유 있음
- 테스트 반복 실행 시 분당 rate limit 주의

### 환경변수 (`.env.local` + Vercel)
- `DEEPL_API_KEY` — 소진됨, 충전 필요 (현재 Google Translate로 대체)
- `NEXT_PUBLIC_SITE_URL=https://www.stragos.xyz`
- Supabase, Telegram Bot Token 등 기타
