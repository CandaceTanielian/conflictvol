"""UCs: Configure Volatility Alerts, Receive Alert Notification."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Alert, Notification, User
from ..schemas import AlertIn, AlertPatch
from ..security import effective_plan, get_current_user
from ..services.alerts import METRIC_LABELS, condition_met, evaluate_alert, metric_value
from ..services.exposure import SECTORS
from ..services.snapshot import build_snapshot

router = APIRouter(prefix="/api", tags=["alerts"])

FREE_ALERT_LIMIT = 1


def alert_view(a: Alert, snap: dict | None = None) -> dict:
    current = metric_value(a, snap) if snap else a.last_value
    return {
        "id": a.id, "name": a.name, "target": a.target, "metric": a.metric,
        "metric_label": METRIC_LABELS.get(a.metric, a.metric), "operator": a.operator,
        "threshold": a.threshold, "channel": a.channel, "active": a.active,
        "current_value": current,
        "triggered": bool(current is not None and condition_met(a, current)),
        "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _own(db: Session, user: User, alert_id: int) -> Alert:
    a = db.get(Alert, alert_id)
    if not a or a.user_id != user.id:
        raise HTTPException(404, "Alert not found.")
    return a


@router.get("/alerts")
def list_alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    snap = build_snapshot(db)
    alerts = db.scalars(select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at)).all()
    plan = effective_plan(user)
    return {
        "alerts": [alert_view(a, snap) for a in alerts],
        "options": {"sectors": SECTORS, "metrics": METRIC_LABELS},
        "limit": None if plan == "premium" else FREE_ALERT_LIMIT,
        "current": {"cri": snap["cri"], **{f"vol_{h['horizon']}": h["vol"] for h in snap["horizons"]},
                    "exposure": {s["sector"]: s["exposure"] for s in snap["sectors"]}},
    }


@router.post("/alerts", status_code=201)
def create_alert(body: AlertIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if effective_plan(user) != "premium":
        count = len(db.scalars(select(Alert.id).where(Alert.user_id == user.id)).all())
        if count >= FREE_ALERT_LIMIT:
            raise HTTPException(402, "The Free plan includes one alert. Upgrade to Premium for unlimited custom alerts.")
    if body.metric == "exposure" and body.target not in SECTORS:
        raise HTTPException(422, "Choose a sector for exposure alerts.")
    target = body.target if body.metric == "exposure" else "S&P 500"
    a = Alert(user_id=user.id, name=body.name.strip(), target=target, metric=body.metric, operator=body.operator,
              threshold=body.threshold, channel=body.channel, active=body.active)
    db.add(a)
    db.flush()
    snap = build_snapshot(db)
    fired = evaluate_alert(db, a, snap)  # notify right away if already past the threshold
    db.commit()
    db.refresh(a)
    return {"alert": alert_view(a, snap), "fired_now": fired is not None}


@router.patch("/alerts/{alert_id}")
def update_alert(alert_id: int, body: AlertPatch, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = _own(db, user, alert_id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(a, field, value)
    snap = build_snapshot(db)
    a.last_state = False if (body.threshold is not None or body.operator is not None or body.active) else a.last_state
    fired = evaluate_alert(db, a, snap)
    db.commit()
    return {"alert": alert_view(a, snap), "fired_now": fired is not None}


@router.delete("/alerts/{alert_id}", status_code=204)
def delete_alert(alert_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_own(db, user, alert_id))
    db.commit()


@router.post("/alerts/{alert_id}/test")
def test_alert(alert_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = _own(db, user, alert_id)
    snap = build_snapshot(db)
    value = metric_value(a, snap)
    n = Notification(user_id=user.id, alert_id=a.id, title=f"Test: {a.name}",
                     body=f"This is a test notification. Current value: {value}. Threshold: {a.operator} {a.threshold:g}.",
                     level="info", channel=a.channel,
                     delivered="email (simulated)" if a.channel == "email" else "in_app")
    db.add(n)
    db.commit()
    return {"ok": True}


@router.get("/notifications")
def notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id)
                      .order_by(Notification.created_at.desc()).limit(100)).all()
    return {
        "notifications": [{
            "id": n.id, "alert_id": n.alert_id, "title": n.title, "body": n.body, "level": n.level,
            "channel": n.channel, "delivered": n.delivered, "read": n.read, "created_at": n.created_at.isoformat(),
        } for n in rows],
        "unread": sum(1 for n in rows if not n.read),
    }


@router.post("/notifications/{nid}/read")
def mark_read(nid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, nid)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Notification not found.")
    n.read = True
    db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))):
        n.read = True
    db.commit()
    return {"ok": True}
