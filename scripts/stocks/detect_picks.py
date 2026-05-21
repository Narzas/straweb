"""
매수타점 탐지 → Supabase buy_picks 테이블 저장

사용법:
  python detect_picks.py                    # 오늘(가장 최근 영업일) 기준
  python detect_picks.py --date 2026-05-08  # 특정 날짜 (이 날짜의 picks 생성)
  python detect_picks.py --ticker 005930    # 단일 종목 디버그
  python detect_picks.py --limit 50         # 처음 50종목만 (테스트)
  python detect_picks.py --min-score 60     # 점수 임계값 조정 (기본 70)

데이터 기준 (전일 강제):
  --date YYYY-MM-DD 는 "탐지 기준일" = picks가 저장될 날짜.
  실제 패턴 탐지에 사용되는 OHLCV/시총 데이터는 (target_date - 1) 까지로 cutoff.
  즉 매수타점은 항상 전일 종가까지의 정보로 산출되어 오늘 시초가부터 유효.

파이프라인:
  Stage 0 (시총·제외리스트) → Stage 1 (年/月/240MA 추세) → Stage 2 (시세 준 종목 + ABC 검증)
    → 패턴 탐지 (Double Bottom / Inverse H&S) → 캔들 보조 → 점수화 → 저장
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local", encoding="utf-8-sig")

sys.path.insert(0, str(Path(__file__).parent))
from indicators import (  # noqa: E402
    Swing,
    _zigzag_simple,
    atr,
    rsi,
    sma,
)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("Missing Supabase env vars")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

MIN_MARKET_CAP = 100_000_000_000  # 1000억
DEFAULT_MIN_SCORE = 70
ZIGZAG_THRESHOLD = 0.05  # 일봉 기본값

# 타임프레임별 설정
TIMEFRAMES: dict[str, dict] = {
    "DAILY":   {"resample": None,  "zigzag": 0.05, "min_bars": 240, "label": "일봉"},
    "WEEKLY":  {"resample": "W-FRI", "zigzag": 0.10, "min_bars": 80, "label": "주봉"},  # ~1.5년
    "MONTHLY": {"resample": "ME",  "zigzag": 0.18, "min_bars": 36, "label": "월봉"},  # ~3년
    "YEARLY":  {"resample": "YE",  "zigzag": 0.30, "min_bars": 7,  "label": "년봉"},  # ~7년
}


def _to_native(obj):
    """numpy/pandas → 순수 Python (JSON 직렬화 위해)"""
    import numpy as _np
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_native(x) for x in obj]
    if isinstance(obj, (_np.bool_,)):
        return bool(obj)
    if isinstance(obj, (_np.integer,)):
        return int(obj)
    if isinstance(obj, (_np.floating,)):
        return float(obj)
    return obj


def resample_ohlcv(daily: pd.DataFrame, freq: str) -> pd.DataFrame:
    """일봉 → 지정 frequency로 resample. date 컬럼 유지."""
    df = daily.copy()
    df["date_dt"] = pd.to_datetime(df["date"])
    df = df.set_index("date_dt")
    out = pd.DataFrame(
        {
            "open": df["open"].resample(freq).first(),
            "high": df["high"].resample(freq).max(),
            "low": df["low"].resample(freq).min(),
            "close": df["close"].resample(freq).last(),
            "volume": df["volume"].resample(freq).sum(),
        }
    ).dropna()
    out = out.reset_index()
    out["date"] = out["date_dt"].dt.date.astype(str)
    return out.drop(columns=["date_dt"]).reset_index(drop=True)


# ──────────────────────────────────────────────────────────
# 데이터 로딩
# ──────────────────────────────────────────────────────────
def load_ohlcv(ticker: str, end_date: date, days_back: int = 800) -> pd.DataFrame:
    """ticker의 [end_date - days_back, end_date] OHLCV 로드 (페이지네이션)"""
    start = end_date - timedelta(days=days_back)
    rows = []
    offset = 0
    page = 1000
    while True:
        res = (
            sb.table("daily_ohlcv")
            .select("date,open,high,low,close,volume,market_cap")
            .eq("ticker", ticker)
            .gte("date", start.isoformat())
            .lte("date", end_date.isoformat())
            .order("date", desc=False)
            .range(offset, offset + page - 1)
            .execute()
        )
        if not res.data:
            break
        rows.extend(res.data)
        if len(res.data) < page:
            break
        offset += page
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    df["close"] = df["close"].astype(float)
    df["open"] = df["open"].astype(float)
    df["high"] = df["high"].astype(float)
    df["low"] = df["low"].astype(float)
    df["volume"] = df["volume"].astype(int)
    return df.reset_index(drop=True)


def load_yearly(ticker: str, end_date: date, years_back: int = 10) -> pd.DataFrame:
    """년봉 (간단히 일봉을 년 단위로 resample)"""
    df = load_ohlcv(ticker, end_date, days_back=years_back * 365 + 30)
    if df.empty:
        return df
    df["date_dt"] = pd.to_datetime(df["date"])
    df = df.set_index("date_dt")
    yearly = pd.DataFrame(
        {
            "open": df["open"].resample("YE").first(),
            "high": df["high"].resample("YE").max(),
            "low": df["low"].resample("YE").min(),
            "close": df["close"].resample("YE").last(),
            "volume": df["volume"].resample("YE").sum(),
        }
    ).dropna()
    return yearly.reset_index(drop=True)


def load_monthly(ticker: str, end_date: date, months_back: int = 18) -> pd.DataFrame:
    df = load_ohlcv(ticker, end_date, days_back=months_back * 31 + 30)
    if df.empty:
        return df
    df["date_dt"] = pd.to_datetime(df["date"])
    df = df.set_index("date_dt")
    monthly = pd.DataFrame(
        {
            "open": df["open"].resample("ME").first(),
            "high": df["high"].resample("ME").max(),
            "low": df["low"].resample("ME").min(),
            "close": df["close"].resample("ME").last(),
            "volume": df["volume"].resample("ME").sum(),
        }
    ).dropna()
    return monthly.reset_index(drop=True)


# ──────────────────────────────────────────────────────────
# Stage 0: 시총 + 제외 리스트
# ──────────────────────────────────────────────────────────
def load_excluded_tickers() -> set[str]:
    """excluded_tickers + stocks.is_excluded 통합"""
    out: set[str] = set()
    offset = 0
    page = 1000
    while True:
        r = sb.table("excluded_tickers").select("ticker").range(offset, offset + page - 1).execute()
        if not r.data:
            break
        out.update(x["ticker"] for x in r.data)
        if len(r.data) < page:
            break
        offset += page
    return out


def passes_stage0(ticker: str, latest_cap: Optional[float], excluded: set[str]) -> tuple[bool, str]:
    if ticker in excluded:
        return False, "EXCLUDED_LIST"
    if latest_cap is None:
        return False, "NO_MARKET_CAP"
    if latest_cap < MIN_MARKET_CAP:
        return False, "BELOW_1000억"
    return True, "OK"


# ──────────────────────────────────────────────────────────
# Stage 1: 추세 검증 (년/월/일봉 + 240일선)
# ──────────────────────────────────────────────────────────
@dataclass
class TrendCheck:
    yearly: str = "UNKNOWN"  # UP / FLAT / DOWN
    monthly: str = "UNKNOWN"
    ma240_position: str = "UNKNOWN"  # ABOVE / BELOW
    passes: bool = False
    reason: str = ""


def check_trend(daily: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame) -> TrendCheck:
    tc = TrendCheck()

    # 년봉: 최근 5개 년봉 중 3개 이상 양봉 + 최근 종가가 5년전 종가 대비 위
    if len(yearly) < 3:
        tc.reason = "yearly_data_insufficient"
        return tc
    recent_y = yearly.tail(5)
    bullish_count = (recent_y["close"] > recent_y["open"]).sum()
    cmp_n = min(5, len(yearly))
    five_yr_ago = float(yearly["close"].iloc[-cmp_n])
    latest_close = float(yearly["close"].iloc[-1])
    yearly_up = bullish_count >= 3 and latest_close >= five_yr_ago
    recent2_bullish = len(recent_y) >= 2 and bool(
        (recent_y["close"].iloc[-2:].values > recent_y["open"].iloc[-2:].values).all()
    )
    if yearly_up:
        tc.yearly = "UP"
    elif recent2_bullish:
        tc.yearly = "FLAT"  # 장기 하락 후 최근 2년 연속 양봉 반등 중
    elif latest_close < five_yr_ago * 0.85:
        tc.yearly = "DOWN"
    else:
        tc.yearly = "FLAT"

    # 월봉: SMA6 위 7개 이상 + 최근 종가 SMA12 위
    if len(monthly) < 12:
        tc.reason = "monthly_data_insufficient"
        return tc
    m_sma6 = sma(monthly["close"], 6)
    m_sma12 = sma(monthly["close"], 12)
    recent_m = monthly.tail(12)
    above_sma6 = (recent_m["close"].values > m_sma6.tail(12).values).sum()
    last_close_m = float(monthly["close"].iloc[-1])
    last_sma12 = float(m_sma12.iloc[-1])
    monthly_up = above_sma6 >= 7 and last_close_m >= last_sma12
    tc.monthly = "UP" if monthly_up else ("FLAT" if last_close_m >= last_sma12 * 0.95 else "DOWN")

    # 240일선
    if len(daily) < 240:
        tc.reason = "daily_data_insufficient"
        return tc
    ma240 = sma(daily["close"], 240).iloc[-1]
    last_close_d = float(daily["close"].iloc[-1])
    tc.ma240_position = "ABOVE" if last_close_d >= ma240 else "BELOW"

    # 240MA는 점수 보너스로만 반영 — Stage 1 하드필터 제외
    tc.passes = (tc.monthly == "UP") and (tc.yearly in ("UP", "FLAT"))
    if not tc.passes:
        tc.reason = f"trend_fail(y={tc.yearly},m={tc.monthly},ma240={tc.ma240_position})"
    return tc


# ──────────────────────────────────────────────────────────
# Stage 2: "시세 준 종목" + ABC 조정 검증 (옵션 C)
# ──────────────────────────────────────────────────────────
@dataclass
class CycleCheck:
    surged: bool = False
    surge_reason: str = ""
    abc_complete: bool = True   # 시세 안 줬으면 자동 통과
    penalty: int = 0            # 점수 페널티


def check_cycle(daily: pd.DataFrame) -> CycleCheck:
    cc = CycleCheck()
    if len(daily) < 240:
        return cc

    closes = daily["close"].values
    last = float(closes[-1])

    # 6M 최저 대비 +80% (100원 미만 틱 제외 — 신규상장 오류 방지)
    low_6m_series = daily["low"].tail(120)
    low_6m = float(low_6m_series[low_6m_series >= 100].min() if (low_6m_series >= 100).any() else low_6m_series.min())
    rise_6m = (last / max(low_6m, 1e-9) - 1) * 100

    # 12M 최저 대비 +150% (100원 미만 틱 제외)
    low_12m_series = daily["low"].tail(240)
    low_12m = float(low_12m_series[low_12m_series >= 100].min() if (low_12m_series >= 100).any() else low_12m_series.min())
    rise_12m = (last / max(low_12m, 1e-9) - 1) * 100

    # 240MA 이격도 +60%
    ma240 = float(sma(daily["close"], 240).iloc[-1])
    max_6m = float(daily["high"].tail(120).max())
    deviation = (max_6m / max(ma240, 1e-9) - 1) * 100

    triggers = []
    if rise_6m >= 80:
        triggers.append(f"6M+{rise_6m:.0f}%")
    if rise_12m >= 150:
        triggers.append(f"12M+{rise_12m:.0f}%")
    if deviation >= 60:
        triggers.append(f"240MA이격+{deviation:.0f}%")

    if not triggers:
        return cc  # 시세 안 줌, 통과

    cc.surged = True
    cc.surge_reason = "/".join(triggers)

    # ABC 조정 검증: 6M 고점부터 현재까지 ABC가 완성됐는지
    cc.abc_complete = _check_abc_complete(daily)
    if not cc.abc_complete:
        cc.penalty = 10  # 시세 줬는데 ABC 미완 → -10점

    return cc


def _check_abc_complete(daily: pd.DataFrame) -> bool:
    """간단 ABC 검증: 최근 6M 고점 이후 zigzag swing이 high→low→high→low 4개 이상이고,
    마지막 swing low가 첫 swing low ±5%."""
    recent = daily.tail(180).reset_index(drop=True)
    swings = _zigzag_simple(recent, threshold=0.05)
    # 최근 고점 (recent의 max) 이후 swing만
    if len(swings) < 4:
        return False
    # 마지막 4개: high, low, high, low 패턴 + low들이 비슷
    last4 = swings[-4:]
    kinds = [s.kind for s in last4]
    if kinds != ["high", "low", "high", "low"]:
        return False
    a_low, c_low = last4[1].price, last4[3].price
    return abs(c_low - a_low) / max(a_low, 1e-9) <= 0.05


def check_lid_warning(bars: pd.DataFrame, tf_name: str) -> bool:
    """뚜껑 감지 (주/월/년봉만): 직전 양봉 위로 음봉이 덮어씌운 강력 매도 시그널"""
    if tf_name == "DAILY" or len(bars) < 2:
        return False
    prev, curr = bars.iloc[-2], bars.iloc[-1]
    p_o, p_c = float(prev["open"]), float(prev["close"])
    c_o, c_c, c_h = float(curr["open"]), float(curr["close"]), float(curr["high"])
    if not (p_c > p_o):  # 직전봉 양봉 아님
        return False
    if not (c_c < c_o):  # 현재봉 음봉 아님
        return False
    high_breaks = c_h > float(prev["high"])          # 음봉 고가가 직전 양봉 고가 돌파
    body_overlap = c_o > p_o and c_c < p_c           # 음봉 몸통이 직전 양봉 몸통과 겹침
    return high_breaks and body_overlap


def compute_hill_price(bars: pd.DataFrame, n: int = 30) -> Optional[float]:
    """언덕: 최근 n봉 내 최고가.

    bars 는 data_cutoff(target_date - 1) 까지만 로드되므로 마지막 봉은
    이미 완료된 어제 봉이다. 어제 고점이 pivot 후보가 되어야 하므로
    마지막 봉을 포함해서 max high 계산.
    """
    if len(bars) < 1:
        return None
    look = bars["high"].iloc[-n:]
    return float(look.max()) if not look.empty else None


# ──────────────────────────────────────────────────────────
# 패턴 탐지
# ──────────────────────────────────────────────────────────
@dataclass
class PatternMatch:
    name: str                       # "DOUBLE_BOTTOM" | "INVERSE_HS" | "CUP_HANDLE"
    entry_price: float
    target_price: float
    stop_loss: float
    pattern_height: float
    base_score: int                 # 패턴 자체 점수 (0~40)
    note: str = ""
    meta: dict = field(default_factory=dict)  # swing points + 체크리스트 (차트 검증용)


def detect_double_bottom(daily: pd.DataFrame, zz: float = ZIGZAG_THRESHOLD) -> Optional[PatternMatch]:
    """W 패턴: 비슷한 2개 저점 + 중간 봉우리(넥라인)"""
    if len(daily) < 30:
        return None
    swings = _zigzag_simple(daily, threshold=zz)
    if len(swings) < 3:
        return None

    # 최근 swing이 low로 끝나거나 high로 끝나도 직전 3개로 검증
    # 패턴: low(LB) - high(NL) - low(RB)
    for i in range(len(swings) - 3, max(-1, len(swings) - 8), -1):
        if i < 0:
            break
        if i + 2 >= len(swings):
            continue
        lb, nl, rb = swings[i], swings[i + 1], swings[i + 2]
        if lb.kind != "low" or nl.kind != "high" or rb.kind != "low":
            continue

        # 1) 가격 대칭 ±3%
        price_diff = abs(rb.price - lb.price) / max(lb.price, 1e-9)
        if price_diff > 0.03:
            continue

        # 2) 시간 간격 10~50 영업일
        bars_between = rb.idx - lb.idx
        if not (10 <= bars_between <= 50):
            continue

        # 3) 중간 봉우리 높이: 저점 대비 10% 이상
        rise = (nl.price - max(lb.price, rb.price)) / max(lb.price, 1e-9)
        if rise < 0.10:
            continue

        # 4) 사전 추세: LB 형성 전 30 봉 동안 하락 추세 (LB 가격 < 30봉 전 종가)
        if lb.idx >= 30:
            prev_close = float(daily["close"].iloc[lb.idx - 30])
            if lb.price >= prev_close * 0.95:
                continue

        # 5) 현재 종가가 Neckline 아래인지 (돌파 전 진입 후보)
        current_close = float(daily["close"].iloc[-1])
        if current_close > nl.price * 1.05:
            # 이미 한참 돌파 → 매수 늦음
            continue

        # 매수타점 = Neckline (돌파 기준선)
        entry = nl.price
        height = nl.price - min(lb.price, rb.price)
        target = nl.price + height
        stop = nl.price * 0.97

        meta = {
            "swings": [
                {"date": lb.date, "price": float(lb.price), "kind": "low", "label": "1차 바닥"},
                {"date": nl.date, "price": float(nl.price), "kind": "high", "label": "저항선"},
                {"date": rb.date, "price": float(rb.price), "kind": "low", "label": "2차 바닥"},
            ],
            "checks": {
                "price_symmetry_pct": round(price_diff * 100, 2),
                "bars_between": bars_between,
                "neckline_rise_pct": round(rise * 100, 2),
                "prior_downtrend": True,
            },
        }

        return PatternMatch(
            name="DOUBLE_BOTTOM",
            entry_price=round(entry),
            target_price=round(target, 2),
            stop_loss=round(stop, 2),
            pattern_height=round(height, 2),
            base_score=35,
            note=f"두 저점 ±{price_diff*100:.1f}%, 간격 {bars_between}일",
            meta=meta,
        )
    return None


def detect_triple_bottom(daily: pd.DataFrame, zz: float = ZIGZAG_THRESHOLD) -> Optional[PatternMatch]:
    """삼바닥(Triple Bottom): 비슷한 3개 저점 + 2개 봉우리
    구조: low(L1) - high(P1) - low(L2) - high(P2) - low(L3) - 넥라인 돌파"""
    if len(daily) < 40:
        return None
    swings = _zigzag_simple(daily, threshold=zz)
    if len(swings) < 5:
        return None

    for i in range(len(swings) - 5, max(-1, len(swings) - 10), -1):
        if i < 0:
            break
        if i + 4 >= len(swings):
            continue
        l1, p1, l2, p2, l3 = swings[i : i + 5]
        if not (
            l1.kind == "low"
            and p1.kind == "high"
            and l2.kind == "low"
            and p2.kind == "high"
            and l3.kind == "low"
        ):
            continue

        # 1) 3개 저점 모두 ±3% 이내
        prices = [l1.price, l2.price, l3.price]
        max_p, min_p = max(prices), min(prices)
        spread = (max_p - min_p) / max(min_p, 1e-9)
        if spread > 0.03:
            continue

        # 2) 두 봉우리 비슷 ±3% (넥라인 수평)
        peak_diff = abs(p1.price - p2.price) / max(p1.price, 1e-9)
        if peak_diff > 0.05:
            continue

        # 3) 넥라인이 저점들보다 10% 이상 위
        avg_low = sum(prices) / 3
        neckline = (p1.price + p2.price) / 2
        rise = (neckline - avg_low) / max(avg_low, 1e-9)
        if rise < 0.10:
            continue

        # 4) 사전 하락 추세
        if l1.idx >= 30:
            prev_close = float(daily["close"].iloc[l1.idx - 30])
            if l1.price >= prev_close * 0.95:
                continue

        # 5) 현재 종가가 넥라인 5% 이내
        current_close = float(daily["close"].iloc[-1])
        if current_close > neckline * 1.05:
            continue

        # 6) 패턴 총 기간 합리적 (30~150 영업일)
        total_bars = l3.idx - l1.idx
        if not (30 <= total_bars <= 150):
            continue

        entry = neckline
        height = neckline - min_p
        target = neckline + height
        stop = neckline * 0.97

        meta = {
            "swings": [
                {"date": l1.date, "price": float(l1.price), "kind": "low", "label": "1차 바닥"},
                {"date": p1.date, "price": float(p1.price), "kind": "high", "label": "1차 피크"},
                {"date": l2.date, "price": float(l2.price), "kind": "low", "label": "2차 바닥"},
                {"date": p2.date, "price": float(p2.price), "kind": "high", "label": "2차 피크"},
                {"date": l3.date, "price": float(l3.price), "kind": "low", "label": "3차 바닥"},
            ],
            "checks": {
                "bottom_spread_pct": round(spread * 100, 2),
                "peak_diff_pct": round(peak_diff * 100, 2),
                "neckline_rise_pct": round(rise * 100, 2),
                "total_duration_bars": total_bars,
                "prior_downtrend": True,
            },
        }

        return PatternMatch(
            name="TRIPLE_BOTTOM",
            entry_price=round(entry),
            target_price=round(target, 2),
            stop_loss=round(stop, 2),
            pattern_height=round(height, 2),
            base_score=38,  # Double Bottom(35) < Triple Bottom < Inverse H&S(40)
            note=f"3저점 ±{spread*100:.1f}%, 총 {total_bars}일",
            meta=meta,
        )
    return None


def detect_cup_handle(
    daily: pd.DataFrame,
    zz: float = ZIGZAG_THRESHOLD,
    cup_min: int = 35,
    cup_max: int = 60,
    handle_min: int = 3,
    handle_max: int = 15,
    depth_max: float = 0.35,
) -> Optional[PatternMatch]:
    """컵 위드 핸들: high(LCR) - low(CB) - high(RCR) - low(HL) - 현재가
    매수타점 = Handle 최고가 돌파 (= Pivot Point)"""
    if len(daily) < 30:
        return None
    swings = _zigzag_simple(daily, threshold=zz)
    if len(swings) < 4:
        return None

    closes = daily["close"].values
    highs = daily["high"].values
    volumes = daily["volume"].values
    last_close = float(closes[-1])

    # 최근 4개 swing이 high-low-high-low 인지 검사
    for i in range(len(swings) - 4, max(-1, len(swings) - 8), -1):
        if i < 0:
            break
        if i + 3 >= len(swings):
            continue
        lcr, cb, rcr, hl = swings[i : i + 4]
        if not (
            lcr.kind == "high"
            and cb.kind == "low"
            and rcr.kind == "high"
            and hl.kind == "low"
        ):
            continue

        # 1) LCR/RCR 대칭 — 좌림 ≥ 우림 (좌림이 무조건 같거나 더 높아야) + ±5% 안
        #    우림이 좌림보다 높은 케이스는 컵위드핸들 아닌 다른 형태로 처리
        rim_diff = abs(lcr.price - rcr.price) / max(lcr.price, 1e-9)
        if rim_diff > 0.05:
            continue
        if rcr.price > lcr.price:
            continue
        if rcr.price < lcr.price * 0.95:
            continue

        # 2) Cup 깊이 12~depth_max (O'Neil 정석: ~35%)
        rim_avg = (lcr.price + rcr.price) / 2
        depth = (rim_avg - cb.price) / rim_avg
        if not (0.12 <= depth <= depth_max):
            continue

        # 3) Cup 기간 (타임프레임별 cup_min/cup_max)
        cup_bars = rcr.idx - lcr.idx
        if not (cup_min <= cup_bars <= cup_max):
            continue

        # 4) Handle 깊이 — 교과서적: Cup 깊이의 0.40 이하 + 3~15%
        handle_depth = (rcr.price - hl.price) / max(rcr.price, 1e-9)
        if not (0.03 <= handle_depth <= 0.15):
            continue
        if handle_depth > depth * 0.40:
            continue

        # 5) Handle 기간 (타임프레임별 handle_min/handle_max)
        handle_bars = hl.idx - rcr.idx
        if not (handle_min <= handle_bars <= handle_max):
            continue

        # 6) Handle 위치: Cup 상단 1/3 (= RCR의 85% 이상)
        if hl.price < rcr.price * 0.85:
            continue

        # 7) 현재가가 아직 Pivot 돌파 직전인지 (Pivot 5% 위까지는 허용)
        # O'Neil: 매수타점 = max(좌림, 우림) 0.2% 위 — 진짜 저항선(더 높은 쪽) 돌파 기준
        pivot = max(lcr.price, rcr.price)
        if last_close > pivot * 1.05:
            continue

        # 8) 거래량 패턴: Cup 우측(CB→RCR)에서 증가, Handle 구간에서 감소
        try:
            cup_right_vol = float(np.mean(volumes[cb.idx : rcr.idx + 1]))
            handle_vol = float(np.mean(volumes[rcr.idx : hl.idx + 1]))
            vol_pattern_ok = bool(handle_vol < cup_right_vol * 0.9)
        except Exception:
            vol_pattern_ok = False

        # 9) U자 검증 (V자 컷): Cup 좌측 하락이 점진적이어야 함 (강화: 0.25→0.30)
        left_bars = cb.idx - lcr.idx
        u_shape_ok = bool((left_bars / max(cup_bars, 1)) >= 0.30)

        # 10) 좌림 단봉 거부: 좌림 직전 5봉 평균이 좌림의 75% 이상이어야 점진적 형성
        #     (극단적 외바늘만 컷, 어느 정도의 급등은 허용)
        if lcr.idx < 5:
            continue
        prev5_avg = float(np.mean(closes[lcr.idx - 5 : lcr.idx]))
        lrim_gradual_ok = bool(prev5_avg >= lcr.price * 0.75)

        if not (vol_pattern_ok and u_shape_ok and lrim_gradual_ok):
            continue

        # 매수타점 = Pivot (좌림·우림 중 더 높은 쪽)
        entry = pivot
        height = rim_avg - cb.price  # Cup 깊이 (=measured move)
        target = pivot + height
        stop = hl.price * 0.97  # Handle 저점 3% 아래

        meta = {
            "swings": [
                {"date": lcr.date, "price": float(lcr.price), "kind": "high", "label": "좌림"},
                {"date": cb.date, "price": float(cb.price), "kind": "low", "label": "컵바닥"},
                {"date": rcr.date, "price": float(rcr.price), "kind": "high", "label": "우림"},
                {"date": hl.date, "price": float(hl.price), "kind": "low", "label": "핸들"},
            ],
            "checks": {
                "rim_symmetry_pct": round(rim_diff * 100, 2),
                "cup_depth_pct": round(depth * 100, 2),
                "cup_duration_bars": cup_bars,
                "handle_depth_pct": round(handle_depth * 100, 2),
                "handle_duration_bars": handle_bars,
                "handle_position_pct": round(hl.price / rcr.price * 100, 2),
                "volume_decreases_in_handle": vol_pattern_ok,
                "u_shape_ok": u_shape_ok,
                "left_bars_ratio": round(left_bars / max(cup_bars, 1), 2),
                "lrim_prev5_ratio": round(prev5_avg / max(lcr.price, 1), 3),
            },
        }

        return PatternMatch(
            name="CUP_HANDLE",
            entry_price=round(entry),
            target_price=round(target, 2),
            stop_loss=round(stop, 2),
            pattern_height=round(height, 2),
            base_score=40,
            note=(
                f"Cup 깊이 {depth*100:.0f}%/{cup_bars}일, "
                f"Handle {handle_depth*100:.0f}%/{handle_bars}일"
            ),
            meta=meta,
        )

    # ─── 구조적 탐지 fallback ───
    # 연속 스윙 방식이 실패한 경우, 컵 구간 전체에서 극값(최저·최고) 직접 매핑
    # 핸들 조건 완화: 깊이 ≤20%, 위치 ≥80%
    hl_s = rcr_s = None
    for i in range(len(swings) - 1, max(-1, len(swings) - 6), -1):
        s = swings[i]
        if hl_s is None and s.kind == "low":
            hl_s = s
        elif hl_s is not None and s.kind == "high":
            rcr_s = s
            break

    if hl_s is not None and rcr_s is not None and last_close <= rcr_s.price * 1.05:
        hdep = (rcr_s.price - hl_s.price) / max(rcr_s.price, 1e-9)
        hbars = hl_s.idx - rcr_s.idx
        if (0.03 <= hdep <= 0.20 and
                hl_s.price >= rcr_s.price * 0.80 and
                handle_min <= hbars <= handle_max):
            win_start_idx = rcr_s.idx - cup_max
            win_lcr_end = rcr_s.idx - cup_min
            # L-rim: cup window 내, 우림보다 같거나 높은 (≤ +5%) high 중
            # 시간상 R-rim 에 가장 가까운 (최근) high = "직전 고점"
            # (좌림 ≥ 우림 정석: 좌림이 무조건 같거나 더 높아야)
            lcr_cands = [s for s in swings if s.kind == "high"
                         and win_start_idx <= s.idx <= win_lcr_end
                         and rcr_s.price <= s.price <= rcr_s.price * 1.05]
            if lcr_cands:
                lcr_s = max(lcr_cands, key=lambda s: s.idx)
                # 좌림~우림 사이에 좌·우림보다 명확히 높은 봉이 있으면 컵 모양 부적합
                # (그 더 높은 봉이 진짜 컵 시작이거나 W자 등 다른 형태)
                between_highs = [s.price for s in swings if s.kind == "high"
                                 and lcr_s.idx < s.idx < rcr_s.idx]
                rim_max = max(lcr_s.price, rcr_s.price)
                between_ok = (
                    not between_highs or max(between_highs) <= rim_max * 1.03
                )
                # 컵 바닥: L-rim ~ R-rim 사이 최저점
                cup_lows = [s for s in swings if s.kind == "low"
                            and lcr_s.idx < s.idx < rcr_s.idx]
                if between_ok and cup_lows:
                    cb_s = min(cup_lows, key=lambda s: s.price)
                    rdiff = abs(lcr_s.price - rcr_s.price) / max(lcr_s.price, 1e-9)
                    ravg = (lcr_s.price + rcr_s.price) / 2
                    dep = (ravg - cb_s.price) / ravg
                    cbars = rcr_s.idx - lcr_s.idx
                    lbars = cb_s.idx - lcr_s.idx
                    # 좌림 단봉 거부 (Path 1과 동일 가드)
                    lrim_gradual_ok2 = (
                        lcr_s.idx >= 5 and
                        float(np.mean(closes[lcr_s.idx - 5 : lcr_s.idx])) >= lcr_s.price * 0.75
                    )
                    # 교과서적 가드: 림 대칭 ±5% + 좌림 ≥ 우림 (좌림이 더 높거나 같음)
                    #              + Handle 깊이 ≤ Cup 깊이 × 0.40
                    if (rdiff <= 0.05 and
                            lcr_s.price >= rcr_s.price and
                            rcr_s.price >= lcr_s.price * 0.95 and
                            0.12 <= dep <= depth_max and
                            cup_min <= cbars <= cup_max and
                            (lbars / max(cbars, 1)) >= 0.30 and  # U자
                            hdep <= dep * 0.40 and
                            lrim_gradual_ok2):
                        try:
                            vol_r = float(np.mean(volumes[cb_s.idx:rcr_s.idx + 1]))
                            vol_h = float(np.mean(volumes[rcr_s.idx:hl_s.idx + 1]))
                            vol_ok = bool(vol_h < vol_r * 0.9)
                        except Exception:
                            vol_ok = True
                        piv = max(lcr_s.price, rcr_s.price)
                        ht = ravg - cb_s.price
                        return PatternMatch(
                            name="CUP_HANDLE",
                            entry_price=round(piv, 2),
                            target_price=round(piv + ht, 2),
                            stop_loss=round(hl_s.price * 0.97, 2),
                            pattern_height=round(ht, 2),
                            base_score=50,
                            note=(
                                f"Cup 깊이 {dep*100:.0f}%/{cbars}일, "
                                f"Handle {hdep*100:.0f}%/{hbars}일 [구조적]"
                            ),
                            meta={
                                "swings": [
                                    {"date": lcr_s.date, "price": float(lcr_s.price), "kind": "high", "label": "좌림"},
                                    {"date": cb_s.date, "price": float(cb_s.price), "kind": "low", "label": "컵바닥"},
                                    {"date": rcr_s.date, "price": float(rcr_s.price), "kind": "high", "label": "우림"},
                                    {"date": hl_s.date, "price": float(hl_s.price), "kind": "low", "label": "핸들"},
                                ],
                                "checks": {
                                    "rim_symmetry_pct": round(rdiff * 100, 2),
                                    "cup_depth_pct": round(dep * 100, 2),
                                    "cup_duration_bars": cbars,
                                    "handle_depth_pct": round(hdep * 100, 2),
                                    "handle_duration_bars": hbars,
                                    "handle_position_pct": round(hl_s.price / rcr_s.price * 100, 2),
                                    "volume_decreases_in_handle": vol_ok,
                                    "structural": True,
                                },
                            },
                        )
    return None


def detect_inverse_hs(daily: pd.DataFrame, zz: float = ZIGZAG_THRESHOLD) -> Optional[PatternMatch]:
    """역헤드앤숄더: low(LS) - high(P1) - low(H) - high(P2) - low(RS)"""
    if len(daily) < 40:
        return None
    swings = _zigzag_simple(daily, threshold=zz)
    if len(swings) < 5:
        return None

    for i in range(len(swings) - 5, max(-1, len(swings) - 10), -1):
        if i < 0:
            break
        if i + 4 >= len(swings):
            continue
        ls, p1, h, p2, rs = swings[i : i + 5]
        if not (
            ls.kind == "low"
            and p1.kind == "high"
            and h.kind == "low"
            and p2.kind == "high"
            and rs.kind == "low"
        ):
            continue

        # Head이 LS, RS보다 5% 이상 더 깊음
        if not (h.price <= ls.price * 0.95 and h.price <= rs.price * 0.95):
            continue
        # LS / RS 대칭 ±5%
        if abs(ls.price - rs.price) / max(ls.price, 1e-9) > 0.05:
            continue
        # Neckline 거의 수평 ±3%
        if abs(p1.price - p2.price) / max(p1.price, 1e-9) > 0.03:
            continue
        # 사전 하락 추세 — 완화: LS 형성 전 30봉 종가보다 LS가 아래면 OK (이전: 5% 이상)
        # Stage 1에서 이미 추세 검증하므로 여기선 단순 체크만
        prior_downtrend = True
        if ls.idx >= 20:
            prev_close = float(daily["close"].iloc[ls.idx - 20])
            prior_downtrend = bool(ls.price < prev_close)  # native bool

        # 아직 Neckline 돌파 직전인지
        neckline = (p1.price + p2.price) / 2
        current_close = float(daily["close"].iloc[-1])
        if current_close > neckline * 1.05:
            continue

        entry = neckline * 1.002
        height = neckline - h.price
        target = neckline + height
        stop = neckline * 0.97  # 넥라인 3% 아래 — false breakout 방어

        meta = {
            "swings": [
                {"date": ls.date, "price": float(ls.price), "kind": "low", "label": "왼쪽 어깨"},
                {"date": p1.date, "price": float(p1.price), "kind": "high", "label": "1차 피크"},
                {"date": h.date, "price": float(h.price), "kind": "low", "label": "머리"},
                {"date": p2.date, "price": float(p2.price), "kind": "high", "label": "2차 피크"},
                {"date": rs.date, "price": float(rs.price), "kind": "low", "label": "오른쪽 어깨"},
            ],
            "checks": {
                "head_depth_pct": round((1 - h.price / min(ls.price, rs.price)) * 100, 2),
                "shoulder_symmetry_pct": round(abs(ls.price - rs.price) / ls.price * 100, 2),
                "neckline_flat_pct": round(abs(p1.price - p2.price) / p1.price * 100, 2),
                "prior_downtrend": prior_downtrend,
            },
        }

        return PatternMatch(
            name="INVERSE_HS",
            entry_price=round(entry),
            target_price=round(target, 2),
            stop_loss=round(stop, 2),
            pattern_height=round(height, 2),
            base_score=40,
            note=f"H {h.price:.0f}, LS/RS ±{abs(ls.price-rs.price)/ls.price*100:.1f}%",
            meta=meta,
        )
    return None


def detect_head_breakout(bars: pd.DataFrame, zz: float = ZIGZAG_THRESHOLD) -> Optional[PatternMatch]:
    """삼봉(H&S Top) 머리 돌파 매수 — 실패한 토핑 패턴 → 강세 반전.

    구조: high(LS) - low(V1) - high(Head) - low(V2) - high(RS)
    Head 가 LS·RS 보다 ≥5% 높고, LS/RS 대칭 ±5%, 넥라인 ±5%.
    prev_close ∈ Head ±3% (돌파 임박).

    Entry: head_price (pivot)
    Stop:  head × 0.93 (O'Neil 7%)
    Target: head × 1.20 (O'Neil +20%)
    """
    if len(bars) < 20:
        return None
    swings = _zigzag_simple(bars, threshold=zz)
    if len(swings) < 5:
        return None

    for i in range(len(swings) - 5, max(-1, len(swings) - 10), -1):
        if i < 0:
            break
        if i + 4 >= len(swings):
            continue
        ls, v1, head, v2, rs = swings[i : i + 5]
        if not (
            ls.kind == "high"
            and v1.kind == "low"
            and head.kind == "high"
            and v2.kind == "low"
            and rs.kind == "high"
        ):
            continue

        # Head 가 LS, RS 보다 ≥5% 높음
        if not (head.price >= ls.price * 1.05 and head.price >= rs.price * 1.05):
            continue
        # LS / RS 대칭 ±5%
        if abs(ls.price - rs.price) / max(ls.price, 1e-9) > 0.05:
            continue
        # 넥라인 (V1, V2) 거의 수평 ±5%
        if abs(v1.price - v2.price) / max(v1.price, 1e-9) > 0.05:
            continue
        # 현재 prev_close가 Head ±3% 이내 (돌파 임박)
        prev_close = float(bars["close"].iloc[-1])
        deviation = abs(prev_close / head.price - 1)
        if deviation > 0.03:
            continue
        # 패턴 총 폭 최소 10봉
        if rs.idx - ls.idx < 10:
            continue

        entry = round(head.price)
        stop = round(head.price * 0.93)
        target = round(head.price * 1.20)
        height = entry - stop

        return PatternMatch(
            name="HEAD_BREAKOUT",
            entry_price=entry,
            target_price=target,
            stop_loss=stop,
            pattern_height=height,
            base_score=35,
            note=f"삼봉 머리 돌파 pivot={entry:,} (H={round(head.price):,}, LS={round(ls.price):,}, RS={round(rs.price):,})",
            meta={
                "swings": [
                    {"date": ls.date, "price": float(ls.price), "kind": "high", "label": "왼쪽 어깨"},
                    {"date": v1.date, "price": float(v1.price), "kind": "low", "label": "1차 골"},
                    {"date": head.date, "price": float(head.price), "kind": "high", "label": "머리"},
                    {"date": v2.date, "price": float(v2.price), "kind": "low", "label": "2차 골"},
                    {"date": rs.date, "price": float(rs.price), "kind": "high", "label": "오른쪽 어깨"},
                ],
                "head_price": entry,
                "neckline": round((v1.price + v2.price) / 2),
                "prev_close": round(prev_close),
                "deviation_pct": round(deviation * 100, 2),
            },
        )
    return None


# ──────────────────────────────────────────────────────────
# 점수 계산
# ──────────────────────────────────────────────────────────
def calc_score(
    match: PatternMatch,
    trend: TrendCheck,
    cycle: CycleCheck,
    volume_signal: int,
    rrr_value: float,
    market_cap: float,
) -> int:
    score = match.base_score  # 0~50

    # 거래량 (0~15) — 이미 호출자가 계산해서 전달
    score += min(volume_signal, 15)

    # 추세 강도 보너스 (0~15)
    trend_pts = 0
    if trend.yearly == "UP":
        trend_pts += 7
    if trend.monthly == "UP":
        trend_pts += 5
    if trend.ma240_position == "ABOVE":
        trend_pts += 3
    score += trend_pts

    # RRR (0~10)
    if rrr_value >= 3:
        score += 10
    elif rrr_value >= 2:
        score += 7
    elif rrr_value >= 1.5:
        score += 4

    # 시총 보너스 (0~5)
    if market_cap >= 10_000_000_000_000:  # 10조
        score += 5
    elif market_cap >= 1_000_000_000_000:  # 1조
        score += 3
    elif market_cap >= 300_000_000_000:    # 3000억
        score += 1

    # 페널티 — HILL_BREAKOUT은 surge 진행 중 매수가 전제이므로 ABC 미완 페널티 제외
    if match.name != "HILL_BREAKOUT":
        score -= cycle.penalty

    return max(0, min(100, score))


def volume_check(daily: pd.DataFrame) -> int:
    """거래량 신호 점수 (0~15).
    최근 5봉 평균이 20봉 평균보다 크면 +10, 50봉 평균 1.5배 이상이면 +15"""
    if len(daily) < 50:
        return 0
    vol = daily["volume"].astype(float)
    v5 = vol.tail(5).mean()
    v20 = vol.tail(20).mean()
    v50 = vol.tail(50).mean()
    pts = 0
    if v5 > v20:
        pts += 5
    if v5 > v50 * 1.2:
        pts += 5
    if v5 > v50 * 1.5:
        pts += 5
    return min(pts, 15)


# ──────────────────────────────────────────────────────────
# 메인 파이프라인
# ──────────────────────────────────────────────────────────
def get_active_stocks() -> list[tuple[str, str, str]]:
    """stocks 테이블에서 (ticker, name, market) 페이지네이션"""
    out = []
    offset, page = 0, 1000
    while True:
        r = (
            sb.table("stocks")
            .select("ticker,name,market")
            .eq("is_excluded", False)
            .range(offset, offset + page - 1)
            .execute()
        )
        if not r.data:
            break
        out.extend((x["ticker"], x["name"], x["market"]) for x in r.data)
        if len(r.data) < page:
            break
        offset += page
    return out


def get_latest_market_cap(ticker: str, target_date: date) -> Optional[float]:
    r = (
        sb.table("daily_ohlcv")
        .select("market_cap")
        .eq("ticker", ticker)
        .lte("date", target_date.isoformat())
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if not r.data or r.data[0]["market_cap"] is None:
        return None
    return float(r.data[0]["market_cap"])


def detect_three_white_soldiers(bars: pd.DataFrame) -> Optional[PatternMatch]:
    """적삼병 (빵빵빵): 최근 3개 연속 양봉, 각 종가 상승, 각 시가 이전 시가 이상"""
    if len(bars) < 5:
        return None
    b0, b1, b2 = bars.iloc[-3], bars.iloc[-2], bars.iloc[-1]
    o0, c0 = float(b0["open"]), float(b0["close"])
    o1, c1 = float(b1["open"]), float(b1["close"])
    o2, c2 = float(b2["open"]), float(b2["close"])
    if not (c0 > o0 and c1 > o1 and c2 > o2):  # 3봉 모두 양봉
        return None
    if not (c2 > c1 > c0):  # 종가 연속 상승
        return None
    # 시가 조건: 각 봉의 시가가 직전 봉 몸통 내에 있어야 함 (갭 없는 계단식)
    if not (o0 <= o1 <= c0 and o1 <= o2 <= c1):
        return None
    entry = c2
    height = c2 - o0
    target = entry + height
    stop = float(b0["low"])
    if target <= entry or entry <= stop:
        return None
    return PatternMatch(
        name="THREE_WHITE_SOLDIERS",
        entry_price=round(entry),
        target_price=round(target),
        stop_loss=round(stop),
        pattern_height=round(height),
        base_score=25,
        note=f"적삼병 {round(c0)}→{round(c1)}→{round(c2)}",
        meta={"b0_close": round(c0), "b1_close": round(c1), "b2_close": round(c2)},
    )


def detect_gap_up_support(
    bars: pd.DataFrame, gap_min: float = 0.02, n: int = 60
) -> Optional[PatternMatch]:
    """갭 구간: 최근 n봉 내 갭 상승 발생 후 현재가가 갭 하단 ±5%에서 지지"""
    if len(bars) < 10:
        return None
    recent = bars.tail(n).reset_index(drop=True)
    current_close = float(recent["close"].iloc[-1])
    for i in range(len(recent) - 2, 0, -1):  # 최근 갭 우선
        p_c = float(recent["close"].iloc[i - 1])
        c_o = float(recent["open"].iloc[i])
        if c_o <= p_c * (1 + gap_min):
            continue
        gap_bottom, gap_top = p_c, c_o
        if not (gap_bottom * 0.95 <= current_close <= gap_bottom * 1.05):
            continue
        gap_h = gap_top - gap_bottom
        target = gap_top + gap_h * 0.5
        stop = gap_bottom * 0.95
        if target <= current_close or current_close <= stop:
            continue
        return PatternMatch(
            name="GAP_UP_SUPPORT",
            entry_price=round(current_close),
            target_price=round(target),
            stop_loss=round(stop),
            pattern_height=round(gap_h),
            base_score=20,
            note=f"갭구간 지지 {round(gap_bottom)}~{round(gap_top)}",
            meta={"gap_bottom": round(gap_bottom), "gap_top": round(gap_top)},
        )
    return None


def detect_abc_entry(daily: pd.DataFrame) -> Optional[PatternMatch]:
    """ABC 조정 종결 → 5파 진입: 시세 준 종목의 C파 저점 근처에서 반등 시작 시 신호.
    조건: 일봉 기준 high→low→high→low 4개 스윙, A/C 저점 ±5%, 현재가 C저점 +15% 이내,
    마지막 봉 음봉 아님 (종가 >= 시가 * 0.995).
    """
    if len(daily) < 180:
        return None

    last_bar = daily.iloc[-1]
    last_o, last_c = float(last_bar["open"]), float(last_bar["close"])
    if last_c < last_o * 0.995:
        return None

    recent = daily.tail(180).reset_index(drop=True)
    swings = _zigzag_simple(recent, threshold=0.05)
    if len(swings) < 4:
        return None
    last4 = swings[-4:]
    if [s.kind for s in last4] != ["high", "low", "high", "low"]:
        return None
    surge_high = last4[0].price
    a_low = last4[1].price
    b_high = last4[2].price
    c_low = last4[3].price
    if abs(c_low - a_low) / max(a_low, 1e-9) > 0.05:
        return None

    current_close = float(daily["close"].iloc[-1])
    if current_close > c_low * 1.15:
        return None

    entry = current_close
    target = round(surge_high)
    stop = round(c_low * 0.95)
    if target <= entry or entry <= stop:
        return None
    if (target - entry) / max(entry - stop, 0.01) < 1.5:
        return None

    return PatternMatch(
        name="ELLIOTT_ABC_ENTRY",
        entry_price=round(entry),
        target_price=target,
        stop_loss=stop,
        pattern_height=round(surge_high - c_low),
        base_score=30,
        note=f"ABC종결 C저={round(c_low)} B고={round(b_high)} 목표={round(surge_high)}",
        meta={
            "surge_high": round(surge_high),
            "surge_high_date": last4[0].date,
            "a_low": round(a_low),
            "a_low_date": last4[1].date,
            "b_high": round(b_high),
            "b_high_date": last4[2].date,
            "c_low": round(c_low),
            "c_low_date": last4[3].date,
        },
    )


def detect_hill_breakout(
    bars: pd.DataFrame, threshold: float = 0.03
) -> Optional[PatternMatch]:
    """언덕(직전 로컬 고점) pivot 돌파 매수 (O'Neil pivot point breakout).

    조건: hill_price 존재 + 직전 종가가 hill ±threshold(default 3%) 이내.
    호출자 측에서 cycle.surged 게이팅 필수 (시세 진행 중인 종목만).

    Entry: hill_price (정확히 pivot)
    Stop:  hill × 0.93 (O'Neil 7% rule)
    Target: hill × 1.20 (O'Neil 첫 매도 +20%)
    R/R 고정 ≈ 2.86
    """
    hill = compute_hill_price(bars)
    if hill is None or hill <= 0:
        return None
    prev_close = float(bars["close"].iloc[-1])
    deviation = abs(prev_close / hill - 1)
    if deviation > threshold:
        return None

    entry = round(hill)
    stop = round(hill * 0.93)
    target = round(hill * 1.20)
    return PatternMatch(
        name="HILL_BREAKOUT",
        entry_price=entry,
        target_price=target,
        stop_loss=stop,
        pattern_height=entry - stop,
        base_score=30,
        note=f"언덕돌파 pivot={entry:,} (직전종가 {round(prev_close):,})",
        meta={
            "hill_price": entry,
            "prev_close": round(prev_close),
            "deviation_pct": round(deviation * 100, 2),
        },
    )


def _try_patterns(
    bars: pd.DataFrame, zz: float, tf: str
) -> Optional[PatternMatch]:
    """타임프레임별 패턴 탐지 우선순위: Cup&Handle → Inverse H&S → Triple Bottom → Double Bottom"""
    # 타임프레임별 Cup 기간 (단위는 해당 timeframe의 봉 개수)
    # O'Neil 정석 기준
    # (cup_min, cup_max, handle_min, handle_max, depth_max)
    cup_params = {
        "DAILY":   (35, 200,  3, 15, 0.40),  # 7~40주 (~10개월), handle 3~15일
        "WEEKLY":  (7,  65,   1,  5, 0.35),  # 7주~65주 (O'Neil 원전), handle 1~5주
        "MONTHLY": (6,  18,   1,  4, 0.40),  # 6~18개월 장기 베이스
        "YEARLY":  (2,   6,   1,  2, 0.35),
    }.get(tf, (35, 200, 3, 15, 0.40))

    # HEAD_BREAKOUT (삼봉 머리 돌파) — 일/주/월봉만, 년봉 swing 부족으로 제외
    head_match = detect_head_breakout(bars, zz=zz) if tf in ("DAILY", "WEEKLY", "MONTHLY") else None

    return (
        detect_cup_handle(bars, zz=zz, cup_min=cup_params[0], cup_max=cup_params[1],
                          handle_min=cup_params[2], handle_max=cup_params[3],
                          depth_max=cup_params[4])
        or head_match
        or detect_triple_bottom(bars, zz=zz)
        or detect_double_bottom(bars, zz=zz)
        or detect_three_white_soldiers(bars)
        or detect_gap_up_support(bars)
    )


def process_one(ticker: str, name: str, market: str, target_date: date, excluded: set[str]):
    """한 종목 처리 → 매칭 list 반환 (각 timeframe별 독립적인 매칭)

    매수타점은 항상 전일 종가까지의 정보로 산출 (target_date 의 데이터는 절대 사용 금지).
    """
    data_cutoff = target_date - timedelta(days=1)
    cap = get_latest_market_cap(ticker, data_cutoff)
    ok0, reason0 = passes_stage0(ticker, cap, excluded)
    if not ok0:
        return [], reason0

    daily = load_ohlcv(ticker, data_cutoff, days_back=4000)  # ~16년치 (yearly resample용)
    if len(daily) < 240:
        return [], "DAILY_INSUFFICIENT"

    yearly_df = load_yearly(ticker, data_cutoff, years_back=10)
    monthly_df = load_monthly(ticker, data_cutoff, months_back=18)

    trend = check_trend(daily, yearly_df, monthly_df)
    if not trend.passes:
        return [], trend.reason

    cycle = check_cycle(daily)

    vol_pts = volume_check(daily)
    current_close = float(daily["close"].iloc[-1])

    # 240일선 이격률 — gap_extended 필터에서 사용
    ma240 = float(daily["close"].iloc[-240:].mean())
    ma240_dev_pct = (current_close / ma240 - 1) * 100 if ma240 > 0 else 0

    # 타임프레임별 매칭 누적 (R/R / score 컷오프 무관 — 분류는 run()에서)
    results = []
    daily_has_pattern = False
    for tf_name, cfg in TIMEFRAMES.items():
        if cfg["resample"] is None:
            bars = daily
        else:
            bars = resample_ohlcv(daily, cfg["resample"])

        if len(bars) < cfg["min_bars"]:
            continue

        match = _try_patterns(bars, zz=cfg["zigzag"], tf=tf_name)

        # GAP_UP_SUPPORT는 user style과 미스매치 — DAILY 한정 HILL/ABC로 업그레이드 시도
        if match and match.name == "GAP_UP_SUPPORT" and tf_name == "DAILY":
            if cycle.surged and cycle.abc_complete:
                abc = detect_abc_entry(daily)
                if abc:
                    match = abc
            if match.name == "GAP_UP_SUPPORT" and cycle.surged:
                hill = detect_hill_breakout(daily)
                if hill:
                    match = hill
            if match.name == "GAP_UP_SUPPORT":
                match = None  # 업그레이드 실패 → 폐기 (trend_extended 자격 유지)

        if not match and tf_name == "DAILY" and cycle.surged and cycle.abc_complete:
            match = detect_abc_entry(daily)
        if not match and tf_name == "DAILY" and cycle.surged:
            match = detect_hill_breakout(daily)
        if not match:
            continue

        # WEEKLY 등 비-DAILY GAP_UP_SUPPORT도 컷 미달이면 의미 X — 일단 결과로는 남기고 run()에서 처리
        if tf_name == "DAILY":
            daily_has_pattern = True

        rrr = (match.target_price - match.entry_price) / max(
            match.entry_price - match.stop_loss, 0.01
        )
        rrr = max(-99.99, min(999.99, rrr))  # numeric(5,2) 컬럼 한계

        score = calc_score(match, trend, cycle, vol_pts, rrr, cap)

        lid_warn = check_lid_warning(bars, tf_name)
        hill = compute_hill_price(bars)
        if lid_warn:
            score -= 30  # 뚜껑 감점 — 강력 매도 시그널

        note = f"{match.note}"
        if cycle.surged:
            note += f" | 시세{cycle.surge_reason}"
            if not cycle.abc_complete:
                note += " ABC미완"

        detection_meta = {
            **match.meta,
            **({"lid_warning": True} if lid_warn else {}),
            **({"hill_price": round(hill)} if hill is not None else {}),
            "timeframe": tf_name,
            "score_breakdown": {
                "pattern": match.base_score,
                "volume": vol_pts,
                "trend": {
                    "yearly": trend.yearly,
                    "monthly": trend.monthly,
                    "ma240": trend.ma240_position,
                },
                "rrr": round(rrr, 2),
                "cycle_surged": cycle.surged,
                "cycle_abc_complete": cycle.abc_complete,
                "cycle_penalty": cycle.penalty,
            },
            "context": {
                "current_close": round(current_close, 2),
                "market_cap": cap,
                "ma240_dev_pct": round(ma240_dev_pct, 1),
            },
        }

        results.append({
            "ticker": ticker,
            "name": name,
            "market": market,
            "pattern": match.name,
            "timeframe": tf_name,
            "score": score,
            "entry_price": match.entry_price,
            "current_price": round(current_close, 2),
            "target_price": match.target_price,
            "stop_loss": match.stop_loss,
            "candle_confirm": None,
            "note": note,
            "trend_yearly": trend.yearly,
            "trend_monthly": trend.monthly,
            "ma240_position": trend.ma240_position,
            "rrr": round(rrr, 2),
            "pattern_height": match.pattern_height,
            "detection_meta": detection_meta,
        })

    # 추세 진행 워치 후보 — DAILY 패턴 없음 + 시세줌 + ABC 미완
    # + 추가 필터: 240MA 이격 ≥ 40% + hill_price 근접 ±10% (user style 매칭)
    daily_hill = compute_hill_price(daily)
    if (
        not daily_has_pattern
        and cycle.surged
        and not cycle.abc_complete
        and ma240_dev_pct >= 40
        and daily_hill is not None
        and daily_hill > 0
        and abs(current_close / daily_hill - 1) <= 0.10
    ):
        results.append({
            "ticker": ticker,
            "name": name,
            "market": market,
            "pattern": "TREND_EXTENDED",
            "timeframe": "DAILY",
            "score": 0,
            "entry_price": round(daily_hill),  # 매수타점 = hill_price (pivot 돌파)
            "current_price": round(current_close, 2),
            "target_price": None,
            "stop_loss": None,
            "candle_confirm": None,
            "note": f"시세{cycle.surge_reason} ABC미완 hill={round(daily_hill):,}",
            "trend_yearly": trend.yearly,
            "trend_monthly": trend.monthly,
            "ma240_position": trend.ma240_position,
            "rrr": None,
            "pattern_height": None,
            "detection_meta": {
                "kind_hint": "trend_extended",
                "timeframe": "DAILY",
                "cycle_surge_reason": cycle.surge_reason,
                "hill_price": round(daily_hill),
                "context": {
                    "current_close": round(current_close, 2),
                    "market_cap": cap,
                    "ma240_dev_pct": round(ma240_dev_pct, 1),
                    "hill_dev_pct": round((current_close / daily_hill - 1) * 100, 1),
                },
            },
        })

    if not results:
        return [], "NO_PATTERN"
    return results, "MATCH"


def run(target_date: date, ticker_filter: Optional[list[str]], min_score: int, limit: Optional[int]):
    started = time.time()
    excluded = load_excluded_tickers()
    print(f"[detect] excluded list: {len(excluded)}")

    if ticker_filter:
        stocks = [(t, "?", "?") for t in ticker_filter]
    else:
        stocks = get_active_stocks()
    if limit:
        stocks = stocks[:limit]

    # idempotent: 재실행 시 stale picks 가 남지 않도록 동일 date 의 기존 picks 모두 삭제
    # (단일 종목 디버그 실행 시에는 건너뜀)
    if not ticker_filter and not limit:
        deleted = sb.table("buy_picks").delete().eq("date", target_date.isoformat()).execute()
        if deleted.data:
            print(f"[detect] cleared {len(deleted.data)} stale picks for {target_date}")

    print(f"[detect] processing {len(stocks)} stocks for {target_date}, min_score={min_score}")

    matches = []        # kind='match'
    trend_extended = [] # kind='trend_extended'
    reasons: dict[str, int] = {}
    for ticker, name, market in tqdm(stocks, desc="scan"):
        try:
            results, reason = process_one(ticker, name, market, target_date, excluded)
            reasons[reason] = reasons.get(reason, 0) + 1
            for result in results:
                result["date"] = target_date.isoformat()
                if result["pattern"] == "TREND_EXTENDED":
                    result["kind"] = "trend_extended"
                    trend_extended.append(result)
                elif (result["rrr"] or 0) >= 1.5 and result["score"] >= min_score:
                    result["kind"] = "match"
                    matches.append(result)
                # else: 컷오프 미달 GAP/패턴은 폐기 (gap_extended 카테고리 제거)
        except Exception as e:
            reasons[f"ERROR:{type(e).__name__}"] = reasons.get(f"ERROR:{type(e).__name__}", 0) + 1
            if ticker_filter:
                print(f"  ! {ticker}: {e}", file=sys.stderr)

    print(f"\n[detect] reasons:")
    for r, c in sorted(reasons.items(), key=lambda x: -x[1]):
        print(f"  {r:>40s}: {c}")

    print(f"\n[detect] matches: {len(matches)} | trend_extended: {len(trend_extended)}")
    for m in sorted(matches, key=lambda x: -x["score"])[:30]:
        print(
            f"  [{m['timeframe']:<7s}] {m['ticker']} {m['name'][:10]:<10s} "
            f"{m['pattern']:<15s} score={m['score']} entry={m['entry_price']:.0f} "
            f"R/R={m['rrr']:.1f}"
        )

    # 저장 (matches + trend_extended)
    all_save = matches + trend_extended
    if all_save and not ticker_filter:
        save_rows = []
        for m in all_save:
            row = {k: v for k, v in m.items() if k not in ("name", "market")}
            save_rows.append(_to_native(row))
        for i in range(0, len(save_rows), 500):
            sb.table("buy_picks").upsert(
                save_rows[i : i + 500], on_conflict="date,ticker,pattern,timeframe"
            ).execute()
        print(f"[detect] saved {len(save_rows)} rows ({len(matches)} match + {len(trend_extended)} trend)")

    dur = int(time.time() - started)
    try:
        sb.table("buy_picks_runs").insert(
            {
                "run_date": target_date.isoformat(),
                "stage": "DETECT",
                "status": "OK",
                "duration_sec": dur,
                "picks_count": len(matches),
                "filtered_count": len(stocks),
            }
        ).execute()
    except Exception as e:
        print(f"  ! log_run failed: {e}", file=sys.stderr)

    print(f"[OK] done in {dur}s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="YYYY-MM-DD")
    ap.add_argument("--ticker", help="단일 종목 디버그")
    ap.add_argument("--limit", type=int, help="처음 N종목")
    ap.add_argument("--min-score", type=int, default=DEFAULT_MIN_SCORE)
    args = ap.parse_args()

    target = date.fromisoformat(args.date) if args.date else date.today()
    tf = [args.ticker] if args.ticker else None
    run(target, tf, args.min_score, args.limit)


if __name__ == "__main__":
    main()
