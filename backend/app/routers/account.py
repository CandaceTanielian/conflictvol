"""Account settings, plan selection, and the data refresh (ingest) trigger."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import AccountPatch, PlanIn
from ..security import get_current_user
from ..services.alerts import evaluate_all
from ..services.feeds import ingest, source_status
from ..services.snapshot import build_snapshot
from .auth import user_view

router = APIRouter(prefix="/api", tags=["account"])


@router.patch("/account")
def update_account(body: AccountPatch, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.name is not None:
        user.name = body.name.strip()
    if body.email_alerts is not None:
        user.email_alerts = body.email_alerts
    db.commit()
    return user_view(user)


@router.post("/account/plan")
def change_plan(body: PlanIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Payment processing is out of scope for v1; plan changes apply immediately.
    user.plan = body.plan
    db.commit()
    return user_view(user)


@router.get("/data/status")
def data_status(user: User = Depends(get_current_user)):
    return {"sources": source_status()}


@router.post("/data/refresh")
def refresh(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Ingest new data, regenerate the projection, and evaluate every active alert."""
    before = build_snapshot(db)
    new_events = ingest(db)
    after = build_snapshot(db)
    triggered = evaluate_all(db, after)
    return {
        "ingested": [{"id": e.id, "title": e.title, "region": e.region} for e in new_events],
        "cri_before": before["cri"],
        "cri_after": after["cri"],
        "vol_1w_before": next(h["vol"] for h in before["horizons"] if h["horizon"] == "1w"),
        "vol_1w_after": next(h["vol"] for h in after["horizons"] if h["horizon"] == "1w"),
        "alerts_triggered": triggered,
        "feed_empty": not new_events,
    }
