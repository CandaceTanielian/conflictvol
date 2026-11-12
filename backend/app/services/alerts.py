"""Alert evaluation (Configure Volatility Alerts / Receive Alert Notification)."""
import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Alert, Notification, User

log = logging.getLogger("conflictvol.alerts")

METRIC_LABELS = {
    "vol_1d": "1-day projected volatility",
    "vol_1w": "1-week projected volatility",
    "vol_1m": "1-month projected volatility",
    "cri": "Conflict Risk Index",
    "exposure": "sector exposure score",
}


def metric_value(alert: Alert, snap: dict) -> float | None:
    if alert.metric.startswith("vol_"):
        key = alert.metric.split("_")[1]
        h = next((h for h in snap["horizons"] if h["horizon"] == key), None)
        return h["vol"] if h else None
    if alert.metric == "cri":
        return snap["cri"]
    if alert.metric == "exposure":
        row = next((s for s in snap["sectors"] if s["sector"] == alert.target), None)
        return row["exposure"] if row else None
    return None


def condition_met(alert: Alert, value: float) -> bool:
    return value > alert.threshold if alert.operator == "above" else value < alert.threshold


def evaluate_alert(db: Session, alert: Alert, snap: dict, force: bool = False) -> Notification | None:
    value = metric_value(alert, snap)
    if value is None or not alert.active:
        return None
    met = condition_met(alert, value)
    fired = None
    # Fire on the crossing (false -> true), not on every refresh while above.
    if met and (not alert.last_state or force):
        fired = _notify(db, alert, value, snap)
        alert.last_triggered_at = datetime.now(timezone.utc)
    alert.last_state = met
    alert.last_value = value
    return fired


def evaluate_all(db: Session, snap: dict) -> int:
    count = 0
    for alert in db.scalars(select(Alert).where(Alert.active.is_(True))):
        if evaluate_alert(db, alert, snap):
            count += 1
    db.commit()
    return count


def _notify(db: Session, alert: Alert, value: float, snap: dict) -> Notification:
    metric = METRIC_LABELS.get(alert.metric, alert.metric)
    subject = alert.target if alert.metric == "exposure" else "S&P 500"
    word = "rose above" if alert.operator == "above" else "fell below"
    unit = "%" if alert.metric.startswith("vol_") else ""
    title = f"{alert.name}: {subject} {metric} {word} {alert.threshold:g}{unit}"
    top = snap["scored"][0].event.title if snap["scored"] else "current conflict activity"
    exposed = ", ".join(s["sector"] for s in snap["sectors"][:2])
    body = (
        f"Now at {value:g}{unit} (threshold {alert.threshold:g}{unit}). "
        f"Conflict Risk Index {snap['cri']} ({snap['cri_label']}). Leading driver: {top}. "
        f"Most exposed sectors: {exposed}."
    )
    over = abs(value - alert.threshold) / max(alert.threshold, 1)
    level = "critical" if over > 0.2 else "warning"
    delivered = "in_app"
    if alert.channel == "email" and alert.user.email_alerts:
        delivered = send_email(alert.user, title, body)
    n = Notification(user_id=alert.user_id, alert_id=alert.id, title=title, body=body, level=level,
                     channel=alert.channel, delivered=delivered)
    db.add(n)
    return n


def send_email(user: User, subject: str, body: str) -> str:
    """Notification Gateway. Sends via SMTP when configured; otherwise logs."""
    if not settings.smtp_host:
        log.info("[email simulated] to=%s subject=%s", user.email, subject)
        return "email (simulated)"
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.smtp_from, user.email, f"[ConflictVol] {subject}"
    msg.set_content(body + "\n\nManage alerts at https://conflictvol.app/alerts")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as s:
            s.starttls()
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password or "")
            s.send_message(msg)
        return "email"
    except Exception as exc:
        log.warning("SMTP send failed: %s", exc)
        return "email (failed)"
