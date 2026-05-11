---
title: 매수타점 시스템 — 진행 현황 (2026-05-11)
date: 2026-05-11T18:00:00+09:00
description: 한국 주식 차트 패턴 자동 탐지 + 멀티 타임프레임 매수타점 산출 시스템. 다른 PC에서 이어 작업하기 위한 상태 메모.
category: 운영
tags: [매수타점, 주식, 패턴, 차트, supabase, python, fdr]
---

> 다른 PC에서 이어 작업하기 위한 **현재 상태 + 다음 작업 메모**.

## 빌드 완료 사항

### 1) DB 스키마 (Supabase, 마이그레이션 적용 완료)
- `supabase/migrations/20260511_buy_picks.sql` — 기본 5개 테이블 (stocks, daily_ohlcv, excluded_tickers, buy_picks, buy_picks_runs)
- `supabase/migrations/20260511_buy_picks_v2.sql` — `detection_meta` JSONB 컬럼 추가
- `supabase/migrations/20260511_buy_picks_v3_timeframe.sql` — `timeframe` 컬럼 + 새 unique 인덱스 `(date, ticker, pattern, timeframe)`
- `supabase/migrations/20260511_bio_exclusion.sql` — 바이오/제약/의료 162종 자동 추출 후 excluded 등록

### 2) 데이터 파이프라인 (Python, FinanceDataReader 기반)
- `scripts/stocks/fetch_daily.py`
  - `--sync-stocks` 종목 메타 동기화 (KOSPI+KOSDAQ 보통주 2,551종, KONEX/SPAC/ETF/우선주 제외)
  - 기본 실행 = 오늘 일봉 + 시가총액 갱신
  - `--backfill 10y` 초기 10년 백필 (현재 약 500만 row 저장됨)
  - 백필은 `market_cap` 컬럼 건드리지 않음 (일일 fetch 값 보존)
- `scripts/stocks/indicators.py`
  - ZigZag (swing high/low), ATR, SMA, RSI, 캔들 분류 (Dragonfly/Gravestone/Long-Legged/High Wave)
- `scripts/stocks/detect_picks.py`
  - Stage 0 (시총 1000억+제외리스트) → Stage 1 (년·월·일봉 우상향+240MA) → Stage 2 (시세 준 종목 ABC 검증)
  - 패턴: Cup&Handle / Inverse H&S / Triple Bottom (삼바닥) / Double Bottom (쌍바닥)
  - 캔들 보조 (Dragonfly Doji, High Wave 등) + 거래량 점수
  - **멀티 타임프레임**: DAILY / WEEKLY / MONTHLY / YEARLY 각각 resample 후 패턴 매칭
  - ZigZag 임계값 타임프레임별: 5% / 10% / 18% / 30%
  - 점수 70점+ 만 buy_picks에 저장
- `scripts/stocks/analyze_user_picks.py` — 특정 종목 리스트가 어느 stage에서 걸렸는지 디버깅용

### 3) UI
- `app/admin/picks/page.tsx` — 카드 그리드 (일자별 그룹). 카드마다 일/주/월/년 뱃지 (4색 구분).
- `app/admin/picks/[ticker]/page.tsx` — 종목 상세. `?tf=DAILY|WEEKLY|MONTHLY|YEARLY` 쿼리로 시간프레임 전환. 검증 체크리스트 자동 ✓✗.
- `app/api/admin/picks/[ticker]/ohlcv/route.ts` — 차트 데이터 API (max 180개월).
- `components/admin/PickChart.tsx` — `lightweight-charts` v5 캔들 + MA + 거래량 + Entry/Target/Stop 가격선 + 스윙 마커. 타임프레임별 자동 resample.
- `lib/buy-picks.ts` — Supabase 조회, 패턴/캔들/타임프레임 한글 라벨, 색상 매핑.

### 4) Cron 운영 가이드
- `scripts/stocks/README.md` — Oracle Cloud 배포 + cron 설정 명세 (16:00 fetch / 16:30 detect 평일).

## 현재 정책

| 필터 | 값 |
|---|---|
| 시총 하한 | 1,000억 |
| 엔터 / 게임 / 정치테마 / 세력주 / 바이오 | 제외 |
| 추세 (Stage 1) | y=UP 또는 FLAT + m=UP + 240MA 위 (2026-05-11 완화) |
| "시세 준 종목" 정의 | 6개월 +80% / 12개월 +150% / 240MA 이격 +60% 중 하나 |
| ABC 미완 페널티 | -10점 (2026-05-11 완화, 기존 -30) |
| 저가주 필터 | 100원 미만 틱 제외 (신규상장 오류 방지, 2026-05-11) |
| 뚜껑 감점 | -30점 (주/월/년봉 한정) |
| R/R 하한 | 1.5 |
| 점수 하한 | 70 |

## 완료 작업 (2026-05-11)

### B안 — 필터 완화 ✅
- `tc.passes`: y=FLAT+m=UP+240MA ABOVE 허용 → 결과는 동일 12건 (FLAT종목 패턴 미매칭)
- ABC 페널티: -30 → -10
- 저가주 버그픽스: low_6m/low_12m 계산 시 100원 미만 틱 제외
- `.env.local` BOM 버그 수정 (`load_dotenv encoding='utf-8-sig'`)

### A안 — 패턴 확장 ✅ (코드 완료, 스캔 결과 대기 중)
1. **적삼병 (THREE_WHITE_SOLDIERS)** — `detect_three_white_soldiers()` 추가. base_score=25.
2. **갭 구간 (GAP_UP_SUPPORT)** — `detect_gap_up_support()` 추가. base_score=20.
3. **뚜껑 감지 (lid_warning)** — `check_lid_warning()` 추가. 주/월/년봉 한정, 감점 -30, detection_meta에 `lid_warning: True` 저장.
4. **언덕 (hill_price)** — `compute_hill_price()` 추가. 최근 30봉 최고가, detection_meta에 `hill_price` 저장.
5. UI 뱃지: 뚜껑(빨강 ⚠), 언덕(주황) → 이전 세션에서 완료
6. `lib/buy-picks.ts` 라벨: THREE_WHITE_SOLDIERS→"적삼병", GAP_UP_SUPPORT→"갭 구간" 추가

## 미해결 / 다음 작업

### C안 (선택사항)
- **ABC 종결 → 5파 진입** — `_check_abc_complete` + 마지막 봉 양봉/도지 조건으로 별도 패턴 신호화. 사용자 표현: "abc 언덕".

### 안 할 것
- LG전자 "삼봉 모양" — 삼봉 = H&S top = 매도 신호. 매수타점 시스템에 불필요.
- "가운데 자리" — 너무 모호한 형태 묘사라 시스템화 어려움.

## 다른 PC에서 이어 작업하기

1. `git pull` (master 브랜치)
2. Python deps: `pip install -r scripts/stocks/requirements.txt`
3. `.env.local`은 다른 PC에 있어야 함 (Supabase URL + service role key)
   - `.env.local`이 UTF-8 BOM 형식이면 load_dotenv가 못 읽음 → `encoding='utf-8-sig'` 이미 적용됨
4. 검증: `python scripts/stocks/detect_picks.py --ticker 005930 --min-score 0` — 정상 동작 확인

## 주요 매칭 결과 (2026-05-11 기준 12건)

| 순위 | TF | 종목 | 패턴 | 점수 | R/R |
|---|---|---|---|---|---|
| 1 | 주봉 | 삼성화재 (000810) | 역헤숄 | 90 | 5.4 |
| 2 | 일봉 | 삼성화재 (000810) | 쌍바닥 | 85 | 4.6 |
| 3 | 주봉 | 동부건설 (255440) | 역헤숄 | 80 | 10.2 |
| 4 | 월봉 | HLB (028300) | 역헤숄 | 78 | 12.1 |
| 5 | 주봉 | 코나아이 (052400) | 역헤숄 | 76 | 8.9 |
| 6 | 일봉 | 한국기업평가 (034950) | 쌍바닥 | 76 | 6.1 |
| 7 | 일봉 | 방림 (003610) | 쌍바닥 | 75 | 4.1 |
| 8 | 주봉 | 컴투스홀딩스 (028100) | 역헤숄 | 75 | 6.2 |
| 9 | 주봉 | HLB (028300) | 쌍바닥 | 73 | 10.7 |
| 10~12 | 일봉 | 케이피에프, KT, 우리금융지주 | 쌍바닥 | 70 | 3.4~3.8 |
