---
title: 매수타점 시스템 v4 작업 노트 (2026-05-13)
date: 2026-05-13T22:00:00+09:00
description: 12일자 데이터 backfill·HILL_BREAKOUT 패턴 추가·3카테고리→2카테고리(gap 제거)·swing 한글화·차트 줌 일관성 수정 — 한 세션 작업 전체 정리
category: 운영
tags: [매수타점, 주식, 패턴, 차트, hill_breakout, supabase, python]
---

> 2026-05-13 한 세션에서 진행한 매수타점 시스템 v4 작업 전체 정리. 다음 세션에 이어서 작업할 수 있게 컨텍스트 보존.

---

## 1. 데이터 백필 (5/12 OHLCV·시총 누락 해결)

### 문제
- 5/13 차트에 5/12 봉이 안 보임 → Oracle 크론이 돌고있지 않아서 5/12 OHLCV 미수집
- 로컬에서 `fetch_daily.py --date 2026-05-12` 실행해 OHLCV 채움 (2,551 rows, 21분 소요)
- detect 돌렸더니 `[detect] reasons: NO_MARKET_CAP: 2371` → matches 0건!

### 원인
`scripts/stocks/fetch_daily.py`의 `--date YYYY-MM-DD` 모드는 `fetch_backfill()`로 라우팅되어 **market_cap 컬럼을 의도적으로 제외**(line 285 주석: "일일 fetch_one_day에서 채운 값 보존"). 그래서 5/12 row가 OHLCV만 들어가고 market_cap=null. detect의 `get_latest_market_cap()`은 `<= target_date` 최신 1건만 보고 null이면 None 반환 → 전 종목 Stage 0 fail.

### 해결
인접 정상 일자(5/11)에서 shares 계산해서 5/12 market_cap을 추정 backfill:
```js
shares = ref_row.market_cap / ref_row.close   // 5/11 기준
new_cap = round(shares * target_row.close)    // 5/12 close에 곱함
```
2,551건 backfill 후 detect 재실행 → matches 9건 정상 산출.

### 5/6·5/7·5/8 도 같은 문제 발견 → 동일 방식으로 backfill 완료

> **다음 세션 주의**: Oracle 크론 정상 가동되면 매일 `fetch_one_day()`가 KRX StockListing 통해 시총 포함 자동 갱신. 누락 일자 수동 backfill 시 `--date` 모드 + 시총 별도 patch 필요.

---

## 2. 사용자 매매 스타일 분석 (57건 5일치 데이터)

5/6~5/12 사용자 매수타점 57건을 detect의 패턴 로직과 매핑해 분석한 결과 **HILL_BREAKOUT (pivot point breakout)** 시그니처가 명확히 나옴.

### 분석 결과 (`scripts/stocks/analyze_user_picks_batch.py` 출력)
- **user_entry vs hill_price 분포**: median +0.0%, min -11.5%, max +13.3%
- **30+ 건이 hill ±2% 이내** (정확히 일치한 케이스 15+건)
- **240MA 이격 median +68%** — 시세 한참 진행한 종목들
- **거의 다 시총 1,000억↑ 보통주** — 소형 테마주 안 잡음

### 매매 스타일 요약
- O'Neil pivot point breakout 방식 — 직전 로컬 고점(hill_price)을 매수 트리거로 봄
- surge + ABC 미완 상태에서 추격 진입 (조정 완성 기다리지 않음)
- 예외: 화신·가온그룹(hill +12~13% 추격), 헥토파이낸셜·롯데에너지(hill -10%↓ 지지선 매매), 레이언스(년봉 DOWN → 시스템 외)

### 시스템에 안 잡히는 케이스
- R/R가 매우 낮은 마진 매수 (DB R/R 0.26, SK텔레콤 R/R 0.01) — base_score 20 + cap·trend 보너스로도 70점 못 닿음. 사용자도 마진 인지하고 매수.

분석 도구는 `scripts/stocks/analyze_user_picks_batch.py` 보존 — USER_PICKS dict에 일자별 (이름, entry, ticker) 배열 갈아끼우면 재실행 가능.

---

## 3. HILL_BREAKOUT 패턴 추가

### 패턴 정의 (`detect_hill_breakout()`, DAILY only)
```
조건:
- hill_price 존재 (compute_hill_price: 최근 30봉 중 현재봉 제외 max high)
- prev_close가 hill ±3% 이내 (돌파 임박)
- cycle.surged (호출자 측 게이팅)

매수타점/손절/목표:
- entry = hill_price (정확히 pivot)
- stop  = hill × 0.93 (O'Neil 7% rule)
- target = hill × 1.20 (O'Neil 첫 매도 +20%)
- R/R 고정 ≈ 2.86

base_score: 30
cycle penalty: ABC 미완(-10) 제외 (surge가 패턴 전제이므로)
```

### `_try_patterns` 와 흐름 (process_one)
1. `_try_patterns()` 시도 (CUP_HANDLE → TRIPLE_BOTTOM → DOUBLE_BOTTOM → 적삼병 → GAP_UP_SUPPORT)
2. **GAP_UP_SUPPORT가 매치되면 DAILY 한정 HILL_BREAKOUT 으로 업그레이드 시도** (없으면 GAP 자체 폐기 — match=None)
3. fallback: ABC complete면 `detect_abc_entry`, surge면 `detect_hill_breakout`

→ DB(2,235), SK텔레콤(102,600) 같은 hill exact 매수 케이스가 GAP에서 HILL_BREAKOUT match로 승급.

---

## 4. 카테고리 시스템 변경 (3 → 2)

### DB 마이그레이션 (이미 적용)
`supabase/migrations/20260513_buy_picks_kind.sql`:
```sql
alter table buy_picks add column if not exists kind text not null default 'match';
create index if not exists idx_buy_picks_kind on buy_picks(kind);
```

### 카테고리 정의
| kind | 조건 | 표시 |
|---|---|---|
| **match** | 점수 ≥ 70 + R/R ≥ 1.5 | ✅ 매수타점 |
| ~~gap_extended~~ | (제거됨) | — |
| **trend_extended** | surge + ABC 미완 + DAILY 패턴 없음 + 240MA이격 ≥ 40% + prev_close가 hill ±10% | 👀 워치 |

### gap_extended 제거 이유
- 처음에 GAP_UP_SUPPORT 패턴 매치 but R/R/score 컷 미달 케이스를 별도 카테고리로 보여줬으나
- 일자별 547건 노이즈 + **user 매매가 갭과 무관 (hill_breakout 기반)**
- HILL_BREAKOUT 패턴 추가로 user style 케이스는 match로 승급, 나머지 GAP은 폐기

### trend_extended 매수타점 = hill_price
- 기존: `entry_price = current_close` (참고가 의미)
- 변경: `entry_price = hill_price` — user 멘탈모델 일치 (서진시스템 71,700 등)
- PickCard 라벨도 "현재가 (참고)" → "매수타점 (hill)"

### 결과 (5/13 cutoff 5/12)
```
✅ match:           15  (HILL_BREAKOUT 6건 포함)
👀 trend_extended:  62  (240MA·hill 필터 적용)
─────────────────────────
총:                 77
```
이전 (gap_extended 카테고리 있을 때) 275건에서 **72% 감축**.

---

## 5. swing 라벨 한글화

`detect_picks.py` swing 생성 부분 + `components/admin/PickChart.tsx` swing 검색·라벨 동기화.

| 패턴 | 변경 전 | 변경 후 |
|---|---|---|
| DOUBLE_BOTTOM | LB / Neckline / RB | **1차 바닥 / 저항선 / 2차 바닥** |
| TRIPLE_BOTTOM | L1·P1·L2·P2·L3 | **1차 바닥·1차 피크·2차 바닥·2차 피크·3차 바닥** |
| INVERSE_HS | LS·P1·Head·P2·RS | **왼쪽 어깨·1차 피크·머리·2차 피크·오른쪽 어깨** (현재 비활성) |
| CUP_HANDLE | 좌림·컵바닥·우림·핸들 | (이미 한글, 변경 없음) |
| ELLIOTT_ABC_ENTRY | A저·B고·C저·시세고 | (이미 한글, 변경 없음) |
| 가격선 | "넥라인" | **"저항선"** |

기존 DB DOUBLE_BOTTOM 11건 패치 완료. TRIPLE/INVERSE는 DB row 없어서 no-op.

---

## 6. 차트 줌 일관성 수정 (PickChart.tsx)

### 문제
종목별로 줌 적용 결과가 다름 — 팬오션(WEEKLY) 우측 여백 ~16% / 삼성화재(DAILY) 우측 여백 ~25%. 사용자 expect는 팬오션처럼 일관된 ~13% 여백.

### 원인 (추정)
- `padding = 30 bars` 고정. DAILY 905 visible 중 30/905 = 3.3% 여백 / WEEKLY 212 visible 중 30/212 = 14.2% 여백 → **timeframe별로 시각적 비율 차이 큼**
- 추가로 `setLoading(false)` 직후 hidden→visible 전환 시 ResizeObserver race 가능성

### 수정 (PickChart.tsx)
1. **timeScale.rightOffset: 30 → 0** (setVisibleLogicalRange만으로 visible range 결정 — 이중 padding 방지)
2. **padding 동적 계산**: `padBars = max(10, round(zoomBars × 0.15))`
   - DAILY: 875 × 0.15 ≈ 131봉
   - WEEKLY: 182 × 0.15 ≈ 27봉
   - 모든 timeframe 마지막 봉 위치 ~87%, 우측 여백 ~13% 일관
3. **줌 재적용 4차**: sync / requestAnimationFrame / setTimeout 100ms / setTimeout 500ms
4. **ResizeObserver 콜백에 applyZoom() 추가** (lockVisibleTimeRangeOnResize 보조)

---

## 7. UI 구조 (`/admin/picks/d/[date]`)

### L2 페이지 (일자별 종목 카드)
- 매수타점·워치 2 섹션 세로 분리
- 헤더에 카운트: `매수 N · 워치 N`
- 섹션 헤더: `✅ 매수타점 (15)` / `👀 추세 진행 워치 (62)`

### L1 페이지 (일자별 요약 카드)
- 3 카운트 그리드: ✅ 매수 / 🟡 갭자리 (0 표시) / 👀 워치
- (gap_extended 제거됐지만 KIND_META에 정의는 남아있어 UI 호환)

### PickCard
- kind별 색상 강조:
  - match: 기존 점수 구간별 (금색·초록·청록·기본)
  - trend_extended: 회색 + 👀 워치 뱃지 + entry_price 파란색 ("매수타점 (hill)")

---

## 8. 메모리 업데이트

세션 인덱스 (`MEMORY.md`)에 2건 추가:
- `project_buy_picks_v4.md` — 시스템 구조 (현재 운영중)
- `user_trading_style.md` — 사용자 매매 스타일 (HILL_BREAKOUT pivot 중심)

기존 `project_fetch_daily_mcap_gotcha.md` 도 이전 세션에서 추가됨 (--date 모드 시총 누락 함정).

---

## 9. 임시 스크립트 정리

세션 중 작성한 9개 일회성 .mjs/.py 모두 삭제 완료. 보존된 분석 도구:
- `scripts/stocks/analyze_user_picks_batch.py` (재사용 가능, USER_PICKS dict만 갈아끼우면 됨)

---

## 10. 변경 파일 목록

```
M  scripts/stocks/detect_picks.py         (HILL_BREAKOUT·kind·240MA·hill 필터·라벨 한글화)
M  components/admin/PickChart.tsx         (줌 일관성·rightOffset·한글 swing 매칭)
M  components/admin/PickCard.tsx          (kind별 색상·"매수타점 (hill)" 라벨)
M  components/admin/DaySummaryCard.tsx    (3 카운트 그리드)
M  app/admin/picks/d/[date]/page.tsx      (2 섹션 세로 분리)
M  lib/buy-picks.ts                       (PickKind·KIND_META·BuyPick.kind)
+  supabase/migrations/20260513_buy_picks_kind.sql
+  scripts/stocks/analyze_user_picks_batch.py
+  admin-posts/buy-picks-v4-session-2026-05-13.md  (이 파일)
```

---

## 11. 다음 세션 To-Do

### 우선순위 높음
1. **차트 줌 검증** — 삼성화재·팬오션·KT·방림 등 여러 종목 비교해서 우측 여백 ~13% 일관 적용됐는지 확인
2. **Oracle Cloud 셋업 완료** — `~/straweb` pull + venv 설치 + crontab 등록 (작업 노트에 명령어 있음)
3. **git commit + push** — 이 세션 변경분 한 번에

### 우선순위 보통
4. **5/14 detect 수동 실행** (Oracle 가동 안 됐을 경우): `python detect_picks.py --date 2026-05-14`
5. **사용자 5/13 매수타점 추가 데이터** 받으면 분석 도구로 검증
6. **HILL_BREAKOUT 임계값 튜닝** — 현재 ±3%. 며칠 실전 돌려보고 너무 많이/적게 잡히면 조정 (analyze_user_picks_batch.py로 통계 확인 가능)

### 우선순위 낮음
7. **삼성화재(000810) HILL_BREAKOUT 못 잡힘 케이스 확인** — DB·SK텔레콤이 R/R<0.5라 score 70 못 닿음. 사용자도 마진 매수라 패스 가능
8. **KIND_META에 gap_extended 정의 정리** — 현재 lib/buy-picks.ts에 잔재
9. **다른 운영노트 (`buy-picks-patterns-snapshot-2026-05-13.md`)와 일관성 정리** — v3 → v4 차이 명시

---

## 12. 핵심 명령어 (오라클·로컬 공통)

### 로컬 (Windows) — Python 정확한 경로
```powershell
C:\Users\strag\AppData\Local\Programs\Python\Python313\python.exe scripts/stocks/detect_picks.py --date 2026-05-14
C:\Users\strag\AppData\Local\Programs\Python\Python313\python.exe scripts/stocks/fetch_daily.py
```

### 오라클 (셋업 후)
```bash
cd ~/straweb
git pull
~/straweb/.venv-stocks/bin/python scripts/stocks/fetch_daily.py
~/straweb/.venv-stocks/bin/python scripts/stocks/detect_picks.py --date $(date -u -d 'tomorrow' +%F)
```

### 사용자 매수타점 분석 (USER_PICKS dict 갈아끼우고 실행)
```powershell
C:\Users\strag\AppData\Local\Programs\Python\Python313\python.exe scripts/stocks/analyze_user_picks_batch.py
```
