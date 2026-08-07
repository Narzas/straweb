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
- `lastModified`: `post.updated ?? post.date` (updated 필드 우선)

### 카테고리 표시 스타일 (2026-04-22 확정)
- 홈(`app/page.tsx`)과 posts 페이지 모두 `flex flex-wrap` pill 스타일 통일
- 이모지 + 이름 + 카운트 뱃지, `rounded-full border` 스타일
- grid 카드형 스타일 사용 안 함 (너무 크고 불일치)

### 주요 페이지 디자인 (2026-04-22 개편)
- **404** (`app/not-found.tsx`): 게임오버 스타일 패널 — 그라디언트 텍스트 404, "GAME OVER" 헤딩, HTTP 상태바
- **About** (`app/about/page.tsx`): 커버 오버레이 히어로 + 프로필 스트립(포스트 수 표시) + 기술 스택 배지 + 토픽 카드(카테고리 링크)
- **PostCard** (`components/PostCard.tsx`): `variant` prop 추가 — `"list"` (기본 가로형) / `"grid"` (세로형, category·tag·search 2열 그리드용)
- **Search** (`app/search/page.tsx`): 빈 상태에 인기 태그 칩 표시 (`getAllTags` 사용)

### SEO (2026-04-22 완료)
- OG `siteName`, `locale: "ko_KR"`, Twitter card 전 페이지 완료
- BreadcrumbList JSON-LD: category/tag 페이지
- Blog/WebSite/Person JSON-LD: `app/layout.tsx`
- `robots.ts` 동적 생성 (`public/robots.txt` 삭제됨)

### 파일 편집 안전 규칙
- **PowerShell로 한국어 파일 편집 금지** — 인코딩 깨짐
- 복잡한 다중 파일 패치: Node.js ESM 스크립트(`.mjs`) 작성 후 실행, 완료 후 삭제
- 단순 영문 치환: `sed -i` 사용 가능
- 한국어 포함 파일: Read + Edit 도구 사용

### CoinGecko 주의사항
- **키리스(공용) 한도는 ~4회/윈도우** — 분당 30회는 Demo **API 키 발급 시** 한도임
- 스크립트 1회 실행당 CoinGecko **6회** 호출 (`/global`, `/search/trending`, `/coins/markets` ×3, `/coins/categories`) — 이 중 3개는 `Promise.all` 동시 발사
- 따라서 `COINGECKO_API_KEY` 필수. 없으면 429 → `market: null` → "오늘 시장 데이터를 불러오지 못했습니다."
- CoinGecko 호출은 반드시 `cgFetch()` 사용 (키 주입 + 429 지수 백오프 재시도 3회)
- `safeFetch(url, headers, timeoutMs, retries)` — `retries` 기본 0. 심볼 루프에서 도는 호출(선물 스캐너·RSI)에 재시도를 넣으면 실행 시간이 폭증하므로 기본값 유지할 것
- `market`이 null이면 DB 저장·텔레그램 발송을 건너뜀 — upsert가 `date` 기준이라 같은 날 앞선 성공분을 덮어쓰기 때문
- 테스트 반복 실행 시 rate limit 주의

### 환경변수 (`.env.local` + Vercel)
- `DEEPL_API_KEY` — 소진됨, 충전 필요 (현재 Google Translate로 대체)
- `NEXT_PUBLIC_SITE_URL=https://www.stragos.xyz`
- `COINGECKO_API_KEY` — CoinGecko Demo 키(무료). 로컬 `.env.local` + Oracle Cloud 서버 양쪽에 필요
- Supabase, Telegram Bot Token 등 기타
