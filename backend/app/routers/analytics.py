"""UCs: View Volatility Projection Dashboard, Track Global Conflict Events,
View Sector/Ticker Exposure, View Projection Rationale, Browse Historical Archive."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, WatchItem
from ..security import effective_plan, get_current_user
from ..services.exposure import sector_impacts
from ..services.feeds import source_status
from ..services.rationale import find_analogs
from ..services.scoring import CATEGORY_LABELS, REGION_RELEVANCE
from ..services.snapshot import build_snapshot, event_card, projection_desk

router = APIRouter(prefix="/api", tags=["analytics"])

FREE_ARCHIVE_LIMIT = 3


def watch_tickers(user: User) -> list[str]:
    return [w.ticker for w in sorted(user.watchlist, key=lambda w: w.created_at or 0)]


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = build_snapshot(db)
    watch = watch_tickers(user)
    top_events = [event_card(x, i + 1, s, watch) for i, x in enumerate(s["scored"][:6])]
    return {
        "as_of": s["as_of"],
        "market_date": s["market_date"],
        "spot": s["spot"],
        "spot_change_pct": s["spot_change_pct"],
        "realized_vol": s["realized_vol"],
        "cri": s["cri"],
        "cri_label": s["cri_label"],
        "cri_change": round(s["cri"] - s["cri_prev"], 1),
        "horizons": s["horizons"],
        "series": s["series"],
        "forecast": s["forecast"],
        "top_events": top_events,
        "top_sectors": s["sectors"][:4],
        "headline": s["rationale"]["1w"]["headline"],
        "active_event_count": s["active_event_count"],
        "sources": source_status(),
        "plan": effective_plan(user),
        "desk": projection_desk(s),
    }


@router.get("/events")
def events(
    region: str | None = None,
    category: str | None = None,
    level: str | None = Query(default=None, pattern="^(?i)(high|watch|low)$"),
    min_severity: float | None = Query(default=None, ge=-5, le=10),
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = build_snapshot(db)
    watch = watch_tickers(user)
    rows = [event_card(x, i + 1, s, watch) for i, x in enumerate(s["scored"])]
    if region:
        rows = [r for r in rows if r["region"] == region]
    if category:
        rows = [r for r in rows if r["category"] == category]
    if level:
        rows = [r for r in rows if r["level"] == level.upper()]
    if min_severity is not None:
        rows = [r for r in rows if r["severity"] >= min_severity]
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in r["title"].lower() or ql in r["country"].lower() or ql in r["summary"].lower()]
    return {
        "events": rows,
        "cri": s["cri"],
        "filters": {"regions": sorted(REGION_RELEVANCE), "categories": CATEGORY_LABELS},
    }


@router.get("/events/{event_id}")
def event_detail(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = build_snapshot(db)
    match = next(((i, x) for i, x in enumerate(s["scored"]) if x.event.id == event_id), None)
    if not match:
        raise HTTPException(404, "That event is no longer in the active feed.")
    i, x = match
    view = event_card(x, i + 1, s, watch_tickers(user))
    view["analogs"] = find_analogs(x.event, x.severity, s["episodes"])
    total = sum(e.contribution for e in s["scored"] if e.contribution > 0) or 1
    view["share_of_premium"] = round(100 * max(0, x.contribution) / total, 1)
    return view


@router.get("/exposure")
def exposure(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = build_snapshot(db)
    premium = effective_plan(user) == "premium"
    return {
        "sectors": s["sectors"],
        "tickers": s["tickers"] if premium else [],
        "tickers_locked": not premium,
        "cri": s["cri"],
    }


@router.get("/rationale")
def rationale(horizon: str = Query("1w", pattern="^(1d|1w|1m)$"), db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    s = build_snapshot(db)
    r = s["rationale"][horizon]
    r["projection"] = next(h for h in s["horizons"] if h["horizon"] == horizon)
    r["realized_vol"] = s["realized_vol"]
    r["cri"] = s["cri"]
    return r


@router.get("/archive")
def archive(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = build_snapshot(db)
    premium = effective_plan(user) == "premium"
    eps = s["episodes"]
    rows = [{
        "id": e.id, "name": e.name, "start_date": e.start_date.isoformat(), "region": e.region,
        "category": e.category, "category_label": CATEGORY_LABELS.get(e.category, e.category),
        "peak_severity": e.peak_severity, "pre_vol": e.pre_vol, "peak_vol": e.peak_vol,
        "vol_change": round(e.peak_vol - e.pre_vol, 1), "days_to_peak": e.days_to_peak,
        "days_to_normalize": e.days_to_normalize, "sp_move_pct": e.sp_move_pct, "summary": e.summary,
        "sectors_hit": e.sectors_hit,
    } for e in eps]
    return {
        "episodes": rows if premium else rows[:FREE_ARCHIVE_LIMIT],
        "total": len(rows),
        "locked": 0 if premium else max(0, len(rows) - FREE_ARCHIVE_LIMIT),
        "current_analogs": s["analogs"],
        "current_top_event": s["scored"][0].event.title if s["scored"] else None,
        "note": "Historical figures are approximate (VIX-style index volatility) and shown for illustration.",
    }
