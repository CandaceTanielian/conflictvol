"""Export API responses from a fresh backend into src/api/demo-data.json.

The static demo build replays these snapshots in the browser, so the hosted
demo shows exactly what the real FastAPI service returns.

    cd backend && python scripts/export_demo_data.py
"""
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import DEMO_EMAIL, DEMO_PASSWORD  # noqa: E402

OUT = ROOT.parent / "src" / "api" / "demo-data.json"
PENDING = 8  # queued events in the sample feed (see app/seed.py)


def main():
    with TestClient(app) as c:
        tok = c.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}).json()
        h = {"Authorization": f"Bearer {tok['access_token']}"}
        get = lambda path, **params: c.get(f"/api{path}", headers=h, params=params).json()  # noqa: E731

        alerts0 = get("/alerts")
        watch0 = get("/watchlist")
        notes0 = get("/notifications")
        snapshots, refresh = [], None
        for i in range(PENDING + 1):
            events = get("/events")
            snap = {
                "dashboard": get("/dashboard"),
                "events": events,
                "event_details": {str(e["id"]): get(f"/events/{e['id']}") for e in events["events"]},
                "exposure": get("/exposure"),
                "rationale": {hz: get("/rationale", horizon=hz) for hz in ("1d", "1w", "1m")},
                "archive": get("/archive"),
                "current": get("/alerts")["current"],
                "refresh": refresh,
            }
            snapshots.append(snap)
            if i < PENDING:
                refresh = c.post("/api/data/refresh", headers=h).json()

        user = tok["user"]
        data = {
            "demo_password": DEMO_PASSWORD,
            "demo_user": {k: user[k] for k in ("name", "email", "plan", "email_alerts", "created_at")},
            "alerts": [{k: a[k] for k in ("id", "name", "target", "metric", "operator", "threshold", "channel", "active",
                                          "last_triggered_at", "created_at")} for a in alerts0["alerts"]],
            "notifications": [{k: n[k] for k in ("id", "alert_id", "title", "body", "level", "channel", "delivered", "read",
                                                 "created_at")} for n in notes0["notifications"]],
            "options": alerts0["options"],
            "watchlist": [i["ticker"] for i in watch0["items"]],
            "universe": watch0["universe"],
            "snapshots": snapshots,
        }
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB, {len(snapshots)} snapshots)")


if __name__ == "__main__":
    main()
