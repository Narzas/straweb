"""
공통 기술적 지표 + ZigZag (swing high/low 추출)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd


# ──────────────────────────────────────────────────────────
# 이동평균 / ATR / RSI
# ──────────────────────────────────────────────────────────
def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(window=n, min_periods=n).mean()


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    """High/Low/Close 가 필요 (대문자 컬럼)"""
    h, l, c = df["high"], df["low"], df["close"]
    pc = c.shift(1)
    tr = pd.concat([(h - l), (h - pc).abs(), (l - pc).abs()], axis=1).max(axis=1)
    return tr.rolling(window=n, min_periods=n).mean()


def rsi(s: pd.Series, n: int = 14) -> pd.Series:
    diff = s.diff()
    gain = diff.where(diff > 0, 0.0)
    loss = -diff.where(diff < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / n, min_periods=n, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / n, min_periods=n, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


# ──────────────────────────────────────────────────────────
# ZigZag: 일정 비율(threshold) 이상의 변동만 swing으로 인정
# ──────────────────────────────────────────────────────────
@dataclass
class Swing:
    idx: int            # bar index (df의 위치)
    date: str           # ISO date
    price: float
    kind: Literal["high", "low"]


def zigzag(df: pd.DataFrame, threshold: float = 0.03) -> list[Swing]:
    """
    threshold (예: 0.03 = 3%) 이상의 변동만 swing으로 인정.
    DataFrame은 high, low, date 컬럼이 있어야 함. 인덱스는 정수 또는 reset_index 권장.
    반환: 시간순 swing 리스트.
    """
    if len(df) < 3:
        return []

    highs = df["high"].values
    lows = df["low"].values
    dates = df["date"].astype(str).values

    swings: list[Swing] = []
    # 초기 방향 결정
    direction: Literal["up", "down"] = "up" if highs[1] > highs[0] else "down"
    last_pivot_idx = 0
    last_pivot_price = lows[0] if direction == "up" else highs[0]
    last_pivot_kind: Literal["high", "low"] = "low" if direction == "up" else "high"

    for i in range(1, len(df)):
        if direction == "up":
            # 신고가 갱신
            if highs[i] > (
                last_pivot_price + abs(last_pivot_price) * 1e-12
                if last_pivot_kind == "high"
                else highs[i]
            ):
                pass  # noop
            if last_pivot_kind == "low":
                # 상승 중: 새 고가 갱신 또는 reversal 체크
                if highs[i] >= highs[last_pivot_idx + 1 :].max() if False else True:
                    pass
                # 단순화: 최근 swing low 대비 threshold만큼 올랐고, 이후 그 고점에서 threshold만큼 빠지면 swing high 확정
                # → 두 단계 검출
                pass

        # 단순 알고리즘으로 다시 정리 (위 잡음 제거)
    swings = _zigzag_simple(df, threshold)
    return swings


def _zigzag_simple(df: pd.DataFrame, threshold: float) -> list[Swing]:
    """알고리즘:
    - 첫 봉을 잠정 pivot으로 시작
    - 현재 방향 추적: 'up' / 'down'
    - up 일 때: 최고가를 갱신하며 따라가다가, high 대비 (1-threshold)배 아래로 종가가 떨어지면
      직전 최고가를 확정 swing high로 기록, 방향 down 전환, 그 봉부터 새 pivot tracking
    - down 도 대칭
    """
    n = len(df)
    if n < 3:
        return []

    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    dates = df["date"].astype(str).values

    swings: list[Swing] = []

    # 초기: 첫 봉을 잠정 시작점 (pivot 후보)
    # 방향 결정: 첫 N봉 중 최고/최저를 찾아 가장 이른 것이 시작 pivot
    init_window = min(10, n)
    if highs[:init_window].max() - lows[:init_window].min() < 1e-9:
        return []

    cur_high_idx = 0
    cur_high = highs[0]
    cur_low_idx = 0
    cur_low = lows[0]

    direction: Literal["up", "down"] | None = None

    for i in range(1, n):
        if highs[i] > cur_high:
            cur_high = highs[i]
            cur_high_idx = i
        if lows[i] < cur_low:
            cur_low = lows[i]
            cur_low_idx = i

        if direction is None:
            # 시작 방향 결정
            if (cur_high - lows[0]) / max(lows[0], 1e-9) >= threshold and cur_high_idx > 0:
                # 처음 swing low 확정 = 0, 방향 = up
                swings.append(Swing(idx=0, date=dates[0], price=lows[0], kind="low"))
                direction = "up"
            elif (highs[0] - cur_low) / max(highs[0], 1e-9) >= threshold and cur_low_idx > 0:
                swings.append(Swing(idx=0, date=dates[0], price=highs[0], kind="high"))
                direction = "down"
            continue

        if direction == "up":
            # 상승 중: 현재 high에서 threshold 이상 빠지면 reversal
            drop = (cur_high - lows[i]) / max(cur_high, 1e-9)
            if drop >= threshold and cur_high_idx < i:
                swings.append(
                    Swing(idx=cur_high_idx, date=dates[cur_high_idx], price=cur_high, kind="high")
                )
                direction = "down"
                cur_low = lows[i]
                cur_low_idx = i
        else:
            rise = (highs[i] - cur_low) / max(cur_low, 1e-9)
            if rise >= threshold and cur_low_idx < i:
                swings.append(
                    Swing(idx=cur_low_idx, date=dates[cur_low_idx], price=cur_low, kind="low")
                )
                direction = "up"
                cur_high = highs[i]
                cur_high_idx = i

    # 마지막 미확정 swing (현재 진행 중인 추세의 끝점)도 잠정 swing으로 추가
    if direction == "up" and (not swings or swings[-1].kind != "high"):
        swings.append(
            Swing(idx=cur_high_idx, date=dates[cur_high_idx], price=cur_high, kind="high")
        )
    elif direction == "down" and (not swings or swings[-1].kind != "low"):
        swings.append(Swing(idx=cur_low_idx, date=dates[cur_low_idx], price=cur_low, kind="low"))

    return swings


# ──────────────────────────────────────────────────────────
# 캔들 패턴 (단일봉)
# ──────────────────────────────────────────────────────────
@dataclass
class CandleSignal:
    kind: Literal[
        "DRAGONFLY_DOJI",
        "GRAVESTONE_DOJI",
        "LONG_LEGGED_DOJI",
        "STANDARD_DOJI",
        "HIGH_WAVE",
        "NONE",
    ]


def classify_candle(row: pd.Series, atr_val: float) -> CandleSignal:
    """단일 봉 분류. row: open/high/low/close, atr_val: 비교용 ATR"""
    o, h, l, c = float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"])
    rng = h - l
    if rng <= 0 or atr_val <= 0:
        return CandleSignal(kind="NONE")

    body = abs(c - o)
    upper = h - max(o, c)
    lower = min(o, c) - l

    body_pct = body / rng
    upper_pct = upper / rng
    lower_pct = lower / rng

    big_enough = rng >= atr_val * 0.5

    # Doji: body 거의 없음
    if body_pct <= 0.05 and big_enough:
        if upper_pct <= 0.05 and lower_pct >= 0.70:
            return CandleSignal(kind="DRAGONFLY_DOJI")
        if lower_pct <= 0.05 and upper_pct >= 0.70:
            return CandleSignal(kind="GRAVESTONE_DOJI")
        if upper_pct >= 0.40 and lower_pct >= 0.40:
            return CandleSignal(kind="LONG_LEGGED_DOJI")
        return CandleSignal(kind="STANDARD_DOJI")

    # High Wave: body 작음 (10~30%), 양쪽 꼬리 큼, ATR 1.5배 이상
    if (
        0.10 <= body_pct <= 0.30
        and upper >= body * 3
        and lower >= body * 3
        and rng >= atr_val * 1.5
    ):
        return CandleSignal(kind="HIGH_WAVE")

    return CandleSignal(kind="NONE")
