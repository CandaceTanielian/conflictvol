"""External system adapters (Conflict-Monitoring API, Market-Data API).

When API keys are configured, `ingest()` pulls from the live providers.
Without keys, it promotes queued events from the bundled sample feed so the
full ingest -> score -> project -> alert loop can be demonstrated offline.
"""
import logging
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import ConflictEvent, MarketBar

log = logging.getLogger("conflictvol.feeds")

ACLED_URL = "https://api.acleddata.com/acled/read"
ALPHAVANTAGE_URL = "https://www.alphavantage.co/query"

# ACLED event_type / sub_event_type -> ConflictVol category
ACLED_MAP = {
    "Battles": "armed_clash",
    "Explosions/Remote violence": "missile_strike",
    "Violence against civilians": "terror_attack",
    "Strategic developments": "military_exercise",
}
ACLED_REGION = {
    "Middle East": "Middle East", "Eastern Europe": "Eastern Europe", "East Asia": "East Asia",
    "South Asia": "South Asia", "Southeast Asia": "East Asia", "Northern Africa": "Africa",
    "Eastern Africa": "Africa", "Western Africa": "Africa", "Middle Africa": "Africa",
    "Southern Africa": "Africa", "South America": "Latin America", "Central America": "Latin America",
    "Caribbean": "Latin America", "Europe": "Western Europe", "North America": "North America",
}


def source_status() -> list[dict]:
    return [
        {"name": "Conflict-Monitoring API", "provider": "ACLED" if settings.acled_api_key else "Sample feed",
         "mode": "live" if settings.acled_api_key else "sample"},
        {"name": "Market-Data API", "provider": "Alpha Vantage" if settings.alphavantage_api_key else "Sample feed",
         "mode": "live" if settings.alphavantage_api_key else "sample"},
        {"name": "Notification Gateway", "provider": "SMTP" if settings.smtp_host else "Logged (no SMTP)",
         "mode": "live" if settings.smtp_host else "sample"},
    ]


def ingest(db: Session) -> list[ConflictEvent]:
    """Ingest Conflict Event Data + Ingest Market Price Data."""
    new_events: list[ConflictEvent] = []
    if settings.acled_api_key and settings.acled_email:
        try:
            new_events = _ingest_acled(db)
        except Exception as exc:  # network/provider failure must not break the app
            log.warning("ACLED ingest failed, falling back to sample feed: %s", exc)
    if not new_events:
        new_events = _promote_sample(db)
    if settings.alphavantage_api_key:
        try:
            _ingest_alphavantage(db)
        except Exception as exc:
            log.warning("Alpha Vantage ingest failed: %s", exc)
    db.commit()
    return new_events


def _promote_sample(db: Session, batch: int = 1) -> list[ConflictEvent]:
    pending = list(db.scalars(
        select(ConflictEvent).where(ConflictEvent.status == "pending").order_by(ConflictEvent.id).limit(batch)
    ))
    now = datetime.now(timezone.utc)
    for e in pending:
        e.status = "active"
        e.occurred_at = now - timedelta(minutes=20)
        e.ingested_at = now
    return pending


def _ingest_acled(db: Session) -> list[ConflictEvent]:
    since = (date.today() - timedelta(days=3)).isoformat()
    params = {
        "key": settings.acled_api_key, "email": settings.acled_email,
        "event_date": since, "event_date_where": ">=", "limit": 200,
    }
    resp = httpx.get(ACLED_URL, params=params, timeout=20)
    resp.raise_for_status()
    out = []
    for row in resp.json().get("data", []):
        ext = f"acled-{row['event_id_cnty']}"
        if db.scalar(select(ConflictEvent).where(ConflictEvent.external_id == ext)):
            continue
        fat = int(row.get("fatalities") or 0)
        e = ConflictEvent(
            external_id=ext,
            title=f"{row.get('sub_event_type', 'Event')} in {row.get('admin1') or row.get('country')}",
            summary=(row.get("notes") or "")[:1000],
            region=ACLED_REGION.get(row.get("region", ""), "Global"),
            country=row.get("country", ""),
            lat=float(row.get("latitude") or 0), lon=float(row.get("longitude") or 0),
            category=ACLED_MAP.get(row.get("event_type", ""), "armed_clash"),
            fatalities=fat, scope="regional" if fat >= 10 else "local",
            escalating=fat >= 25, chokepoint=False, source="ACLED",
            occurred_at=datetime.fromisoformat(row["event_date"]).replace(tzinfo=timezone.utc),
            ingested_at=datetime.now(timezone.utc), status="active",
        )
        db.add(e)
        out.append(e)
    return out


def _ingest_alphavantage(db: Session) -> None:
    params = {"function": "TIME_SERIES_DAILY", "symbol": "SPY", "apikey": settings.alphavantage_api_key}
    resp = httpx.get(ALPHAVANTAGE_URL, params=params, timeout=20)
    resp.raise_for_status()
    series = resp.json().get("Time Series (Daily)", {})
    # SPY trades at ~1/10 of the index level; scale so the dashboard reads in index points.
    existing = {b.day for b in db.scalars(select(MarketBar).where(MarketBar.symbol == "SPX"))}
    for day_str, row in series.items():
        d = date.fromisoformat(day_str)
        if d not in existing:
            db.add(MarketBar(symbol="SPX", day=d, close=float(row["4. close"]) * 10))
