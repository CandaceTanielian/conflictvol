"""Watchlist ("followed companies"): tickers a user follows across the app."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, WatchItem
from ..security import get_current_user
from ..services.exposure import TICKER_INFO, sector_impacts
from ..services.snapshot import build_snapshot, level_for

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])
MAX_ITEMS = 25


class WatchlistIn(BaseModel):
    tickers: list[str] = Field(default_factory=list, max_length=MAX_ITEMS)


def watchlist_view(db: Session, user: User) -> dict:
    snap = build_snapshot(db)
    by_ticker = {t["ticker"]: t for t in snap["tickers"]}
    items = []
    for w in sorted(user.watchlist, key=lambda w: w.created_at or 0):
        info, t = TICKER_INFO.get(w.ticker), by_ticker.get(w.ticker)
        if not info or not t:
            continue
        related = []
        for s in snap["scored"]:
            sens = sector_impacts(s.event).get(info["sector"], {}).get("sensitivity", 0)
            if s.contribution > 0 and sens >= 0.4:
                related.append({"id": s.event.id, "title": s.event.title, "level": level_for(s.severity)})
        items.append({**info, "exposure": t["exposure"], "bias": t["bias"],
                      "level": "HIGH" if t["exposure"] >= 70 else "WATCH" if t["exposure"] >= 40 else "LOW",
                      "events": related[:3]})
    return {"items": items, "universe": sorted(TICKER_INFO.values(), key=lambda x: x["ticker"])}


@router.get("")
def get_watchlist(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return watchlist_view(db, user)


@router.put("")
def replace_watchlist(body: WatchlistIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tickers = list(dict.fromkeys(t.upper() for t in body.tickers))
    unknown = [t for t in tickers if t not in TICKER_INFO]
    if unknown:
        raise HTTPException(422, f"Unknown ticker: {', '.join(unknown)}")
    for w in list(user.watchlist):
        db.delete(w)
    db.flush()
    for t in tickers:
        db.add(WatchItem(user_id=user.id, ticker=t))
    db.commit()
    db.refresh(user)
    return watchlist_view(db, user)


@router.post("/{ticker}", status_code=201)
def follow(ticker: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = ticker.upper()
    if t not in TICKER_INFO:
        raise HTTPException(404, "That ticker isn't covered yet.")
    if not db.scalar(select(WatchItem).where(WatchItem.user_id == user.id, WatchItem.ticker == t)):
        if len(user.watchlist) >= MAX_ITEMS:
            raise HTTPException(422, f"Watchlists are limited to {MAX_ITEMS} tickers.")
        db.add(WatchItem(user_id=user.id, ticker=t))
        db.commit()
        db.refresh(user)
    return watchlist_view(db, user)


@router.delete("/{ticker}")
def unfollow(ticker: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    w = db.scalar(select(WatchItem).where(WatchItem.user_id == user.id, WatchItem.ticker == ticker.upper()))
    if w:
        db.delete(w)
        db.commit()
        db.refresh(user)
    return watchlist_view(db, user)
