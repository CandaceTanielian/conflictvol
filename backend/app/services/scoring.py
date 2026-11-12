"""Conflict event scoring (severity, market relevance, recency) and the
Conflict Risk Index (CRI) that feeds the volatility projection."""
import math
from dataclasses import dataclass
from datetime import datetime, timezone

CATEGORY_LABELS = {
    "armed_clash": "Armed clash",
    "missile_strike": "Missile strike",
    "drone_strike": "Drone strike",
    "naval_incident": "Naval incident",
    "sanctions": "Sanctions",
    "military_exercise": "Military exercise",
    "cyberattack": "Cyberattack",
    "terror_attack": "Terror attack",
    "invasion": "Invasion",
    "ceasefire": "Ceasefire",
    "peace_talks": "Peace talks",
}

CATEGORY_BASE = {
    "armed_clash": 5.0,
    "missile_strike": 6.5,
    "drone_strike": 5.5,
    "naval_incident": 6.0,
    "sanctions": 4.5,
    "military_exercise": 3.0,
    "cyberattack": 4.0,
    "terror_attack": 6.0,
    "invasion": 8.5,
    "ceasefire": -3.0,
    "peace_talks": -2.0,
}

SCOPE_MULT = {"local": 0.8, "regional": 1.0, "global": 1.3}

# How strongly conflict in a region has historically moved US large-cap volatility
# (oil supply, semiconductor supply chain, European demand, etc.).
REGION_RELEVANCE = {
    "Middle East": 1.2,
    "East Asia": 1.3,
    "Eastern Europe": 1.1,
    "South Asia": 0.8,
    "Africa": 0.6,
    "Latin America": 0.6,
    "Global": 1.0,
    "North America": 1.0,
    "Western Europe": 0.9,
}

HALF_LIFE_DAYS = 7.0


def is_deescalation(category: str) -> bool:
    return CATEGORY_BASE.get(category, 0) < 0


def severity(event) -> float:
    """Severity on a -5..10 scale. Negative values are de-escalation signals."""
    base = CATEGORY_BASE.get(event.category, 4.0)
    if base < 0:
        return round(max(-5.0, base * SCOPE_MULT.get(event.scope, 1.0)), 1)
    score = base * SCOPE_MULT.get(event.scope, 1.0)
    if event.escalating:
        score += 1.5
    if event.chokepoint:
        score += 1.5
    if event.fatalities:
        score += min(2.0, math.log10(1 + event.fatalities) * 0.8)
    return round(min(10.0, score), 1)


def relevance(event) -> float:
    return REGION_RELEVANCE.get(event.region, 0.8)


def age_days(event, now: datetime) -> float:
    occurred = event.occurred_at
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=timezone.utc)
    return max(0.0, (now - occurred).total_seconds() / 86400)


def recency_weight(event, now: datetime) -> float:
    return math.exp(-math.log(2) * age_days(event, now) / HALF_LIFE_DAYS)


@dataclass
class ScoredEvent:
    event: object
    severity: float
    relevance: float
    recency: float
    contribution: float  # severity x relevance x recency (signed)


def score_events(events, now: datetime | None = None) -> list[ScoredEvent]:
    now = now or datetime.now(timezone.utc)
    out = []
    for e in events:
        s = severity(e)
        r = relevance(e)
        w = recency_weight(e, now)
        out.append(ScoredEvent(e, s, r, round(w, 3), round(s * r * w, 3)))
    out.sort(key=lambda x: abs(x.contribution), reverse=True)
    return out


def conflict_risk_index(scored: list[ScoredEvent]) -> float:
    """Squash the summed contributions into a 0-100 index."""
    raw = sum(s.contribution for s in scored)
    return round(100 * math.tanh(max(raw, 0.0) / 70.0), 1)


def cri_label(cri: float) -> str:
    if cri < 25:
        return "Low"
    if cri < 50:
        return "Moderate"
    if cri < 75:
        return "High"
    return "Severe"
