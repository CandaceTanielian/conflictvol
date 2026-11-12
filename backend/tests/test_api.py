"""End-to-end API tests covering every customer-facing use case."""
import os
import tempfile

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import DEMO_EMAIL, DEMO_PASSWORD  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def demo(client):
    r = client.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"name": "Reim", "email": "reim@example.com", "password": "password123"})
    assert r.status_code == 201
    token = r.json()["access_token"]
    assert r.json()["user"]["effective_plan"] == "premium"  # trial
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "reim@example.com"
    dup = client.post("/api/auth/register", json={"name": "x", "email": "REIM@example.com", "password": "password123"})
    assert dup.status_code == 409
    bad = client.post("/api/auth/login", json={"email": "reim@example.com", "password": "wrong-pass"})
    assert bad.status_code == 401


def test_requires_auth(client):
    assert client.get("/api/dashboard").status_code == 401


def test_dashboard(client, demo):
    d = client.get("/api/dashboard", headers=demo).json()
    assert 0 <= d["cri"] <= 100
    assert [h["horizon"] for h in d["horizons"]] == ["1d", "1w", "1m"]
    for h in d["horizons"]:
        assert h["low"] <= h["vol"] <= h["high"]
    assert len(d["series"]) == 90 and len(d["forecast"]) == 21
    assert d["top_events"][0]["rank"] == 1


def test_events_filter_and_detail(client, demo):
    all_ev = client.get("/api/events", headers=demo).json()["events"]
    me = client.get("/api/events", params={"region": "Middle East"}, headers=demo).json()["events"]
    assert 0 < len(me) < len(all_ev) and all(e["region"] == "Middle East" for e in me)
    detail = client.get(f"/api/events/{all_ev[0]['id']}", headers=demo).json()
    assert detail["sector_impacts"] and detail["analogs"]
    assert any(e["deescalation"] for e in all_ev)
    assert client.get("/api/events/99999", headers=demo).status_code == 404


def test_exposure_rationale_archive(client, demo):
    ex = client.get("/api/exposure", headers=demo).json()
    assert len(ex["sectors"]) == 11 and ex["tickers"]
    r = client.get("/api/rationale", params={"horizon": "1m"}, headers=demo).json()
    assert r["headline"] and r["paragraphs"] and r["factors"][-1]["kind"] == "result"
    a = client.get("/api/archive", headers=demo).json()
    assert a["locked"] == 0 and a["episodes"] and a["current_analogs"]


def test_free_plan_gating(client):
    r = client.post("/api/auth/register", json={"name": "Free", "email": "free@example.com", "password": "password123"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.post("/api/account/plan", json={"plan": "free"}, headers=h)
    assert client.get("/api/exposure", headers=h).json()["tickers_locked"] is True
    assert client.get("/api/archive", headers=h).json()["locked"] > 0
    ok = client.post("/api/alerts", json={"name": "a", "metric": "cri", "threshold": 50}, headers=h)
    assert ok.status_code == 201
    blocked = client.post("/api/alerts", json={"name": "b", "metric": "cri", "threshold": 60}, headers=h)
    assert blocked.status_code == 402


def test_alert_crud_and_immediate_fire(client, demo):
    cur = client.get("/api/alerts", headers=demo).json()["current"]
    r = client.post("/api/alerts", headers=demo, json={
        "name": "Already high", "metric": "cri", "operator": "above", "threshold": max(1, cur["cri"] - 5)})
    assert r.status_code == 201 and r.json()["fired_now"] is True
    aid = r.json()["alert"]["id"]
    p = client.patch(f"/api/alerts/{aid}", json={"active": False}, headers=demo)
    assert p.json()["alert"]["active"] is False
    assert client.post(f"/api/alerts/{aid}/test", headers=demo).json()["ok"]
    assert client.delete(f"/api/alerts/{aid}", headers=demo).status_code == 204
    bad = client.post("/api/alerts", headers=demo, json={"name": "x", "metric": "exposure", "target": "Nope", "threshold": 5})
    assert bad.status_code == 422


def test_refresh_ingests_and_triggers_alerts(client, demo):
    before = client.get("/api/notifications", headers=demo).json()["unread"]
    r = client.post("/api/data/refresh", headers=demo).json()
    assert r["ingested"] and r["cri_after"] >= r["cri_before"]
    assert r["alerts_triggered"] >= 1
    after = client.get("/api/notifications", headers=demo).json()
    assert after["unread"] > before
    client.post("/api/notifications/read-all", headers=demo)
    assert client.get("/api/notifications", headers=demo).json()["unread"] == 0


def test_account_update(client, demo):
    r = client.patch("/api/account", json={"name": "Demo Investor", "email_alerts": False}, headers=demo)
    assert r.json()["email_alerts"] is False


def test_event_cards_have_feed_fields(client, demo):
    ev = client.get("/api/events", headers=demo).json()["events"]
    e = ev[0]
    assert e["level"] in ("HIGH", "WATCH", "LOW") and e["companies"] and e["market_effect"] and e["sectors"]
    high = client.get("/api/events", params={"level": "high"}, headers=demo).json()["events"]
    assert high and all(x["level"] == "HIGH" for x in high)
    assert any(x["followed_tickers"] for x in ev)  # demo user follows XOM/LMT/DAL/NVDA


def test_projection_desk(client, demo):
    desk = client.get("/api/dashboard", headers=demo).json()["desk"]
    assert desk["posture"]["bear_pct"] + desk["posture"]["bull_pct"] == 100
    assert 30 <= desk["confidence"] <= 95 and len(desk["tips"]) == 3


def test_watchlist_crud(client):
    r = client.post("/api/auth/register", json={"name": "Alex", "email": "alex@example.com", "password": "password123"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/watchlist", headers=h).json()["items"] == []
    w = client.post("/api/watchlist/xom", headers=h).json()
    assert [i["ticker"] for i in w["items"]] == ["XOM"] and w["items"][0]["events"]
    w = client.put("/api/watchlist", json={"tickers": ["LMT", "NVDA"]}, headers=h).json()
    assert [i["ticker"] for i in w["items"]] == ["LMT", "NVDA"]
    assert client.put("/api/watchlist", json={"tickers": ["NOPE"]}, headers=h).status_code == 422
    w = client.delete("/api/watchlist/LMT", headers=h).json()
    assert [i["ticker"] for i in w["items"]] == ["NVDA"]
    assert client.post("/api/watchlist/ZZZZ", headers=h).status_code == 404
