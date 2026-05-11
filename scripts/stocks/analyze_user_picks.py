"""사용자가 발견한 종목들이 왜 우리 detect에 안 잡혔는지 단계별 분석.

usage:
  python analyze_user_picks.py
"""
from __future__ import annotations

import os
import sys
import io
from datetime import date
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
from dotenv import load_dotenv
load_dotenv(ROOT / ".env.local")

from supabase import create_client
sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

sys.path.insert(0, str(Path(__file__).parent))
from detect_picks import (
    TIMEFRAMES,
    resample_ohlcv,
    load_ohlcv,
    load_yearly,
    load_monthly,
    get_latest_market_cap,
    load_excluded_tickers,
    passes_stage0,
    check_trend,
    check_cycle,
    detect_cup_handle,
    detect_inverse_hs,
    detect_triple_bottom,
    detect_double_bottom,
    _try_patterns,
    MIN_MARKET_CAP,
)

# 사용자 종목 — (이름, 메모)
USER_PICKS = [
    ("대한항공", "27,900 (갭 구간)"),
    ("한일시멘트", "21,900"),
    ("에이엘티", "26,750 (가운데 자리)"),
    ("이엔에프테크놀로지", "62,000~64,000"),
    ("LS에코에너지", "94,300"),
    ("한솔케미칼", "346,500"),
    ("헥토파이낸셜", "34,950~39,177"),
    ("파인엠텍", "11,990"),
    ("SKC", "187,980"),
    ("HL만도", "65,000"),
    ("기아", "170,300~176,300"),
    ("현대위아", "98,000"),
    ("SNT모티브", "40,800"),
    ("엠씨넥스", "32,500"),
    ("LG", "바닥 빵빵빵 / abc언덕 / 월봉뚜껑"),
    ("LG전자", "삼봉 / 월봉언덕"),
    ("LG씨엔에스", "78,300 (월봉 빵빵빵)"),
    ("한전기술", "192,000"),
    ("삼성에스디에스", "198,800 (월봉 빵빵빵)"),
    ("한화비전", "92,500~97,900"),
    ("LG에너지솔루션", "493,000~527,000"),
    ("에코프로비엠", "243,500"),
    ("롯데에너지머티리얼즈", "75,000"),
    ("후성", "15,420"),
    ("현대무벡스", "37,700"),
    ("로보티즈", "364,000"),
    ("뉴로메카", "71,100"),
    ("휴림로봇", "14,220~15,800"),
]


def find_ticker(name: str) -> tuple[str | None, str | None]:
    """이름으로 ticker 찾기 (정확 → 부분 매칭)"""
    # 정확 매칭
    r = sb.table("stocks").select("ticker,name,market").eq("name", name).limit(1).execute()
    if r.data:
        return r.data[0]["ticker"], r.data[0]["name"]
    # 부분 매칭
    r = sb.table("stocks").select("ticker,name,market").ilike("name", f"%{name}%").limit(3).execute()
    if r.data:
        return r.data[0]["ticker"], r.data[0]["name"]
    return None, None


def analyze_one(ticker: str, name: str, target_date: date, excluded: set[str]) -> dict:
    info = {"ticker": ticker, "name": name}

    # Stage 0
    cap = get_latest_market_cap(ticker, target_date)
    info["market_cap"] = cap
    ok0, reason0 = passes_stage0(ticker, cap, excluded)
    if not ok0:
        info["stage"] = f"STAGE0: {reason0}"
        return info

    # 데이터 로드
    daily = load_ohlcv(ticker, target_date, days_back=4000)
    info["daily_bars"] = len(daily)
    if len(daily) < 240:
        info["stage"] = f"STAGE0: 데이터 부족 ({len(daily)}봉)"
        return info

    # Stage 1
    yearly = load_yearly(ticker, target_date, years_back=10)
    monthly = load_monthly(ticker, target_date, months_back=18)
    trend = check_trend(daily, yearly, monthly)
    info["trend"] = f"y={trend.yearly}/m={trend.monthly}/ma240={trend.ma240_position}"
    if not trend.passes:
        info["stage"] = f"STAGE1 FAIL: {info['trend']}"
        return info

    # Stage 2 (시세 준 종목)
    cycle = check_cycle(daily)
    if cycle.surged:
        info["cycle"] = f"시세줌({cycle.surge_reason}) ABC={'완성' if cycle.abc_complete else '미완 -30점'}"
    else:
        info["cycle"] = "시세 안 줌"

    # 모든 timeframe에서 패턴 시도
    info["patterns_found"] = []
    for tf_name, cfg in TIMEFRAMES.items():
        bars = daily if cfg["resample"] is None else resample_ohlcv(daily, cfg["resample"])
        if len(bars) < cfg["min_bars"]:
            continue
        match = _try_patterns(bars, zz=cfg["zigzag"], tf=tf_name)
        if match:
            rrr = (match.target_price - match.entry_price) / max(match.entry_price - match.stop_loss, 0.01)
            info["patterns_found"].append({
                "tf": tf_name,
                "pattern": match.name,
                "entry": match.entry_price,
                "rrr": round(rrr, 2),
                "rrr_ok": rrr >= 1.5,
            })

    if info["patterns_found"]:
        info["stage"] = "PATTERN MATCH"
    else:
        info["stage"] = "STAGE3: 패턴 없음"

    return info


def main():
    target = date(2026, 5, 11)
    excluded = load_excluded_tickers()

    by_stage = {"STAGE0": [], "STAGE1": [], "STAGE2": [], "STAGE3": [], "MATCH": [], "NOT_FOUND": []}

    print(f"분석 대상: {len(USER_PICKS)} 종목, 기준일 {target}\n")
    print("=" * 110)

    for raw_name, memo in USER_PICKS:
        ticker, name = find_ticker(raw_name)
        if not ticker:
            print(f"{raw_name:<25s} ❌ 종목 못 찾음")
            by_stage["NOT_FOUND"].append(raw_name)
            continue

        try:
            info = analyze_one(ticker, name, target, excluded)
        except Exception as e:
            print(f"{name:<25s} ⚠️ 에러: {type(e).__name__}: {str(e)[:60]}")
            continue

        stage = info["stage"]
        cap = info.get("market_cap")
        cap_s = f"{cap/1e8:.0f}억" if cap else "?"
        trend_s = info.get("trend", "-")
        cycle_s = info.get("cycle", "")
        patterns_s = ""
        if info.get("patterns_found"):
            patterns_s = " | " + ", ".join(
                f"{p['tf']}-{p['pattern']}(R/R={p['rrr']}{'✓' if p['rrr_ok'] else '✗'})"
                for p in info["patterns_found"]
            )

        marker = (
            "✅" if stage == "PATTERN MATCH"
            else "⚠️" if "STAGE1" in stage
            else "❌" if "STAGE0" in stage
            else "❎"
        )
        print(f"{name:<22s} ({ticker}) {marker} {stage}")
        print(f"  시총={cap_s:>10s}  추세={trend_s:<35s}  {cycle_s}")
        if patterns_s:
            print(f"  패턴: {patterns_s.strip(' |')}")
        print()

        key = "MATCH" if stage == "PATTERN MATCH" else stage.split(":")[0].split(" ")[0]
        by_stage.setdefault(key, []).append(name)

    print("=" * 110)
    print("\n[요약]")
    for k, v in by_stage.items():
        if v:
            print(f"  {k:<10s}: {len(v)}건 — {', '.join(v[:5])}{'...' if len(v) > 5 else ''}")


if __name__ == "__main__":
    main()
