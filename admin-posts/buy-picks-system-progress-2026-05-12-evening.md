---
title: 매수타점 시스템 — 진행 현황 (2026-05-12 저녁)
date: 2026-05-12T22:00:00+09:00
description: 5-12 하루 동안의 모든 변경 사항. 다른 PC에서 이어 작업하기 위한 완전한 상태 메모.
category: 운영
tags: [매수타점, 주식, 패턴, 차트, supabase, python, fdr]
---

> 5-11 메모(`buy-picks-system-progress.md`) 이후 5-12 작업 전체. 이 메모만 읽고도 다음 PC에서 이어 작업 가능.

---

## 0. 다른 PC에서 이어 작업하기 (체크리스트)

1. `git pull` (master 브랜치)
2. Python deps 그대로: `pip install -r scripts/stocks/requirements.txt`
3. `.env.local` 있는지 확인 — UTF-8 BOM이면 `load_dotenv(encoding='utf-8-sig')` 이미 적용됨
4. dev 서버: `npm run dev` (포트 3000)
5. 검증: `python scripts/stocks/detect_picks.py --ticker 108490 --date 2026-05-12 --min-score 0` → DAILY CUP_HANDLE score=80 통과해야 정상
6. 화면 확인:
   - `/admin/picks` — 일자 요약 카드 그리드
   - `/admin/picks/d/2026-05-12` — 종목 카드 그리드
   - `/admin/picks/108490?tf=DAILY` — 차트 상세 + 핑크 컵-핸들 곡선

---

## 1. 데이터 cutoff (전일 기준 강제) ✅

`detect_picks.py:process_one` 의 모든 데이터 로딩(`get_latest_market_cap`, `load_ohlcv`, `load_yearly`, `load_monthly`)에 `data_cutoff = target_date - timedelta(days=1)` 강제 적용.

- `--date 2026-05-12` 호출 → 데이터는 5-11 까지만 사용 → 5-12 시초가부터 유효한 매수타점
- 장 마감 후 fetch 가 5-12 데이터를 DB에 넣어도 detect 는 자동으로 무시

운영 cron 가이드(`scripts/stocks/README.md`)도 새벽 5시 fetch + 5:30 detect 로 갱신.

## 2. fetch_daily 과거 날짜 재수집 패치 ✅

`fetch_one_day(target_date)` 가 `target_date != today` 인 경우 `fetch_backfill(target_date, target_date, resume=False)` 호출.

이전엔 resume=True (기본) 라 이미 row 있는 종목 스킵 → 과거 날짜 재수집 불가했음.

**5-11 데이터 정정 실행 완료** (장중에 잘못 들어간 종가/거래량을 정확한 값으로 덮어쓰기).
- 로보티즈 5-11 high: 348,500 → **394,000** (정정 후 정확)

## 3. detect_picks idempotent ✅

`run(target_date, ...)` 시작 시 동일 date의 기존 picks 모두 자동 삭제 (단일 종목 디버그 실행 시 제외):

```python
if not ticker_filter and not limit:
    sb.table("buy_picks").delete().eq("date", target_date.isoformat()).execute()
```

→ 동일 날짜 재실행 시 stale picks 절대 안 남음.

## 4. CUP_HANDLE 가드 — 교과서적 + 직전 고점 ✅

### Path 1 (연속 스윙) — `detect_cup_handle()` line 583~

| 가드 | 값 |
|---|---|
| 림 대칭 (절대값) | ±5% |
| **우림 ≤ 좌림** | strict (`if rcr.price > lcr.price: continue`) |
| 우림 ≥ 좌림 × 0.95 | 우림이 너무 낮으면 X |
| 컵 깊이 | 12~50% |
| 컵 기간 | DAILY 35~325 / WEEKLY 6~200 / MONTHLY 4~48 / YEARLY 2~6 |
| 핸들 깊이 | 3~15% & **≤ 컵 깊이 × 0.40** |
| 핸들 위치 | 우림의 85% 이상 |
| 거래량 패턴 | 핸들에서 감소 (vol_pattern_ok) |
| U자 비율 | 좌측 / 전체 ≥ 0.30 |
| 좌림 단봉 거부 | 직전 5봉 평균 종가 ≥ 좌림 × 0.75 (외바늘 좌림 거부) |

### Path 2 (구조적 fallback) — `detect_cup_handle()` line 688~

핵심 변경:
- 좌림 후보 필터: 우림 ≥ s.price ≥ 우림 × 1.05 (좌림이 무조건 같거나 더 높음)
- 후보 중 선택: **시간상 우림에 가장 가까운 (최근) high** ("직전 고점")
- 좌림~우림 사이에 좌·우림보다 3% 이상 높은 봉이 있으면 거부 (W자 등 다른 형태 컷)
- 핸들 위치 80% 이상 (Path 1보다 완화)
- base_score = 50 (Path 1 보다 정밀해서 +10)

### "이전 고점" 의미 (사용자 강조)

좌림은 시간상 너무 멀지 않은 직전 고점이어야. `cup_min` 35봉(약 1.5개월) 이전 ~ `cup_max` 325봉(약 1.3년) 이전 범위에서 우림에 시간상 가장 가까운 high 선택.

로보티즈 케이스: 좌림 2026-01-30, 우림 2026-04-27 → 57봉(2.7개월) 전 — 정석 컵 기간 안.

만약 cup_max 1.3년이 너무 길다고 느껴지면 (먼 시점의 고점이 좌림으로 잡힘) `_try_patterns` 의 `cup_params` DAILY 두 번째 값(325)을 줄이는 것 검토.

## 5. 도지 4종 완전 제거 ✅

`indicators.py classify_candle` + `CandleSignal` 삭제. `detect_picks.py` 캔들 점수(+5~15) 제거. UI 뱃지·"캔들 보조" Row 제거. `lib/buy-picks.ts CANDLE_LABELS / labelCandle` 제거.

DB `candle_confirm` 컬럼은 유지 (NULL로 저장됨). 이유: 점수 영향 미미 + 단일봉 분류는 노이즈 + 시각적 가치 없음.

## 6. 차트 UI 개선 (`components/admin/PickChart.tsx`) ✅

### 시각 요소
| 요소 | 상태 |
|---|---|
| 캔들 색 | 빨강(상승)/파랑(하락) — 한국 시장 관례 |
| **240일선** | **검정 굵은선 (lineWidth 3)** — 모든 timeframe 라벨 "240일선"으로 통일 |
| 매수타점 | 초록 점선, 라벨 "매수타점" |
| 손절가 | 주황 점선, 라벨 "손절가" |
| 컵-핸들 곡선 | **핑크(#ec4899) lineWidth 3** — Lagrange 2차 보간 (좌림→컵바닥→우림 U자) + 핸들 V dip + 회복선 (점선) |
| 스윙 마커 | 좌림/컵바닥/우림/핸들 화살표 |
| **역대 최고가 마커** | 차트 데이터 내 top 2 봉에 **금색 동그라미 + 가격**, 스윙 마커와 겹치는 봉은 제외 |
| 마지막 종가 자동선 | OFF (`priceLineVisible: false, lastValueVisible: false`) |
| Rim 라인 | 제거 (Entry와 거의 같은 위치라 중복) |
| **RSI(14)** | 별도 pane (index 1), 보라색 #8b5cf6, 30/70 가이드라인 |
| OHLC 툴팁 | hover 시 시·고·저·종·거래량 표시 (양봉 빨강/음봉 파랑 헤더) |

### 줌 (`TF_BARS_3Y/_1Y/_3M`)
- 우선순위: **3.5년 → 1년 → 3개월 → 전체**
- DAILY 875봉 / WEEKLY 182주 / MONTHLY 42개월 / YEARLY 4년
- 우측 여백: `rightOffset: 30` + `setVisibleLogicalRange to: len-1+30` → 우림(피벗) 라벨 잘림 방지
- 페이지 이동 후 자동줌 reset 방지: `lockVisibleTimeRangeOnResize: true` + 3중 적용 (동기 → rAF → setTimeout 100ms) + ResizeObserver 첫 발화 후 재적용

### 데이터 fetch 범위 (`TF_MONTHS`)
- DAILY 48개월 / WEEKLY 60개월 / MONTHLY 120개월 / YEARLY 120개월

### Swing date → timeframe 변환
`tfKey(swing.date)` 로 마커와 곡선이 동일 봉에 정렬됨. (이전엔 WEEKLY 차트에서 마커가 한 봉 빗나가는 버그 있었음)

## 7. 페이지 구조 개편 ✅

```
/admin/picks            ← L1: 일자별 요약 카드 (3-4열)
/admin/picks/d/{date}   ← L2: 그날 종목 카드 그리드 (3-4열)
/admin/picks/{ticker}   ← L3: 종목 차트 상세
```

라우트 충돌 회피: `[date]` 를 `d/[date]` 폴더로 (Next.js 가 같은 레벨에 두 동적 라우트 허용 X).

### admin 공용 nav (`components/admin/AdminNav.tsx`)
- 가로 탭 `[매수타점] [Analytics] [Posts]`, sticky 상단, 현재 페이지 강조
- `app/admin/layout.tsx`에 통합
- **analytics 페이지에서는 nav 숨김** (`HIDDEN_PATHS = ["/admin/analytics"]`)

### breadcrumb
- `/admin/picks/d/[date]` 헤더: `매수타점 / 2026-05-12`
- `/admin/picks/[ticker]` 헤더: `매수타점 / 2026-05-12 / 로보티즈`

### 일자 요약 카드 (`DaySummaryCard.tsx`)
- 최고점 / 종목수 / 평균 R/R
- TF 분포 (일/주/월/년 배지)
- 최고점 종목 미리보기

### 종목 카드 (`PickCard.tsx`)
- 헤더: TF 배지 + 시장 + 점수 (우측)
- 본문: 패턴 / 매수타점 / 현재가±% / 손절가 / R/R
- **점수 구간별 카드 색 강조**:
  - 90+: 금색 ring glow + amber 그라디언트
  - 85+: emerald 톤
  - 80+: teal 톤
  - <80: 기본 회색
- **대형주 도장**: 시총 ≥ 1조원 → 본문 우상단에 빨간 박스 "★ 1조+" (rotate-6)

### 종목 상세 시총 표시
- `KOSPI/KOSDAQ` 라벨 옆에 금색 배지 `시총 #87/1,500 · 5.3조`
- 시장 전체 기준 순위 (제외 종목 포함 = 실제 KOSPI/KOSDAQ 순위)

## 8. 추가 제외 종목 ✅

- **005690 파미셀** (KOSPI) — 줄기세포 바이오. 자동 추출 누락 → 수동으로 `excluded_tickers` 에 BIOPHARMA 등록. `stocks.is_excluded=true` 동기화.

남은 바이오/제약 누락 후보 152건 (false positive 4건 제외) 미적용 — **사용자 결정으로 일단 보류**. 키워드 매칭 결과는 `/tmp` 의 디버그 출력으로 확인 가능.

## 9. 운영 cron 변경 (제안)

`scripts/stocks/README.md` 갱신 — fetch+detect 를 새벽 5시로 변경. 이유: 매수타점이 어차피 전일 기준이라 장 마감 직후(16시)에 돌 필요 없음. 새벽이면 장 시작(9시) 전에 picks 준비 완료.

```cron
# 평일 KST 05:00 — 전일 일봉 + 시총 수집
0 5 * * 1-5  cd /home/ubuntu/straweb/scripts/stocks && python3 fetch_daily.py --date $(date -d 'yesterday' +\%Y-\%m-\%d) >> fetch.log 2>&1

# 평일 KST 05:30 — 패턴 탐지
30 5 * * 1-5 cd /home/ubuntu/straweb/scripts/stocks && python3 detect_picks.py >> detect.log 2>&1
```

> Oracle Cloud 서버는 아직 cron 변경 반영 안 됨. 다음 작업 시 SSH 접속해서 `crontab -e` 로 수정 필요.

## 10. 현재 5-12 결과

- 5-12 picks: 강화 가드 적용 후 마지막 detect 4차 결과 17건 → 파미셀 1건 삭제 후 **16건**
- 좌림 ≥ 우림 가드(최종) 적용 후 전체 스캔은 **미실행** (사용자가 로보티즈만 검증하라고 함)
- 로보티즈 단일 검증 OK: DAILY CUP_HANDLE score=80, R/R=2.3

## 11. 다음 작업 후보

### A. 좌림 ≥ 우림 가드 전체 스캔
```bash
python scripts/stocks/detect_picks.py --date 2026-05-12
```
→ 매칭 수 확인. 이전 17건에서 또 줄어들 가능성 (우림이 좌림보다 높은 케이스 컷).

### B. cup_max 단축 검토
DAILY 325봉(1.3년) 이 길다고 느껴지면 200~250봉(약 10개월~1년)으로 축소 검토.

### C. 바이오/제약 누락 추가 등록 (152건)
보류 중. 사용자 검토 후 결정. 키워드: 바이오/제약/백신/진단/항암/신약/제놈/유전자/셀트/파미/메디톡스/팜(시작·끝)/메디(시작) 등.

### D. /admin/picks 일자 요약 카드 첫 화면 풍부화 (선택)
sparkline mini-chart 등 추가 옵션 검토했었지만 현재 미적용. 사용자 결정 보류.

## 12. 변경 파일 요약

```
scripts/stocks/
  detect_picks.py       — cutoff -1일 / idempotent / CUP_HANDLE 가드 강화 / 좌림 ≥ 우림 / 도지 분류 호출 제거
  indicators.py         — classify_candle/CandleSignal 삭제
  fetch_daily.py        — fetch_one_day 과거 날짜 resume=False
  README.md             — cron 새벽 5시 가이드

app/admin/
  layout.tsx            — AdminNav 통합
  picks/page.tsx        — DaySummaryCard 그리드로 간소화
  picks/d/[date]/page.tsx       — NEW (종목 카드 그리드)
  picks/[ticker]/page.tsx       — breadcrumb, 시총 순위+금액, 도지 Row 제거, type 정정

components/admin/
  AdminNav.tsx          — NEW (공용 네비, analytics 숨김)
  DaySummaryCard.tsx    — NEW (일자 요약 카드)
  PickCard.tsx          — NEW (종목 카드, 점수 강조, 대형주 도장)
  PickChart.tsx         — 240일선 검정 / 매수타점·손절가 라벨 / RSI / OHLC 툴팁 / 컵-핸들 핑크 곡선 / 자동줌 강화 / 역대 최고가 마커
  DayCard.tsx           — labelCandle 사용 제거 (실제로는 거의 안 쓰임, 깔끔하게 정리 가능)

lib/buy-picks.ts        — CANDLE_LABELS/labelCandle 삭제, market_cap 필드 추가

admin-posts/
  buy-picks-patterns-snapshot-2026-05-12.md  — 5-12 오후 스냅샷
  buy-picks-system-progress-2026-05-12-evening.md  — 이 메모
```

## 13. DB 상태 (2026-05-12 22시 기준)

- 5-12 buy_picks: **16건** (4차 detect + 파미셀 수동 삭제)
- excluded_tickers: 180종 (179 + 파미셀)
- daily_ohlcv 마지막 날짜: 5-11 (5-12 데이터 미수집 — 의도된 상태)
- buy_picks_runs id 37 마지막 (DETECT, 4차 강화 가드 적용)

## 14. 주요 결정 사항 정리

| 결정 | 이유 |
|---|---|
| 데이터 cutoff = target_date - 1 | 매수타점은 항상 전일 종가 기준 (사용자 명시) |
| detect idempotent | 같은 날짜 재실행 시 stale 안 남게 |
| CUP_HANDLE 좌림 ≥ 우림 strict | 좌림이 무조건 같거나 더 높아야 정석 (사용자 정정) |
| Path 2 좌림 = 시간상 가장 가까운 high | "직전 고점" — 1년 전 같은 먼 시점 X |
| Handle/Cup 0.40 | 정석 1/3에서 약간 완화 (로보티즈 살리려) |
| U자 ratio 0.30 | 정석 0.35에서 약간 완화 (로보티즈 살리려) |
| 좌림 단봉 0.75 | 0.85 (정석)에서 완화 (로보티즈 외바늘 0.799라 0.85엔 탈락) |
| 도지 4종 제거 | 점수 영향 미미 + UI 노이즈 |
| 페이지 3계층 분리 | 정보 hierarchy 명확, URL 공유 가능 |
| 대형주 1조 기준 | 직관적 (1조 이상 = 보통 시총 상위 100위권) |
| analytics nav 숨김 | analytics 페이지에서 다른 admin 메뉴 노출 불필요 (사용자 요청) |
