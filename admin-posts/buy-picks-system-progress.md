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

## 완료 작업 (2026-05-11 C안)

### C안 — ABC 종결 → 5파 진입 ✅
- `detect_abc_entry(daily)` 추가. base_score=30.
  - 조건: cycle.surged=True + cycle.abc_complete=True + DAILY tf + `_try_patterns` 미매칭
  - zigzag high→low→high→low 4스윙, A/C저점 ±5%, 현재가 C저점 +15% 이내, 마지막봉 음봉 아님
  - entry=현재가, target=surge_high, stop=C저점×0.95
- `ELLIOTT_ABC_ENTRY` → `lib/buy-picks.ts` 라벨 "ABC 진입" 추가
- C안 스캔 결과: 아래 결과표 참고

## 미해결 / 다음 작업

### 안 할 것
- LG전자 "삼봉 모양" — 삼봉 = H&S top = 매도 신호. 매수타점 시스템에 불필요.
- "가운데 자리" — 너무 모호한 형태 묘사라 시스템화 어려움.

## 다른 PC에서 이어 작업하기

1. `git pull` (master 브랜치)
2. Python deps: `pip install -r scripts/stocks/requirements.txt`
3. `.env.local`은 다른 PC에 있어야 함 (Supabase URL + service role key)
   - `.env.local`이 UTF-8 BOM 형식이면 load_dotenv가 못 읽음 → `encoding='utf-8-sig'` 이미 적용됨
4. 검증: `python scripts/stocks/detect_picks.py --ticker 005930 --min-score 0` — 정상 동작 확인

## 주요 매칭 결과 (2026-05-11 A안 기준 13건)

| 순위 | TF | 종목 | 패턴 | 점수 | R/R |
|---|---|---|---|---|---|
| 1 | 주봉 | 삼성화재 (000810) | 역헤숄 | 90 | 5.4 |
| 2 | 일봉 | 삼성화재 (000810) | 쌍바닥 | 85 | 4.6 |
| 3 | 주봉 | 동부건설 (255440) | 역헤숄 | 80 | 10.2 |
| 4 | 월봉 | HLB (028300) | 역헤숄 | 78 | 12.1 |
| 5 | 주봉 | 코나아이 (052400) | 역헤숄 | 76 | 8.9 |
| 6 | 일봉 | 한국기업평가 (034950) | 쌍바닥 | 76 | 6.1 |
| 7 | 주봉 | 컴투스홀딩스 (028100) | 역헤숄 | 75 | 6.2 |
| 8 | 일봉 | 방림 (003610) | 쌍바닥 | 75 | 4.1 |
| 9 | 주봉 | HLB (028300) | 쌍바닥 | 73 | 10.7 |
| 10 | 일봉 | 우리금융지주 (316140) | 쌍바닥 | 70 | 3.8 |
| 11 | 일봉 | KT (030200) | 쌍바닥 | 70 | 3.4 |
| 12 | **일봉** | **케이피에프 (102120)** | **갭구간** | **70** | **17.9** |
| 13 | 일봉 | 024880 | 쌍바닥 | 70 | 3.4 |

## C안 스캔 결과 (2026-05-11, 938초)

**결과: 13건 (A안과 동일) — ELLIOTT_ABC_ENTRY 매칭 없음**

C안 패턴(ABC 종결 → 5파 진입)은 조건이 까다로움:
- Stage 2 통과 (시세 준 종목 + ABC 조정 완료) 동시 충족
- DAILY 타임프레임 한정
- 기존 패턴(_try_patterns) 미매칭인 종목에만 fallback 적용
- 현재가 C저점 +15% 이내 (아직 크게 안 오른 상태)
- R/R ≥ 1.5 + 점수 ≥ 70

2026-05-11 기준 해당 조건을 동시 만족하는 종목 없음.

---

## 완료 작업 (2026-05-12)

### D안 — 구조적 컵위드핸들 탐지 추가 ✅

**배경**: 사용자가 차트에서 직접 식별한 로보티즈(108490) 컵위드핸들이 자동 탐지에서 누락됨.
원인: `detect_cup_handle`이 연속 4스윙 [H,L,H,L]만 검사 → 5% 지그재그로 7년치 600+ 스윙이 생기면 최근 8개만 보고 종료.

#### 패턴 파라미터 수정
- `_try_patterns` DAILY `cup_max`: 250 → 325 (핸들 찾기 위한 충분한 윈도우)
- WEEKLY `cup_max`: 100 → 200, MONTHLY `cup_max`: 60 → 120 (긴 컵 허용)
- 컵 림 대칭 허용 오차: ±5% → ±20% (완화)
- 핸들 깊이 상한: ≤15% → ≤20% (완화)
- 핸들 위치 하한: ≥85% → ≥80% (완화)

#### 구조적 탐지 fallback (신규)
`detect_cup_handle` 함수 끝에 fallback 경로 추가:
- 연속 스윙 방식 실패 시 직접 극값 매핑
- **알고리즘**: R-rim(핸들 직전 고점) → 좌림(L-rim: cup window 내 최고 고점) → 컵바닥(L-rim~R-rim 사이 최저점)
- 핸들 조건 완화: 깊이 ≤20%, 위치 ≥80%
- `base_score=50` (연속 스윙보다 더 엄밀하게 검증하므로 동등 이상 부여)
- volume gate 제거 (핸들 구간이 짧아 노이즈 위험, meta에 vol_ok만 기록)

#### UI 개선
- 차트 기본 줌: TF별 ZOOM_BARS 절반으로 감소 (진입 시 더 확대된 뷰)
- Target 가격선 제거 (목표가는 체크리스트 텍스트로만 표시)
- 컵위드핸들 스윙 라벨 한국어화: L-rim→좌림, Cup Bottom→컵바닥, R-rim→우림(피벗), Handle→핸들
- 역헤숄(INVERSE_HS) 패턴 `_try_patterns`에서 제거 결정 (과탐지 우려)

#### 2026-05-12 스캔 결과 (단일 종목 검증)
- 로보티즈 (108490): 일봉+주봉 CUP_HANDLE 탐지 score=70, R/R=2.3
  - 좌림: 2026-01-30 364,000 / 컵바닥: 2026-03-04 201,000 / 우림: 2026-04-27 361,500 / 핸들: 2026-05-07 300,500
  - 림 대칭: 0.7% (매우 우수), 컵 깊이: 44.6%, 컵 기간: 57일봉

> **다음 작업**: 전체 스캔 실행 `python scripts/stocks/detect_picks.py --date 2026-05-12` (15분+)

## 현재 정책 (2026-05-12 업데이트)

| 필터 | 값 |
|---|---|
| 시총 하한 | 1,000억 |
| 엔터 / 게임 / 정치테마 / 세력주 / 바이오 | 제외 |
| 추세 (Stage 1) | y=UP 또는 FLAT + m=UP + 240MA 위 |
| "시세 준 종목" 정의 | 6개월 +80% / 12개월 +150% / 240MA 이격 +60% 중 하나 |
| ABC 미완 페널티 | -10점 |
| 저가주 필터 | 100원 미만 틱 제외 |
| 뚜껑 감점 | -30점 (주/월/년봉 한정) |
| R/R 하한 | 1.5 |
| 점수 하한 | 70 |
| 역헤숄 패턴 | **제거** (과탐지) |
| 컵위드핸들 구조적 탐지 | **신규** base_score=50 |

## 다른 PC에서 이어 작업하기 (2026-05-12)

1. `git pull` (master 브랜치)
2. `python scripts/stocks/detect_picks.py --date 2026-05-12` — 전체 스캔 (아직 안 돌림)
3. 결과 확인 후 `app/admin/picks/page.tsx` UI에서 로보티즈 카드 노출 여부 확인
