# 선물 스캐너 (Futures Scanner) 설계

**날짜:** 2026-04-23  
**페이지:** `/crypto`  
**추가 API 비용:** 없음 (Binance Futures 공개 API, 키 불필요)

---

## 목표

Binance USDT 무기한 선물 시장에서 **4H 거래량 급증 + 펀딩비 양수 + OI 증가 + 저시총** 조건을 동시에 충족하는 코인을 자동 선별해 TOP 10으로 표시. "지금 뭔가 움직이는 저시총 코인"을 포착한다.

---

## 데이터 수집 전략

### 소스: Binance USDT Perpetual Futures (공개 API, 인증 불필요)

**Step 1 — 전체 티커 + 펀딩비 (각 1회 호출)**
```
GET https://fapi.binance.com/fapi/v1/ticker/24hr
GET https://fapi.binance.com/fapi/v1/premiumIndex
```
- USDT 쌍만 필터 (symbol endsWith "USDT")
- 펀딩비 > 0 코인만 추림

**Step 2 — CoinGecko 시총 매칭**
- 이미 수집 중인 `market.coins` (Top 250) 데이터에서 symbol 매칭
- 매칭 안 되는 코인 = 시총 보너스 0점 처리 (제외 아님)

**Step 3 — 4H 거래량 + OI 변화 (필터된 코인 N회 병렬 호출)**
```
GET https://fapi.binance.com/fapi/v1/klines?symbol=PEPEUSDT&interval=4h&limit=1
GET https://fapi.binance.com/futures/data/openInterestHist?symbol=PEPEUSDT&period=4h&limit=2
```
- 최대 병렬 10개씩 배치 처리 (rate limit 준수)
- OI 변화율 = (현재 OI - 4H 전 OI) / 4H 전 OI × 100

### 수집 시점
매시간 정각 기존 cron 스크립트(`generate-crypto-daily.mjs`)에 추가.

---

## 점수 알고리즘 (최대 100점)

```
score = volumeScore + fundingScore + oiScore + marketCapBonus
```

### 4H 거래량 순위 점수 (0–30점)
전체 필터된 코인 중 4H USD 거래량 순위 기준:
| 순위 | 점수 |
|------|------|
| 상위 10% | 30 |
| 상위 25% | 20 |
| 상위 50% | 10 |
| 하위 50% | 0 |

### 펀딩비 점수 (0–20점)
| 펀딩비 | 점수 |
|--------|------|
| > 0.01% | 20 |
| > 0.005% | 12 |
| > 0 (양수) | 5 |
| ≤ 0 | 수집 대상 제외 (필터) |

### OI 4H 변화율 점수 (0–30점)
| OI 증가율 | 점수 |
|-----------|------|
| > 20% | 30 |
| > 10% | 20 |
| > 5% | 10 |
| > 0% | 3 |
| ≤ 0% | 0 |

### 시총 보너스 (0–20점)
CoinGecko 시총 기준:
| 시총 | 점수 |
|------|------|
| < $50M | 20 |
| $50M – $100M | 10 |
| ≥ $100M | 0 |

---

## Supabase 저장 구조

`crypto_daily` 테이블의 `editorial` JSONB 컬럼에 `futures_scanner` 필드 추가:

```json
{
  "futures_scanner": [
    {
      "symbol": "PEPE",
      "fundingRate": 0.0023,
      "oiChangePct": 18.4,
      "volume4hUsd": 52000000,
      "volume4hRank": 8,
      "marketCapUsd": 38000000,
      "score": 82
    }
  ]
}
```

상위 50개만 저장 (score 순 정렬).

---

## UI 구조

### 위치
크립토 페이지에서 기존 "매수 후보 스크리너" 섹션 바로 아래.

### 레이아웃
```
[섹션 헤더] 선물 스캐너
[부제] Binance USDT Perp · 펀딩비 양수 · OI 증가 · 저시총 기준
[프리셋 탭] 종합 | 고펀딩비 | OI 급증 | 거래량 폭발

[코인 카드 × 10]
┌─────────────────────────────────────┐
│ #1  PEPE  PepeCoin          82점     │
│ ████████░░ ─────────────────────   │
│ 💰 펀딩비 +0.023%                    │
│ 📈 OI +18.4% (4H)                   │
│ ⚡ 4H 거래량 $52M  (상위 8%)         │
│ 🟢 시총 $38M                         │
└─────────────────────────────────────┘

[면책 고지]
```

### 프리셋 가중치
| 프리셋 | 거래량 배율 | 펀딩비 배율 | OI 배율 |
|--------|-----------|-----------|---------|
| 종합 | 1.0 | 1.0 | 1.0 |
| 고펀딩비 | 0.5 | 3.0 | 0.8 |
| OI 급증 | 0.5 | 0.8 | 3.0 |
| 거래량 폭발 | 3.0 | 0.5 | 0.5 |

시총 보너스는 모든 프리셋 동일.

---

## 컴포넌트 구조

### `scripts/generate-crypto-daily.mjs` 수정
- `fetchFuturesScanner()` 함수 추가
- Binance API 3단계 호출 로직
- 점수 계산 후 상위 50개 반환

### `lib/futuresScanner.ts`
- 타입 정의: `FuturesCoin`, `FuturesWeights`, `FuturesPresetKey`
- 프리셋 상수: `FUTURES_PRESETS`
- 클라이언트 재정렬 함수: `getTopFutures(data, weights, n)`

### `components/FuturesScannerSection.tsx`
- Client Component (프리셋 탭 상태)
- props: `data: FuturesCoin[]`
- TOP 10 카드 렌더링

### `app/crypto/page.tsx` 수정
- `FuturesScannerSection` import 및 `editorial.futures_scanner` 전달

---

## 제외 범위

- OKX 직접 연동 (geo-block 이슈, Binance로 대체)
- 숏 포지션 분석 (펀딩비 음수 코인)
- 알림 기능
- 차트
