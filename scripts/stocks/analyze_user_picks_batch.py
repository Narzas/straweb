"""사용자 매수타점 다일자 일괄 분석 — HILL_BREAKOUT 패턴 설계용 데이터 추출.

usage:
  python analyze_user_picks_batch.py
"""
from __future__ import annotations
import io, os, sys, json
from datetime import date
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
from dotenv import load_dotenv
load_dotenv(ROOT / ".env.local", encoding="utf-8-sig")

from supabase import create_client
sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

sys.path.insert(0, str(Path(__file__).parent))
from detect_picks import (
    TIMEFRAMES, resample_ohlcv, load_ohlcv, load_yearly, load_monthly,
    get_latest_market_cap, load_excluded_tickers, passes_stage0, check_trend,
    check_cycle, _try_patterns, compute_hill_price,
)

# 사용자 일자별 매수타점
# "X일자 매수타점" = X 종가 후 결정 → X+1 진입 (target_date = X+1, cutoff = X)
BATCHES = {
    date(2026, 5, 7): [   # 5/6 picks
        ("LG", 103600), ("LG전자", 151900), ("NHN KCP", 21550),
        ("SK이노베이션", 140200), ("뉴파워프라즈마", 7250), ("미래에셋증권", 74180),
        ("상아프론테크", 29350), ("어보브반도체", 16000), ("에코프로비엠", 225000),
        ("와이씨켐", 14256), ("유니셈", 12380), ("인텔리안테크", 149400),
        ("켐트로닉스", 40000), ("코칩", 23000), ("파워넷", 8050),
        ("한국금융지주", 279000), ("한화투자증권", 8470), ("현대차", 551000),
        ("현우산업", 3975),
    ],
    date(2026, 5, 8): [   # 5/7 picks
        ("가온그룹", 8049), ("롯데에너지머티리얼즈", 75000), ("삼성중공업", 32500),
        ("솔브레인", 491500), ("에스비비테크", 70400), ("에치에프알", 37950),
        ("코오롱", 72800),
    ],
    date(2026, 5, 11): [  # 5/8 picks (월요일 진입)
        ("LG", 103600), ("LG씨엔에스", 69800), ("LG전자", 151900),
        ("LG화학", 428500), ("대한광통신", 22000), ("에스피지", 134900),
        ("인텔리안테크", 149400), ("케이엠더블유", 35150), ("코오롱", 83000),
        ("헥토파이낸셜", 34950), ("현대모비스", 472000), ("현대오토에버", 534000),
        ("현대위아", 88600),
    ],
    date(2026, 5, 12): [  # 5/11 picks
        ("HL만도", 62700), ("가온그룹", 10315), ("기아", 170300),
        ("로보티즈", 361500), ("롯데에너지머티리얼즈", 75000), ("헥토파이낸셜", 34950),
        ("현대모비스", 531000), ("현대무벡스", 37700), ("현대차", 647000),
    ],
    date(2026, 5, 13): [  # 5/12 picks
        ("DB", 2235), ("SK텔레콤", 102600), ("뉴로메카", 71100),
        ("레이언스", 6480), ("에스비비테크", 95000), ("에이치브이엠", 107900),
        ("현대차", 687000), ("화신", 15890), ("휴림로봇", 14220),
    ],
}


def lookup_ticker(name: str):
    r = sb.table("stocks").select("ticker,name,market").eq("name", name).limit(1).execute()
    if r.data: return r.data[0]
    r = sb.table("stocks").select("ticker,name,market").ilike("name", f"%{name}%").limit(3).execute()
    if r.data: return r.data[0]
    return None


def analyze_one(ticker, name, target_date, excluded, user_entry):
    out = {"ticker": ticker, "name": name, "user_entry": user_entry, "target_date": str(target_date), "patterns": []}
    cap = get_latest_market_cap(ticker, target_date - __import__("datetime").timedelta(days=1))
    out["market_cap_억"] = round(cap/1e8) if cap else None
    ok0, reason0 = passes_stage0(ticker, cap, excluded)
    if not ok0:
        out["stage"] = f"STAGE0:{reason0}"
        return out
    data_cutoff = target_date - __import__("datetime").timedelta(days=1)
    daily = load_ohlcv(ticker, data_cutoff, days_back=4000)
    if len(daily) < 240:
        out["stage"] = f"STAGE0:INSUFFICIENT({len(daily)})"
        return out
    yearly = load_yearly(ticker, data_cutoff, 10)
    monthly = load_monthly(ticker, data_cutoff, 18)
    trend = check_trend(daily, yearly, monthly)
    out["trend"] = f"{trend.yearly}/{trend.monthly}/{trend.ma240_position}"
    if not trend.passes:
        out["stage"] = f"STAGE1:{out['trend']}"
        return out
    cycle = check_cycle(daily)
    out["surge_reason"] = cycle.surge_reason if cycle.surged else None
    out["abc_complete"] = cycle.abc_complete if cycle.surged else None
    # 직전 종가 / 240MA 이격
    closes = daily["close"].astype(float).values
    out["prev_close"] = round(float(closes[-1]))
    ma240 = float(closes[-240:].mean())
    out["ma240_dev_pct"] = round((closes[-1] / ma240 - 1) * 100, 1)
    # 언덕(직전 로컬 고점)
    hill = compute_hill_price(daily)
    out["hill_price"] = round(hill) if hill else None
    if hill:
        out["user_entry_vs_hill_pct"] = round((user_entry / hill - 1) * 100, 2)
        out["prev_close_vs_hill_pct"] = round((closes[-1] / hill - 1) * 100, 2)
    # 패턴 탐지 (DAILY/WEEKLY)
    out["patterns"] = []
    for tf_name in ("DAILY", "WEEKLY"):
        cfg = TIMEFRAMES[tf_name]
        bars = daily if cfg["resample"] is None else resample_ohlcv(daily, cfg["resample"])
        if len(bars) < cfg["min_bars"]: continue
        m = _try_patterns(bars, zz=cfg["zigzag"], tf=tf_name)
        if m:
            rrr = (m.target_price - m.entry_price) / max(m.entry_price - m.stop_loss, 0.01)
            out["patterns"].append({
                "tf": tf_name, "pat": m.name, "entry": round(m.entry_price),
                "rrr": round(rrr, 2),
                "user_vs_sys_pct": round((user_entry / m.entry_price - 1) * 100, 2),
            })
    out["stage"] = "OK" if out["patterns"] else ("WATCH" if cycle.surged and not cycle.abc_complete else "NO_PATTERN")
    return out


def main():
    excluded = load_excluded_tickers()
    all_rows = []
    for target_date, picks in BATCHES.items():
        print(f"\n{'='*100}\n[ {target_date} ] {len(picks)} picks (cutoff={target_date - __import__('datetime').timedelta(days=1)})\n{'='*100}")
        for name, entry in picks:
            m = lookup_ticker(name)
            if not m:
                print(f"  ❌ {name}: 종목 못 찾음")
                continue
            try:
                info = analyze_one(m["ticker"], m["name"], target_date, excluded, entry)
            except Exception as e:
                print(f"  ⚠ {name}: {type(e).__name__}: {str(e)[:60]}")
                continue
            all_rows.append(info)
            # 한 줄 요약
            hill_s = f"hill={info['hill_price']:,}({info['user_entry_vs_hill_pct']:+.1f}%)" if info.get('hill_price') else "hill=?"
            pat_s = ""
            if info["patterns"]:
                pat_s = " | " + " ".join(f"{p['tf']}-{p['pat']}(R/R={p['rrr']},u∆={p['user_vs_sys_pct']:+.1f}%)" for p in info["patterns"])
            prev = f"{info.get('prev_close', 0):,}" if info.get('prev_close') else "?"
            ma_dev = f"{info['ma240_dev_pct']:+.0f}%" if info.get('ma240_dev_pct') is not None else "?"
            print(f"  {info['stage']:<8s} {info['name']:<14s} ({info['ticker']}) entry={entry:>9,} prev={prev:>9s} ma240∆={ma_dev:>5s} {hill_s}{pat_s}")
    # JSON 덤프
    out_path = Path(__file__).parent / "user_picks_analysis.json"
    out_path.write_text(json.dumps(all_rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"\n💾 saved {len(all_rows)} rows → {out_path}")
    # 통계 요약
    print("\n" + "="*100)
    print("[통계 요약]")
    valid = [r for r in all_rows if r.get("user_entry_vs_hill_pct") is not None]
    if valid:
        deltas = [r["user_entry_vs_hill_pct"] for r in valid]
        print(f"  user_entry vs hill_price 분포 (n={len(deltas)}):")
        print(f"    min={min(deltas):+.1f}%  median={sorted(deltas)[len(deltas)//2]:+.1f}%  max={max(deltas):+.1f}%")
        below = [d for d in deltas if d < 0]
        above = [d for d in deltas if d >= 0]
        print(f"    언덕 위에서 매수: {len(above)}/{len(deltas)} ({len(above)*100//len(deltas)}%)")
        print(f"    언덕 아래에서 매수: {len(below)}/{len(deltas)}")
    ma_devs = [r["ma240_dev_pct"] for r in all_rows if r.get("ma240_dev_pct") is not None]
    if ma_devs:
        print(f"  240MA 이격 분포 (n={len(ma_devs)}): min={min(ma_devs):+.0f}% median={sorted(ma_devs)[len(ma_devs)//2]:+.0f}% max={max(ma_devs):+.0f}%")
    stages = {}
    for r in all_rows:
        s = r["stage"]
        stages[s] = stages.get(s, 0) + 1
    print(f"  단계별 분포: {stages}")


if __name__ == "__main__":
    main()
