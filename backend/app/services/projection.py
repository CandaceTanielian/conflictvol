"""Short-term S&P 500 volatility projection.

Model (v1, intentionally transparent):
  projected_vol(h) = baseline(h) + conflict_premium(h)
  baseline(h)      = LR + (RV20 - LR) * phi^h          (GARCH-style mean reversion)
  conflict_premium = CRI * k_h                           (k decays with horizon)
  80% band         = point +/- 1.28 * point * (a + b*sqrt(h)) * (1 + CRI/200)

RV20 is the 20-trading-day realized volatility of the index, annualized.
"""
import math
from datetime import date, datetime, timedelta, timezone

import numpy as np

from .scoring import ScoredEvent, conflict_risk_index, score_events

LONG_RUN_VOL = 17.5
PHI = 0.94
HORIZONS = {"1d": (1, "1 Day", 0.12), "1w": (5, "1 Week", 0.10), "1m": (21, "1 Month", 0.07)}
PHRASE = {"1d": "Next-day", "1w": "1-week", "1m": "1-month"}


def regime(vol: float) -> str:
    if vol < 15:
        return "Calm"
    if vol < 22:
        return "Elevated"
    if vol < 30:
        return "High"
    return "Extreme"


def realized_vol_series(closes: list[float], window: int = 20) -> list[float | None]:
    arr = np.asarray(closes, dtype=float)
    rets = np.diff(np.log(arr))
    out: list[float | None] = [None] * len(arr)
    for i in range(window, len(arr)):
        out[i] = round(float(np.std(rets[i - window:i], ddof=1) * math.sqrt(252) * 100), 1)
    return out


def project(rv: float, cri: float, spot: float) -> list[dict]:
    rows = []
    for key, (h, label, k) in HORIZONS.items():
        base = LONG_RUN_VOL + (rv - LONG_RUN_VOL) * (PHI ** h)
        premium = cri * k
        point = base + premium
        unc = point * (0.06 + 0.025 * math.sqrt(h)) * (1 + cri / 200)
        low, high = max(5.0, point - 1.28 * unc), point + 1.28 * unc
        move = spot * (point / 100) * math.sqrt(h / 252)
        rows.append({
            "horizon": key,
            "label": label,
            "phrase": PHRASE[key],
            "days": h,
            "vol": round(point, 1),
            "low": round(low, 1),
            "high": round(high, 1),
            "baseline": round(base, 1),
            "conflict_premium": round(premium, 1),
            "change": round(point - rv, 1),
            "regime": regime(point),
            "expected_move_pct": round(100 * move / spot, 2),
            "expected_move_pts": round(move, 0),
        })
    return rows


def forecast_band(last_day: date, rv: float, cri: float, days: int = 21) -> list[dict]:
    """Day-by-day projected path for the chart."""
    out = []
    d = last_day
    for h in range(1, days + 1):
        d = _next_trading_day(d)
        k = 0.12 + (0.07 - 0.12) * (h - 1) / 20
        base = LONG_RUN_VOL + (rv - LONG_RUN_VOL) * (PHI ** h)
        point = base + cri * k
        unc = point * (0.06 + 0.025 * math.sqrt(h)) * (1 + cri / 200)
        out.append({
            "date": d.isoformat(),
            "point": round(point, 2),
            "low": round(max(5.0, point - 1.28 * unc), 2),
            "high": round(point + 1.28 * unc, 2),
        })
    return out


def cri_history(events, days: list[date]) -> list[float]:
    out = []
    for d in days:
        at = datetime(d.year, d.month, d.day, 21, 0, tzinfo=timezone.utc)
        visible = [e for e in events if _aware(e.occurred_at) <= at]
        out.append(conflict_risk_index(score_events(visible, at)))
    return out


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _next_trading_day(d: date) -> date:
    d = d + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def contributions(scored: list[ScoredEvent], premium: float, top: int = 5) -> list[dict]:
    pos = [s for s in scored if s.contribution > 0]
    total = sum(s.contribution for s in pos) or 1.0
    rows = []
    for s in scored[:top]:
        share = s.contribution / total if s.contribution > 0 else 0.0
        rows.append({
            "event_id": s.event.id,
            "title": s.event.title,
            "region": s.event.region,
            "severity": s.severity,
            "contribution": s.contribution,
            "vol_points": round(premium * share, 2) if s.contribution > 0 else round(-abs(s.contribution) * 0.1, 2),
        })
    return rows
