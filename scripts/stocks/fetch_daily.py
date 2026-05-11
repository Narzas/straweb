"""
한국 주식 일봉/시가총액 수집 → Supabase
데이터 소스: FinanceDataReader (KRX 인증 불필요)

사용법:
  python fetch_daily.py                    # 오늘(또는 가장 최근 영업일) 데이터만
  python fetch_daily.py --date 2026-05-09  # 특정 날짜
  python fetch_daily.py --backfill 30d     # 최근 30일 (per-ticker)
  python fetch_daily.py --backfill 10y     # 10년 백필 (시간 오래 걸림)
  python fetch_daily.py --test             # 5종목 + 1주일만 (검증용)
  python fetch_daily.py --sync-stocks      # stocks 메타 테이블만 동기화

필터:
  - KOSPI / KOSDAQ / KOSDAQ GLOBAL 만 (KONEX 제외)
  - 보통주만 (우선주 / SPAC / ETF / ETN / 리츠 제외)
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import FinanceDataReader as fdr
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

BATCH_SIZE = 500
TEST_TICKERS = ["005930", "000660", "035720", "035420", "247540"]

# 우선주: 코드 마지막 자리가 K/L/M/N (영문) 또는 5/7
PREFERRED_SUFFIX_RE = re.compile(r"[KLMN57]$")
EXCLUDE_NAME_KEYWORDS = ("스팩", "SPAC", "ETF", "ETN", "리츠", "REIT")


def is_common_stock(code: str, name: str, market: str) -> bool:
    """보통주만 통과 (우선주/SPAC/ETF/ETN/리츠 제외)"""
    if market not in ("KOSPI", "KOSDAQ", "KOSDAQ GLOBAL"):
        return False
    if not code or len(code) != 6:
        return False
    # 우선주 코드: 마지막 자리가 0이 아닌 경우
    if not code.endswith("0"):
        return False
    if not name:
        return False
    upper_name = name.upper()
    for kw in EXCLUDE_NAME_KEYWORDS:
        if kw.upper() in upper_name:
            return False
    # 우 / 우B / 2우B 등 한국식 우선주 이름 패턴
    if re.search(r"우[A-Z]?$", name):
        return False
    return True


def normalize_market(m: str) -> str:
    """'KOSDAQ GLOBAL' → 'KOSDAQ'"""
    return "KOSDAQ" if m == "KOSDAQ GLOBAL" else m


def yyyymmdd(d: date) -> str:
    return d.strftime("%Y%m%d")


def parse_backfill(spec: str) -> int:
    m = re.match(r"^(\d+)([dmy])$", spec.lower())
    if not m:
        raise ValueError(f"Invalid backfill spec: {spec}")
    n, unit = int(m.group(1)), m.group(2)
    return {"d": n, "m": n * 30, "y": n * 365}[unit]


# ──────────────────────────────────────────────────────────
# stocks 메타 동기화 (FDR StockListing 사용)
# ──────────────────────────────────────────────────────────
def sync_stocks_list() -> int:
    print("[sync_stocks] fetching KRX listing via FDR")
    listing = fdr.StockListing("KRX")
    print(f"  total raw: {len(listing)}")

    rows = []
    for _, r in listing.iterrows():
        code = str(r.get("Code", "")).strip()
        name = str(r.get("Name", "")).strip()
        market = str(r.get("Market", "")).strip()
        if not is_common_stock(code, name, market):
            continue
        rows.append(
            {
                "ticker": code,
                "name": name,
                "market": normalize_market(market),
                # listed_at은 별도 API 없이 알 수 없음 — 우선 NULL, 추후 백필 보강
            }
        )

    print(f"  filtered common stocks: {len(rows)}")
    for i in range(0, len(rows), BATCH_SIZE):
        sb.table("stocks").upsert(rows[i : i + BATCH_SIZE], on_conflict="ticker").execute()

    return len(rows)


# ──────────────────────────────────────────────────────────
# 일봉 수집: 하루치 전 종목 (StockListing 한 번 호출로 다 옴)
# ──────────────────────────────────────────────────────────
def fetch_one_day(target_date: date) -> int:
    """KRX StockListing은 호출 시점의 최신 데이터만 줌.
    target_date가 오늘이 아니면 per-ticker 백필로 빠진다."""
    today = date.today()
    if target_date != today:
        return fetch_backfill(target_date, target_date)

    print(f"[fetch_one_day] {target_date} (latest snapshot)")
    listing = fdr.StockListing("KRX")
    if listing.empty:
        print("  WARN: empty listing")
        return 0

    rows = []
    iso = target_date.isoformat()
    for _, r in listing.iterrows():
        code = str(r.get("Code", "")).strip()
        name = str(r.get("Name", "")).strip()
        market = str(r.get("Market", "")).strip()
        if not is_common_stock(code, name, market):
            continue
        try:
            o = float(r["Open"])
            h = float(r["High"])
            low = float(r["Low"])
            c = float(r["Close"])
            v = int(r["Volume"])
            cap = float(r["Marcap"]) if pd.notna(r.get("Marcap")) else None
        except (KeyError, ValueError, TypeError):
            continue
        if c <= 0:
            continue
        rows.append(
            {
                "ticker": code,
                "date": iso,
                "open": o,
                "high": h,
                "low": low,
                "close": c,
                "volume": v,
                "market_cap": cap,
            }
        )

    print(f"  built {len(rows)} rows, upserting…")
    for i in tqdm(range(0, len(rows), BATCH_SIZE), desc="  upsert"):
        sb.table("daily_ohlcv").upsert(
            rows[i : i + BATCH_SIZE], on_conflict="ticker,date"
        ).execute()

    return len(rows)


# ──────────────────────────────────────────────────────────
# 일봉 수집: 종목별 기간 (백필용)
# ──────────────────────────────────────────────────────────
def get_tracked_tickers() -> list[tuple[str, str]]:
    """stocks 테이블에서 추적 대상(common stock) 코드 + 시장 반환 (페이지네이션)"""
    out: list[tuple[str, str]] = []
    offset = 0
    page_size = 1000
    while True:
        res = (
            sb.table("stocks")
            .select("ticker,market")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not res.data:
            break
        out.extend((r["ticker"], r["market"]) for r in res.data)
        if len(res.data) < page_size:
            break
        offset += page_size
    return out


def get_backfilled_tickers(min_rows: int = 2000) -> set[str]:
    """이미 충분한 일봉 데이터가 있는 종목 (리줌용)"""
    out: set[str] = set()
    offset = 0
    page_size = 1000
    while True:
        # Supabase RPC가 없어서 group by 직접 못함 → 클라이언트에서 카운트
        res = (
            sb.table("daily_ohlcv")
            .select("ticker")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not res.data:
            break
        for r in res.data:
            out.add(r["ticker"])
        if len(res.data) < page_size:
            break
        offset += page_size
    return out


def fetch_backfill(
    start: date, end: date, ticker_filter: list[str] | None = None, resume: bool = True
) -> int:
    print(f"[backfill] {start} -> {end}")

    if ticker_filter:
        tickers = ticker_filter
    else:
        tracked = get_tracked_tickers()
        if not tracked:
            print("  WARN: stocks 테이블이 비어있음. --sync-stocks 먼저 실행 필요")
            return 0
        tickers = [t for t, _ in tracked]

    print(f"  total tickers: {len(tickers)}")

    if resume and not ticker_filter:
        # 이미 데이터 있는 종목은 스킵 (단순 존재 여부만 체크)
        # 더 정교한 검증은 향후 보강
        from collections import Counter

        rows_per_ticker: Counter[str] = Counter()
        offset = 0
        page = 1000
        while True:
            r = (
                sb.table("daily_ohlcv")
                .select("ticker")
                .range(offset, offset + page - 1)
                .execute()
            )
            if not r.data:
                break
            for x in r.data:
                rows_per_ticker[x["ticker"]] += 1
            if len(r.data) < page:
                break
            offset += page

        completed = {t for t, c in rows_per_ticker.items() if c >= 2000}
        before = len(tickers)
        tickers = [t for t in tickers if t not in completed]
        print(f"  resume: {before - len(tickers)} already backfilled, {len(tickers)} remaining")
    total = 0
    buf = []

    for ticker in tqdm(tickers, desc="  fetch"):
        try:
            df = fdr.DataReader(ticker, start.isoformat(), end.isoformat())
            if df.empty:
                continue

            for idx, r in df.iterrows():
                try:
                    c = float(r["Close"])
                    if c <= 0:
                        continue
                    iso = idx.date().isoformat() if hasattr(idx, "date") else str(idx)[:10]
                    # market_cap 키는 의도적으로 제외 — 일일 fetch_one_day에서 채운 값 보존
                    buf.append(
                        {
                            "ticker": ticker,
                            "date": iso,
                            "open": float(r["Open"]),
                            "high": float(r["High"]),
                            "low": float(r["Low"]),
                            "close": c,
                            "volume": int(r["Volume"]),
                        }
                    )
                except (KeyError, ValueError, TypeError):
                    continue
        except Exception as e:
            print(f"  ! ticker {ticker} failed: {e}", file=sys.stderr)

        if len(buf) >= 5000:
            for i in range(0, len(buf), BATCH_SIZE):
                sb.table("daily_ohlcv").upsert(
                    buf[i : i + BATCH_SIZE], on_conflict="ticker,date"
                ).execute()
            total += len(buf)
            buf = []

        # 과한 요청 방지
        time.sleep(0.03)

    if buf:
        for i in range(0, len(buf), BATCH_SIZE):
            sb.table("daily_ohlcv").upsert(
                buf[i : i + BATCH_SIZE], on_conflict="ticker,date"
            ).execute()
        total += len(buf)

    return total


# ──────────────────────────────────────────────────────────
# 실행 로그
# ──────────────────────────────────────────────────────────
def log_run(stage: str, status: str, duration: int, **kw):
    payload = {
        "run_date": date.today().isoformat(),
        "stage": stage,
        "status": status,
        "duration_sec": duration,
        **kw,
    }
    try:
        sb.table("buy_picks_runs").insert(payload).execute()
    except Exception as e:
        print(f"  ! log_run failed: {e}", file=sys.stderr)


# ──────────────────────────────────────────────────────────
# main
# ──────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="YYYY-MM-DD")
    ap.add_argument("--backfill", help="e.g. '10y', '30d', '6m'")
    ap.add_argument("--test", action="store_true", help="5종목 + 7일")
    ap.add_argument("--sync-stocks", action="store_true", help="stocks 메타만 동기화")
    args = ap.parse_args()

    started = time.time()

    if args.sync_stocks:
        count = sync_stocks_list()
        dur = int(time.time() - started)
        log_run("SYNC_STOCKS", "OK", dur, fetched_count=count)
        print(f"[OK] synced {count} stocks in {dur}s")
        return

    if args.test:
        end = date.today()
        start = end - timedelta(days=10)
        count = fetch_backfill(start, end, ticker_filter=TEST_TICKERS)
        dur = int(time.time() - started)
        log_run("TEST", "OK", dur, fetched_count=count)
        print(f"[OK] test fetched {count} rows in {dur}s")
        return

    if args.backfill:
        days = parse_backfill(args.backfill)
        end = date.today()
        start = end - timedelta(days=days)
        count = fetch_backfill(start, end)
        dur = int(time.time() - started)
        log_run("BACKFILL", "OK", dur, fetched_count=count)
        print(f"[OK] backfilled {count} rows in {dur}s")
        return

    target = date.fromisoformat(args.date) if args.date else date.today()
    count = fetch_one_day(target)
    dur = int(time.time() - started)
    log_run("FETCH", "OK", dur, fetched_count=count)
    print(f"[OK] {target}: fetched {count} rows in {dur}s")


if __name__ == "__main__":
    main()
