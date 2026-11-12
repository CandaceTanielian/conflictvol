"""Composes the full analytics picture (Business tier) from stored data.

Every customer-facing endpoint reads from one snapshot so the dashboard,
rationale, exposure and alerts always agree with each other.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ArchiveEpisode, ConflictEvent, MarketBar
from . import exposure as exp
from .projection import (contributions, cri_history, forecast_band, project,
                         realized_vol_series)
from .rationale import build_rationale, find_analogs
from .scoring import CATEGORY_LABELS, conflict_risk_index, cri_label, score_events


def active_events(db: Session) -> list[ConflictEvent]:
    return list(db.scalars(select(ConflictEvent).where(ConflictEvent.status == "active")))


def build_snapshot(db: Session, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    events = active_events(db)
    bars = list(db.scalars(select(MarketBar).where(MarketBar.symbol == "SPX").order_by(MarketBar.day)))
    episodes = list(db.scalars(select(ArchiveEpisode).order_by(ArchiveEpisode.start_date.desc())))

    scored = score_events(events, now)
    cri = conflict_risk_index(scored)
    closes = [b.close for b in bars]
    rv_series = realized_vol_series(closes)
    rv = rv_series[-1] if rv_series and rv_series[-1] is not None else 17.5
    spot = closes[-1] if closes else 0.0
    prev = closes[-2] if len(closes) > 1 else spot

    horizons = project(rv, cri, spot)
    sectors = exp.sector_exposure(scored)
    tickers = exp.ticker_exposure(sectors)

    # History for the chart: last 90 trading days.
    tail = bars[-90:]
    tail_days = [b.day for b in tail]
    cri_hist = cri_history(events, tail_days)
    series = [
        {"date": b.day.isoformat(), "close": round(b.close, 2), "realized_vol": rv_series[len(bars) - len(tail) + i],
         "cri": cri_hist[i]}
        for i, b in enumerate(tail)
    ]
    band = forecast_band(bars[-1].day, rv, cri) if bars else []

    top = scored[0] if scored else None
    analogs = find_analogs(top.event, top.severity, episodes) if top else []

    def rationale_for(h: dict) -> dict:
        drivers = contributions(scored, h["conflict_premium"])
        return build_rationale(h, rv, cri, drivers, sectors, analogs[0] if analogs else None, scored)

    return {
        "as_of": now.isoformat(),
        "market_date": bars[-1].day.isoformat() if bars else None,
        "spot": round(spot, 2),
        "spot_change_pct": round(100 * (spot - prev) / prev, 2) if prev else 0.0,
        "realized_vol": rv,
        "cri": cri,
        "cri_label": cri_label(cri),
        "cri_prev": cri_hist[-6] if len(cri_hist) > 6 else cri,
        "horizons": horizons,
        "series": series,
        "forecast": band,
        "scored": scored,
        "sectors": sectors,
        "tickers": tickers,
        "analogs": analogs,
        "episodes": episodes,
        "rationale": {h["horizon"]: rationale_for(h) for h in horizons},
        "active_event_count": len(events),
    }


def event_view(s, rank: int | None = None) -> dict:
    e = s.event
    return {
        "id": e.id,
        "title": e.title,
        "summary": e.summary,
        "region": e.region,
        "country": e.country,
        "lat": e.lat,
        "lon": e.lon,
        "category": e.category,
        "category_label": CATEGORY_LABELS.get(e.category, e.category),
        "fatalities": e.fatalities,
        "scope": e.scope,
        "escalating": e.escalating,
        "chokepoint": e.chokepoint,
        "source": e.source,
        "occurred_at": e.occurred_at.isoformat(),
        "severity": s.severity,
        "relevance": s.relevance,
        "recency": s.recency,
        "contribution": s.contribution,
        "deescalation": s.severity < 0,
        "rank": rank,
    }


def level_for(severity: float) -> str:
    if severity >= 7.5:
        return "HIGH"
    if severity >= 4:
        return "WATCH"
    return "LOW"


def event_card(s, rank: int, snap: dict, watch: list[str] | None = None) -> dict:
    """Event view enriched for the conflict feed: level, sectors, companies, market transmission."""
    view = event_view(s, rank)
    impacts = exp.sector_impacts(s.event)
    deesc = s.severity < 0
    top_sectors = [k for k, v in impacts.items() if v["sensitivity"] >= 0.3][:3]
    companies = []
    for sector in top_sectors:
        best = max((t for t in snap["tickers"] if t["sector"] == sector), key=lambda t: t["exposure"], default=None)
        if best:
            companies.append(best["ticker"])
    pos_total = sum(x.contribution for x in snap["scored"] if x.contribution > 0) or 1.0
    premium_1w = next(h["conflict_premium"] for h in snap["horizons"] if h["horizon"] == "1w")
    view.update({
        "level": level_for(s.severity),
        "sectors": top_sectors,
        "sector_impacts": impacts,
        "companies": companies,
        "market_effect": exp.market_transmission(s.event, deesc),
        "vol_points": round(premium_1w * s.contribution / pos_total, 2) if s.contribution > 0 else round(s.contribution * 0.1, 2),
        "followed_tickers": exp.followed_in(impacts, watch or []),
    })
    return view


def projection_desk(snap: dict) -> dict:
    """Projection desk summary: risk posture, confidence, risk window, risk-management ideas."""
    wk = next(h for h in snap["horizons"] if h["horizon"] == "1w")
    cri = snap["cri"]
    bear = int(max(10, min(90, round(50 + 0.45 * (cri - 40) + 2.5 * wk["change"]))))
    label = "Defensive" if bear >= 60 else "Constructive" if bear <= 40 else "Neutral"
    confidence = int(max(30, min(95, round(100 * (1 - (wk["high"] - wk["low"]) / (2 * wk["vol"]))))))
    move = abs(wk["baseline"] - snap["realized_vol"]) + max(wk["conflict_premium"], 0)
    premium_share = round(100 * max(wk["conflict_premium"], 0) / move) if move else 0
    top = snap["scored"][0] if snap["scored"] else None
    fresh = top is not None and _age_days(top.event) < 3 and (top.event.escalating or top.event.chokepoint)
    exposed = [x["sector"] for x in snap["sectors"][:2]]
    defensive = label == "Defensive" or wk["regime"] in ("High", "Extreme")
    tips = [
        "Consider defined-risk hedges rather than adding directional size while the conflict premium is elevated."
        if defensive else "Volatility is close to normal levels, so position sizing can stay near your usual plan.",
        f"Keep {' and '.join(exposed)} positions on a tighter risk budget; they are the most sensitive channels right now."
        if exposed else "No sector stands out; broad index exposure carries most of the risk.",
        f"Reassess after the next update on \"{top.event.title}\"." if top else "Reassess after the next data refresh.",
    ]
    return {
        "posture": {"label": label, "bear_pct": bear, "bull_pct": 100 - bear},
        "confidence": confidence,
        "premium_share": premium_share,
        "risk_window": "48-72 hours" if fresh else "Next 5 trading days",
        "risk_window_note": "Watch for follow-up headlines on the lead event." if fresh else "No single event dominates the near-term window.",
        "tips": tips,
        "disclaimer": "Educational risk-management ideas, not investment advice.",
    }


def _age_days(event) -> float:
    occurred = event.occurred_at if event.occurred_at.tzinfo else event.occurred_at.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - occurred).total_seconds() / 86400
