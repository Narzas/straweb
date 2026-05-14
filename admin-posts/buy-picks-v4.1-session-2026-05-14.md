---
title: 매수타점 시스템 v4.1 작업 노트 (2026-05-14)
date: 2026-05-14T20:00:00+09:00
description: hill_price off-by-one 수정·HEAD_BREAKOUT(삼봉 머리돌파) 패턴 추가·쌍바닥/ABC 차트 강조·카드 UX 개선·ticker 스크롤 리셋 — 한 세션 작업 전체 정리
category: 운영
tags: [매수타점, 주식, 패턴, 차트, head_breakout, hill_price, supabase, python]
---

> 2026-05-14 한 세션 작업 전체 정리. v4 (5/13) 위에 점진 개선 + 신규 패턴 1개 추가. 집에서 이어서 작업할 수 있게 컨텍스트 보존.

---

## 1. compute_hill_price off-by-one 수정 (중요)

### 문제
사용자가 5/14 picks에서 현대위아 entry가 99,300 (5/12 고점) 으로 나온 걸 보고 "왜 5/13 고점 100,800 반영 안 됐냐?" 질문.

### 원인
`compute_hill_price(bars, n=30)` 가 `iloc[-(n+1):-1]` 로 **마지막 봉을 "현재봉"이라 보고 제외**.
- `bars` 는 `data_cutoff = target_date - 1` 까지 로드 → 5/14 picks의 마지막 봉 = 5/13 (어제 봉, 이미 완료)
- 그런데 코드는 5/13을 "현재봉"으로 취급해서 제외 → hill 은 5/12 까지만 봄

즉 "현재봉 제외" 의도는 "진행 중인 오늘 봉 제외"였는데, 우리 파이프라인엔 오늘 봉이 데이터에 없으니 어제 봉(완료된 봉) 이 부당하게 제외됨.

### 수정 (`detect_picks.py:363`)
```python
look = bars["high"].iloc[-n:]   # 마지막 봉(어제) 포함
```

### 영향
- 현대위아 5/14 entry: 99,300 → **100,800** (5/13 고점)
- 모든 HILL_BREAKOUT/TREND_EXTENDED hill_price 한 봉씩 최신화

---

## 2. ABC 날짜 메타 누락 → 5/14 재스캔

### 문제
포스코스틸리온(058430) 5/14 ELLIOTT_ABC 차트에 지그재그선·꼭지점 마커 안 보임.

### 원인
DB row의 `detection_meta` 에 `surge_high_date / a_low_date / b_high_date / c_low_date` 4개 필드 누락. ABC 날짜 필드는 commit `a49b8f5` (5/13 23:08 KST) 에 추가됐는데, 5/14 row 의 `generated_at` 은 commit 이후지만 어딘가 옛 코드로 도는 환경에서 생성된 것으로 추정 (오라클 미셋업 / 다른 환경).

### 해결
hill 수정과 함께 5/14 전체 재스캔 (851초/14분, 29건 = match 19 + trend 10). ABC 날짜 필드 정상 채워짐.

---

## 3. 쌍바닥·ABC 차트 강조 (사용자 요청 "선 진하게")

`components/admin/PickChart.tsx`:

| 패턴 | 변경 전 | 변경 후 |
|---|---|---|
| DOUBLE_BOTTOM W선 | `#a78bfa` 연보라, lineWidth 2 | **`#6d28d9` 짙은보라, lineWidth 3** |
| ELLIOTT_ABC 지그재그 | `#f97316` 주황, lineWidth 2 | **`#c2410c` 짙은주황, lineWidth 3** |

---

## 4. DOUBLE_BOTTOM·ABC 차트 1년 줌 강제

패턴 형성 구간이 수개월~1년 — 3년 줌이면 디테일 안 보임. `forceOneYear` flag 추가:
```tsx
const forceOneYear =
  pattern === "DOUBLE_BOTTOM" ||
  pattern === "HEAD_BREAKOUT" ||  // 5번 항목 참고
  pattern === "ELLIOTT_ABC_ENTRY";
if (forceOneYear && len >= bars1y) zoomBars = bars1y;
else if (len >= bars3y) zoomBars = bars3y;
...
```

---

## 5. HEAD_BREAKOUT 패턴 추가 (오늘 가장 큰 작업)

### 컨셉
사용자 정의: **"삼봉 = 헤드앤숄더 패턴일 때 Head 돌파 시 매수"**.
실패한 H&S Top → 강세 반전. 머리(역사적 고점)가 매물벽이었으므로 돌파하면 매물 정리됐다는 강력 신호.

### 패턴 정의 (`detect_head_breakout()`)
```
구조: high(LS) - low(V1) - high(Head) - low(V2) - high(RS)
조건:
- Head ≥ LS·RS 각각 +5% 이상
- LS / RS 대칭 ±5%
- 넥라인 (V1, V2) 거의 수평 ±5%
- prev_close ∈ Head ±3% (돌파 임박)
- 패턴 총 폭 ≥ 10봉

Entry: head_price
Stop:  head × 0.93 (O'Neil 7% rule)
Target: head × 1.20 (O'Neil 첫 매도 +20%)
R/R 고정 ≈ 2.86
base_score: 35 (HILL_BREAKOUT 30 보다 +5, 구조 검증 추가)
```

### 적용 타임프레임
**일/주/월봉만** (년봉은 봉 수 부족으로 제외 — `_try_patterns` 에서 tf 게이트).

### `_try_patterns` 우선순위
cup_handle → **head_breakout** → triple_bottom → double_bottom → 적삼병 → gap

→ cup이 매치되면 head 안 봄. head 매치되면 그게 우선. HILL_BREAKOUT 은 process_one fallback 에서 별도 호출되므로 영향 없음 (HEAD가 5점 구조 매칭이라 더 구체적, HILL 은 단순 30봉 max 돌파).

### 차트 시각화 (`PickChart.tsx`)
- **M자 지그재그선**: LS → V1 → Head → V2 → RS, `#be123c` 짙은 rose, lineWidth 3
- **넥라인 수평선**: V1·V2 평균
- **5개 swing 마커**: 기존 swings 자동 렌더링 (kind 기반 arrow 컬러)

### swing 라벨
왼쪽 어깨 · 1차 골 · 머리 · 2차 골 · 오른쪽 어깨

### labelPattern (`lib/buy-picks.ts`)
`HEAD_BREAKOUT: "삼봉 머리 돌파"`

### 5/14 재스캔 결과 (HEAD 포함 두 번째 재스캔, 918초)
| 패턴 | 건수 |
|---|---|
| TREND_EXTENDED | 10 |
| HILL_BREAKOUT | 9 |
| DOUBLE_BOTTOM | 8 |
| CUP_HANDLE | 1 |
| ELLIOTT_ABC_ENTRY | 1 |
| **HEAD_BREAKOUT** | **1** |
| **총** | **30** |

**HEAD_BREAKOUT 1건**: 093320 (DAILY)
- Head 124,000 / LS 109,000 / RS 108,600 (±0.4% 대칭)
- 전일종가 121,900 (Head -1.7%)
- score 73
- 거의 교과서적 H&S Top — 머리 +13.6%/+14.2%, Bulkowski median 10% 살짝 위 정상 범위

---

## 6. UI/UX 개선

### 6.1 "현재가" → "전일종가"
DB 의 `current_price` 는 `data_cutoff` (전일) 종가. "현재가" 라벨은 misleading → **"전일종가"** 로 정정.

### 6.2 카드 보더 전체 강조 (전일종가 vs 매수타점)
한국식 컬러:
- 전일종가 ≥ 매수타점 (diff ≥ 0) → `border-2 border-rose-500` (빨강)
- 전일종가 < 매수타점 → `border-2 border-blue-500` (파랑)
- diff 데이터 없으면 기존 accent.border 유지

0% 케이스 (5/14 에 3건: 005380·183300·058430):
- ELLIOTT_ABC: `entry = current_close` 가 설계상 의도된 동작
- HILL_BREAKOUT: 어제 close == high == 30봉 max 일치 (우연한 강한 상방 마감)
- 사용자 판단: 0% 도 rose 처리 (옵션 A 채택)

### 6.3 ticker 페이지 스크롤 리셋
종목 카드 클릭 시 새 페이지가 이전 스크롤 위치를 그대로 유지하는 문제. `components/admin/ScrollResetOnMount.tsx` 추가:
```tsx
"use client";
useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, []);
```
`app/admin/picks/[ticker]/page.tsx` 최상단에 삽입.

---

## 7. 사용자 매매 케이스 분석

### 7.1 테크윙(089030) — 사각지대 케이스
사용자 매수타점 64,200 (5/7 고점) 으로 돌파 시 매수 예약. 시스템이 못 잡는 이유:
- Stage 1 trend filter (월봉 UP) 미통과 (FLAT)
- 240MA 이격 24.8% < trend_extended 40% 게이트
- prev_close 5/13 57,300 vs hill 64,200 deviation 10.7% > HILL ±3% 게이트
- 6M 상승 +59% < surge 80% 임계

결론: **시스템 입장에선 시세 미진 + 월봉 추세 모호한 종목**. 사용자 매매 본진 (hill ±2%, 240MA +68% surged) 와 다른 outlier. 메모리 분석 57건 중 거의 없는 패턴이라 시스템 변경 안 함.

대안 (보류): 수동 워치리스트 페이지 신설 — ticker + pivot 등록하면 매일 prev_close 비교해 ±3% 임박 알림. detect 분리, 노이즈 0. outlier 더 쌓이면 검토.

### 7.2 삼봉(H&S Top) 검출 요구
처음엔 TRIPLE_BOTTOM(삼바닥) 과 혼동했으나 정정. 사용자가 원한 건 **H&S Top 머리 돌파 매수** → HEAD_BREAKOUT 추가 (5번 항목).

---

## 8. 변경 파일 목록

```
M  scripts/stocks/detect_picks.py
   - compute_hill_price: 마지막 봉 포함 (off-by-one 수정)
   - detect_head_breakout 함수 신규
   - _try_patterns: HEAD_BREAKOUT 우선순위 cup 다음, DAILY/WEEKLY/MONTHLY 만

M  components/admin/PickChart.tsx
   - DOUBLE_BOTTOM W선 / ABC 지그재그선 색·두께 강화
   - HEAD_BREAKOUT 분기 추가 (M자선·넥라인)
   - forceOneYear 에 HEAD_BREAKOUT·DOUBLE_BOTTOM·ABC 모두 포함

M  components/admin/PickCard.tsx
   - '현재가' → '전일종가' 라벨
   - diffBorder (rose/blue 전체 보더)

M  app/admin/picks/[ticker]/page.tsx
   - ScrollResetOnMount 컴포넌트 임포트·삽입

+  components/admin/ScrollResetOnMount.tsx  (신규)
   - 마운트 시 window.scrollTo(0,0) 1회

M  lib/buy-picks.ts
   - PATTERN_LABELS 에 HEAD_BREAKOUT 추가

+  admin-posts/buy-picks-v4.1-session-2026-05-14.md  (이 파일)
```

---

## 9. 커밋 / 푸시

```
7f2f97a fix: hill_price off-by-one + 쌍바닥·ABC 차트 개선 + 카드 UX
06a6b47 feat: HEAD_BREAKOUT 패턴 추가 — 삼봉(H&S Top) 머리 돌파 매수
```

둘 다 master 푸시 완료. Vercel 자동 배포.

---

## 10. 다음 세션 To-Do (5/15 이후)

### 우선순위 높음
1. **Oracle Cloud 셋업 완료** (v4 노트에서 이월) — `~/straweb` pull + venv + crontab. 메모리 `project_oracle_cloud_cron.md` 참고. 셋업 안 되면 매일 수동 detect 14~15분 소요.
2. **5/15 detect 수동 실행** (Oracle 미가동 시):
   ```powershell
   C:\Users\strag\AppData\Local\Programs\Python\Python313\python.exe scripts/stocks/detect_picks.py --date 2026-05-15
   ```
3. **HEAD_BREAKOUT 신규 종목 모니터링** — 5/15·5/16 detect 돌고 잡히는 종목 케이스 누적. 1~2주 데이터 쌓이면 패턴 빈도 / false positive 율 파악.

### 우선순위 보통
4. **HEAD_BREAKOUT 보강 검토** (데이터 6개월 후) — 옵션:
   - 거래량 패턴 체크 (LS > Head > RS) — 교과서 핵심 조건. false positive 큰 감소 가능.
   - 시간 대칭 (LS-Head 기간 ≈ Head-RS) — 모양 안정
   - 사전 상승 추세 (LS 전 30봉 +10%↑) — 반전 위치 확인
   - 패턴 최소 기간 8주(40봉)로 강화
5. **사용자 5/13~5/14 매수 데이터 분석** — `analyze_user_picks_batch.py` USER_PICKS dict 갈아끼우고 재실행. hill fix 후 매칭률 검증.
6. **HILL_BREAKOUT ±3% 임계값 튜닝** — 5/15 ~ 5/20 데이터 쌓이면 통계 기반 조정.

### 우선순위 낮음
7. **수동 워치리스트** (테크윙류 outlier) — 별도 페이지 + DB 테이블 신설. 정말 필요할 때만.
8. **디자인 개선** (`memory/project_next_design.md`) — 라이트모드 오프화이트 + 카드 shadow / Bento 홈.
9. **운영노트 일관성** — v4 / v4.1 차이 한눈에 정리. (필요 시)

---

## 11. 메모리 업데이트 필요 사항

이 세션에서 메모리 업데이트할 항목:
- `project_buy_picks_v4.md` → HEAD_BREAKOUT 패턴 정보 추가 (또는 새 항목)
- `project_fetch_daily_mcap_gotcha.md` 는 그대로 (관련 변경 없음)
- 새 학습: 사용자가 차트 강조선 색 짙은 것 선호 (#6d28d9, #c2410c, #be123c)

---

## 12. 핵심 명령어

### 로컬 (Windows) — Python 정확한 경로
```powershell
# 매수타점 detect
C:\Users\strag\AppData\Local\Programs\Python\Python313\python.exe scripts/stocks/detect_picks.py --date 2026-05-15

# 단일 종목 디버그
C:\Users\strag\AppData\Local\Programs\Python\Python313\python.exe scripts/stocks/detect_picks.py --date 2026-05-15 --ticker 011210

# OHLCV 일일 fetch
C:\Users\strag\AppData\Local\Programs\Python\Python313\python.exe scripts/stocks/fetch_daily.py

# 사용자 매매 분석
C:\Users\strag\AppData\Local\Programs\Python\Python313\python.exe scripts/stocks/analyze_user_picks_batch.py
```

### 오라클 (셋업 후)
```bash
cd ~/straweb && git pull
~/straweb/.venv-stocks/bin/python scripts/stocks/fetch_daily.py
~/straweb/.venv-stocks/bin/python scripts/stocks/detect_picks.py --date $(date -u -d 'tomorrow' +%F)
```

---

## 13. 핵심 결정 사항 (집에서 이어가기 좋게)

- **HEAD_BREAKOUT 상한 추가 안 함** — 머리 13~14% 정상 범위, 표본 N=1 상태에서 게이트 추가는 premature optimization. 6개월 후 통계 기반 결정.
- **테크윙류 outlier 시스템 추가 안 함** — 본진 매매와 다른 outlier, 노이즈만 늘림. 필요 시 수동 워치리스트로 분리.
- **0% diff = rose 처리** — ABC 설계 의도 + HILL 우연 케이스 둘 다 양수 취급.
- **HEAD_BREAKOUT 우선순위** — cup 다음, triple 전. cup 매치되면 head 안 봄.
- **DAILY/WEEKLY/MONTHLY 만** — 년봉 swing 부족.
