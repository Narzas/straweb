---
title: 매수타점 시스템 — 패턴·가드 스냅샷 (2026-05-13)
date: 2026-05-13T01:00:00+09:00
description: 현재 detect_picks.py 에 적용된 패턴 / 점수 / 가드 / 필터 정리. 운영 기준 스냅샷.
category: 운영
tags: [매수타점, 주식, 패턴, 차트, supabase, python]
---

> 2026-05-13 기준 시스템 상태 정리. 2026-05-12 스냅샷 대비 변경 사항은 ⚡ 표시.

## 2026-05-13 주요 변경

| 항목 | 이전 | 변경 후 |
|---|---|---|
| CUP_HANDLE 매수타점 계산 | `우림 * 1.002` | `max(좌림, 우림)` ← O'Neil 기준 ⚡ |
| DOUBLE_BOTTOM 매수타점 | `neckline * 1.002` | `neckline` (정수) ⚡ |
| TRIPLE_BOTTOM 매수타점 | `neckline * 1.002` | `neckline` (정수) ⚡ |
| 전체 entry_price | `round(x, 2)` (소수점) | `round(x)` (정수) ⚡ |
| Meta 스윙 레이블 | `"우림(피벗)"` | `"우림"` ⚡ |
| 차트 Y축 | 소수점 2자리 | 정수 (RSI만 소수 1자리 유지) ⚡ |

### O'Neil 매수타점 원칙

William O'Neil 기준: **매수타점 = 실제 저항선 돌파점**

- CUP_HANDLE: `pivot = max(좌림.price, 우림.price)` → `entry = pivot`
  - 좌림·우림 중 더 높은 쪽이 실제 저항 → 그 가격 돌파 시 매수
- DOUBLE_BOTTOM: `entry = neckline.price` (넥라인 돌파 기준)
- TRIPLE_BOTTOM: `entry = neckline` (동일)
- 1.002 multiplier 완전 제거 → 정확한 저항선 가격, 틱 단위 정수

### 한국 주식 틱 규모별 단위

| 가격대 | 틱 단위 |
|---|---|
| 1,000원 미만 | 1원 |
| 1,000~5,000원 | 5원 |
| 5,000~10,000원 | 10원 |
| 10,000~50,000원 | 50원 |
| 50,000~100,000원 | 100원 |
| 100,000~500,000원 | 500원 |
| 500,000원↑ | 1,000원 |

방림(003610) entry 5,660원 → 5,000~10,000원 구간 → 10원 단위 → 정상.

---

## 2026-05-13 스캔 결과 (9종목)

실행: `python detect_picks.py --date 2026-05-13` (약 949초)

| 종목코드 | 종목명 | 패턴 | 점수 | 매수타점 | R/R |
|---|---|---|---|---|---|
| 009540 | HD한국조선해양 | CUP_HANDLE | 82 | 494,500 | 2.3 |
| 000810 | 삼성화재 | DOUBLE_BOTTOM | 80 | 515,000 | 4.6 |
| 089470 | HDC현대EP | CUP_HANDLE | 79 | 6,070 | 1.7 |
| 071050 | 한국금융지주 | CUP_HANDLE | 77 | 300,500 | 2.2 |
| 071050 | 한국금융지주 | CUP_HANDLE | 77 | 300,500 | 2.2 (WEEKLY) |
| 034950 | 한국기업평가 | DOUBLE_BOTTOM | 76 | 115,000 | 6.1 |
| 316140 | 우리금융지주 | DOUBLE_BOTTOM | 75 | 36,250 | 3.8 |
| 010690 | 화신 | CUP_HANDLE | 75 | 13,550 | 1.8 |
| 003610 | 방림 | DOUBLE_BOTTOM | 75 | 5,660 | 4.1 |

---

## `_try_patterns` 활성 패턴 (실행 순서대로)

| 순서 | 패턴 | base_score | 비고 |
|---|---|---|---|
| 1 | **CUP_HANDLE** | 40 (연속 스윙) / **50** (구조적 fallback) | 교과서적 가드 적용 |
| 2 | **TRIPLE_BOTTOM** | 38 | 3저점 패턴 (삼바닥) |
| 3 | **DOUBLE_BOTTOM** | 35 | 2저점 패턴 (쌍바닥) |
| 4 | **THREE_WHITE_SOLDIERS** | 25 | 적삼병 (3연속 양봉) |
| 5 | **GAP_UP_SUPPORT** | 20 | 갭 구간 지지 |

## Fallback 패턴

| 패턴 | base_score | 조건 |
|---|---|---|
| **ELLIOTT_ABC_ENTRY** | 30 | DAILY only · cycle.surged + abc_complete · `_try_patterns` 미매칭 시 |

## 비활성 (코드는 있지만 사용 안 됨)

| 패턴 | 비고 |
|---|---|
| INVERSE_HS | base_score 40 — 과탐지로 `_try_patterns` 에서 제거 (2026-05-12 D안 작업 결정) |

---

## CUP_HANDLE 가드 (교과서적 기준)

| 가드 | 값 |
|---|---|
| 림 대칭 | ±5% (좌림이 우림보다 5%↑ 높으면 X) |
| Path 2 좌림 선택 | 우림과 가격 가장 가까운 high (이전: "가장 비싼" 으로 잘못 선택되던 버그 정정) |
| Cup 깊이 | 12~50% |
| Cup 기간 | DAILY 35~325 / WEEKLY 6~200 / MONTHLY 4~48 / YEARLY 2~6 |
| Handle 깊이 | 3~15% & **≤ Cup 깊이 × 0.40** |
| Handle 위치 | 우림의 80%↑ (Path 2) / 85%↑ (Path 1) |
| U자 비율 | 좌측 / 전체 ≥ 0.30 (V자 컷) |
| 좌림 단봉 거부 | 직전 5봉 평균 종가 ≥ 좌림 × 0.75 (외바늘 좌림 배제) |

---

## 보조 검증 (점수 보정)

| 항목 | 효과 |
|---|---|
| **뚜껑 감지 (`check_lid_warning`)** | **−30점** (주/월/년봉 한정) |
| 언덕 (`compute_hill_price`) | 표시만 (점수 영향 X) |
| ABC 미완 (cycle.surged + !abc_complete) | −10점 |

## 점수 구성

```
base_score (20~50)
  + volume     (0~15)
  + trend      (0~15)   # 년봉 UP +7, 월봉 UP +5, 240MA 위 +3
  + R/R        (0~10)
  + market_cap (0~5)
  − 뚜껑       (−30)
  − ABC 미완   (−10)
= 컷오프 70점
```

---

## Stage 필터

| Stage | 조건 |
|---|---|
| **0** | 시총 ≥ 1,000억 + `excluded_tickers` 통과 (현재 179종 제외 — 엔터/게임/정치/세력주/바이오) |
| **1** | 년봉 UP 또는 FLAT + 월봉 UP + 240MA 위 |
| **2** | "시세 준 종목"이면 ABC 조정 완성 검증 (6M+80% / 12M+150% / 240MA이격+60%) |

---

## 차트 UI (`/admin/picks` 페이지)

| 요소 | 상태 |
|---|---|
| 컵-핸들 곡선 | **핑크 (#ec4899)** 보간 곡선 — Lagrange 2차 (좌림→컵바닥→우림 U자) + 핸들 V dip + 회복선(점선) |
| 240일선 | **검정 굵은선**, 모든 timeframe 라벨 "240일선" 으로 통일 |
| Entry / Stop | "매수타점" / "손절가" (한국어 라벨) |
| RSI(14) | 별도 pane, 보라색, 30/70 가이드라인 |
| OHLC 툴팁 | hover 시 시·고·저·종·거래량 표시 |
| 역대 최고가 마커 | 차트 데이터 내 top 2 봉에 금색 동그라미 + 가격 |
| 줌 | 3.5년 → 1년 → 3개월 → 전체 순으로 자동 선택 + 우측 30봉 여백 |
| 마지막 종가 자동 가로선 | OFF |
| 캔들 색 | 빨강(상승) / 파랑(하락) — 한국시장 관례 |
| **Y축 가격** | **정수 표시** (`Math.round(price).toLocaleString("ko-KR")`) ⚡ |
| **Y축 RSI** | **소수 1자리** (`price.toFixed(1)`) — price < 200 구분 ⚡ |

---

## URL / 페이지 구조

```
/admin/picks            ← L1: 일자별 요약 카드 (3-4열)
/admin/picks/d/{date}   ← L2: 그날의 종목 카드 그리드 (3-4열)
/admin/picks/{ticker}   ← L3: 종목 차트 상세
```

- admin 공용 nav: `[매수타점] [Analytics] [Posts]` (analytics 페이지에서는 숨김)
- 종목 카드 점수 구간별 강조: 90+ 금색 ring / 85+ 진한 초록 / 80+ 청록 / <80 기본

---

## 데이터 cutoff (전일 강제)

`--date YYYY-MM-DD` 는 "picks 가 저장될 날짜" 의미.
실제 패턴 탐지에 사용되는 OHLCV/시총 데이터는 자동으로 `target_date − 1` 까지로 cutoff.
→ 매수타점은 항상 **어제 종가까지의 정보로 산출 → 오늘 시초가부터 유효**.

## detect 재실행 idempotent

`detect_picks.py` 시작 시 동일 date 의 기존 picks 자동 삭제 (단일 종목 디버그 실행 시 제외).
→ stale picks 남지 않음.

---

## Python 실행 환경

```powershell
# 올바른 실행법 (numpy 등 패키지 있는 인터프리터)
C:\Users\튼튼이\AppData\Local\Programs\Python\Python312\python.exe detect_picks.py --date YYYY-MM-DD

# 단일 종목 검증 (수 초)
C:\Users\튼튼이\AppData\Local\Programs\Python\Python312\python.exe detect_picks.py --date YYYY-MM-DD --ticker 009540

# .venv 는 numpy 없음 → 사용 금지
```

## 시가총액 순위

종목 상세 페이지에서 KOSPI/KOSDAQ 라벨 옆에 `시총 #N/총종목수` 표시.
가장 최근 `daily_ohlcv.market_cap` 기준 시장 전체 순위 (제외 종목 포함).
