# 매수타점 시스템

한국 주식 차트 패턴 기반 자동 매수타점 탐지 → `/admin/picks` 카드 UI.

## 구성

```
fetch_daily.py     — FDR로 일봉/시총 수집 (장 마감 후)
indicators.py      — ZigZag, ATR, SMA, RSI, 캔들 분류
detect_picks.py    — 필터 + 패턴 매칭 + 점수화 + Supabase 저장
requirements.txt   — Python deps
```

## 일일 운영 cron (Oracle Cloud Ubuntu)

매수타점이 **전일 종가 기준**이라 새벽 시간대에 돌려도 충분 — 오히려 장 시작(09:00) 전에 picks 가 준비되어 있어야 운용 가능.

```cron
# 평일 KST 05:00 — 전일 일봉 + 시총 수집 (전일 데이터는 익일 오전엔 확정됨)
0 5 * * 1-5  cd /home/ubuntu/straweb/scripts/stocks && python3 fetch_daily.py --date $(date -d 'yesterday' +\%Y-\%m-\%d) >> fetch.log 2>&1

# 평일 KST 05:30 — 패턴 탐지 + 매수타점 저장 (오늘 자 picks 생성, 데이터는 전일까지)
30 5 * * 1-5 cd /home/ubuntu/straweb/scripts/stocks && python3 detect_picks.py >> detect.log 2>&1
```

> ⚠️ **매수타점 = 전일 종가 기준 강제**
> `detect_picks.py` 는 `--date YYYY-MM-DD` 인자를 "**picks 가 저장될 날짜**"로 해석한다.
> 실제 OHLCV/시총 데이터 cutoff 는 코드에서 자동으로 `target_date - 1` 로 강제됨 (`process_one` 참조).
> 즉 인자 없이 호출하면 `target_date = date.today()` → 데이터는 **전일까지만** 사용 → 오늘 시초가부터 유효한 picks 가 산출됨.

> 💡 **왜 16:00 cron 이 아니라 새벽 05:00 cron 인가?**
> 같은 날 장 마감 직후(16:00) 에 fetch + detect 를 돌리면 picks 는 다음 영업일에 노출될 때 이미 신선도가 떨어짐.
> 또 fetch 가 장중에 실수로 돌면 잘못된 가격이 박힐 위험이 있는데, 새벽 시간대엔 KRX 데이터가 완전히 확정된 상태라 그럴 일이 없음.

`.env.local`을 같은 위치에 두거나, 환경 변수로 다음을 노출:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 명령 모음

```bash
# 백필 (최초 1회 — 10년치, ~30분~1시간)
python fetch_daily.py --backfill 10y

# 일일 수집 (오늘만)
python fetch_daily.py

# 특정 일자 수집
python fetch_daily.py --date 2026-05-09

# 종목 메타 동기화 (분기마다, 신규 상장/상폐 반영)
python fetch_daily.py --sync-stocks

# 패턴 탐지 — 오늘 기준
python detect_picks.py

# 단일 종목 디버그
python detect_picks.py --ticker 005930 --min-score 0

# 처음 N종목만 (검증용)
python detect_picks.py --limit 100
```

## 파이프라인 단계

| 단계 | 내용 |
|---|---|
| Stage 0 | 시총 ≥ 1,000억 + `excluded_tickers` 통과 |
| Stage 1 | 년봉 우상향 + 월봉 우상향 + 240일선 위 |
| Stage 2 | "시세 준 종목"이면 ABC 조정 완성 확인 (옵션 C: 6M+80% / 12M+150% / 240MA이격+60%) |
| Pattern | Inverse H&S, Double Bottom (TODO: Cup with Handle, Elliott) |
| Candle | Dragonfly Doji / High Wave / Long-Legged Doji 보조 |
| Score | 패턴(40) + 캔들(15) + 거래량(15) + 추세(15) + R/R(10) + 시총(5) − 페널티 |
| Threshold | 70점 이상만 `buy_picks` 저장 |

## 데이터 흐름

```
FinanceDataReader (StockListing + DataReader)
        │
        ▼
Supabase
  · stocks (2551 종목 메타)
  · daily_ohlcv (10년 일봉, ~500만 row)
  · excluded_tickers (수동 + 자동 분류 — 엔터/게임/정치)
  · buy_picks (탐지 결과, 매일 추가)
  · buy_picks_runs (cron 실행 로그)
        │
        ▼
Next.js  app/admin/picks  (카드 UI)
```

## 제외 종목 추가/수정

`excluded_tickers` 테이블에 직접 INSERT, 또는 마이그레이션 SQL에 추가.

```sql
insert into excluded_tickers (ticker, category, reason) values
  ('XXXXXX', 'POLITICAL', '정치테마 — 2026년 ○○○ 후보 관련주')
on conflict (ticker) do nothing;
```

카테고리: `ENTERTAINMENT` | `GAME` | `POLITICAL` | `MANIPULATION`
