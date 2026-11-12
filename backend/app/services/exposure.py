"""Sector and ticker exposure to the current conflict landscape."""
from collections import defaultdict

from .scoring import ScoredEvent

SECTORS = [
    "Energy",
    "Materials",
    "Industrials",
    "Consumer Discretionary",
    "Consumer Staples",
    "Health Care",
    "Financials",
    "Information Technology",
    "Communication Services",
    "Utilities",
    "Real Estate",
]

# Representative S&P 500 constituents with a relative sensitivity multiplier.
TICKERS = {
    "Energy": [("XOM", "Exxon Mobil", 1.0), ("CVX", "Chevron", 0.95), ("COP", "ConocoPhillips", 1.1), ("OXY", "Occidental", 1.2)],
    "Materials": [("FCX", "Freeport-McMoRan", 1.2), ("NEM", "Newmont", 0.9), ("LIN", "Linde", 0.6)],
    "Industrials": [("LMT", "Lockheed Martin", 1.2), ("RTX", "RTX Corp", 1.15), ("NOC", "Northrop Grumman", 1.15), ("DAL", "Delta Air Lines", 1.3), ("UAL", "United Airlines", 1.35)],
    "Consumer Discretionary": [("AMZN", "Amazon", 0.8), ("TSLA", "Tesla", 1.2), ("NKE", "Nike", 0.9), ("CCL", "Carnival", 1.3)],
    "Consumer Staples": [("PG", "Procter & Gamble", 0.6), ("KO", "Coca-Cola", 0.6), ("WMT", "Walmart", 0.7)],
    "Health Care": [("UNH", "UnitedHealth", 0.6), ("JNJ", "Johnson & Johnson", 0.5), ("LLY", "Eli Lilly", 0.7)],
    "Financials": [("JPM", "JPMorgan Chase", 0.9), ("GS", "Goldman Sachs", 1.1), ("BAC", "Bank of America", 1.0)],
    "Information Technology": [("NVDA", "NVIDIA", 1.3), ("AMD", "AMD", 1.3), ("AAPL", "Apple", 1.0), ("QCOM", "Qualcomm", 1.2)],
    "Communication Services": [("GOOGL", "Alphabet", 0.9), ("META", "Meta Platforms", 1.0), ("NFLX", "Netflix", 0.8)],
    "Utilities": [("NEE", "NextEra Energy", 0.7), ("DUK", "Duke Energy", 0.6)],
    "Real Estate": [("PLD", "Prologis", 0.9), ("AMT", "American Tower", 0.7)],
}

# Driver profiles: sector -> (sensitivity 0..1, direction) where direction is
# +1 (tailwind: sector tends to benefit) or -1 (headwind).
PROFILES = {
    "oil_supply": {
        "Energy": (0.95, 1), "Industrials": (0.55, -1), "Consumer Discretionary": (0.5, -1),
        "Materials": (0.35, 1), "Utilities": (0.25, -1), "Consumer Staples": (0.2, -1),
    },
    "defense": {
        "Industrials": (0.8, 1), "Energy": (0.4, 1), "Financials": (0.3, -1),
        "Consumer Discretionary": (0.3, -1), "Materials": (0.25, 1),
    },
    "supply_chain": {
        "Information Technology": (0.95, -1), "Communication Services": (0.45, -1),
        "Consumer Discretionary": (0.5, -1), "Industrials": (0.4, 1), "Materials": (0.3, 1),
    },
    "sanctions": {
        "Energy": (0.65, 1), "Materials": (0.6, 1), "Financials": (0.5, -1), "Industrials": (0.3, -1),
    },
    "cyber": {
        "Information Technology": (0.6, -1), "Financials": (0.6, -1), "Utilities": (0.5, -1),
        "Communication Services": (0.4, -1),
    },
    "risk_off": {
        "Financials": (0.45, -1), "Consumer Discretionary": (0.45, -1), "Real Estate": (0.3, -1),
        "Consumer Staples": (0.3, 1), "Utilities": (0.3, 1), "Health Care": (0.25, 1),
    },
}


def event_profiles(event) -> list[str]:
    """Map an event to the market driver(s) it activates."""
    c, r = event.category, event.region
    out: list[str] = []
    if c in ("naval_incident",) or event.chokepoint or (r == "Middle East" and c not in ("cyberattack",)):
        out.append("oil_supply")
    if c in ("armed_clash", "missile_strike", "drone_strike", "invasion", "military_exercise"):
        out.append("defense")
    if r == "East Asia":
        out.append("supply_chain")
    if c == "sanctions":
        out.append("sanctions")
    if c == "cyberattack":
        out.append("cyber")
    if c in ("invasion", "terror_attack") or event.scope == "global":
        out.append("risk_off")
    return out or ["risk_off"]


def sector_impacts(event) -> dict[str, dict]:
    """Per-event sector sensitivity, used on the event detail screen."""
    merged: dict[str, list] = {}
    for p in event_profiles(event):
        for sector, (sens, direction) in PROFILES[p].items():
            if sector not in merged or sens > merged[sector][0]:
                merged[sector] = [sens, direction]
    return {
        s: {"sensitivity": round(v[0], 2), "direction": "tailwind" if v[1] > 0 else "headwind"}
        for s, v in sorted(merged.items(), key=lambda kv: -kv[1][0])
    }


def sector_exposure(scored: list[ScoredEvent]) -> list[dict]:
    magnitude = defaultdict(float)
    directional = defaultdict(float)
    drivers = defaultdict(list)
    for s in scored:
        weight = s.contribution
        if weight == 0:
            continue
        for sector, imp in sector_impacts(s.event).items():
            m = abs(weight) * imp["sensitivity"]
            # De-escalation lowers exposure rather than adding to it.
            magnitude[sector] += m if weight > 0 else -0.5 * m
            directional[sector] += (1 if imp["direction"] == "tailwind" else -1) * m
            if weight > 0:
                drivers[sector].append((m, s.event.title))
    peak = max([v for v in magnitude.values()] + [1.0])
    rows = []
    for sector in SECTORS:
        mag = max(0.0, magnitude.get(sector, 0.0))
        score = round(100 * mag / peak, 1) if peak else 0.0
        d = directional.get(sector, 0.0)
        if mag == 0 or abs(d) < 0.25 * mag:
            bias = "mixed"
        else:
            bias = "tailwind" if d > 0 else "headwind"
        top = [t for _, t in sorted(drivers.get(sector, []), reverse=True)[:2]]
        rows.append({
            "sector": sector,
            "exposure": score,
            "level": _level(score),
            "bias": bias,
            "drivers": top,
        })
    rows.sort(key=lambda r: -r["exposure"])
    return rows


def ticker_exposure(sectors: list[dict]) -> list[dict]:
    rows = []
    for s in sectors:
        for sym, name, mult in TICKERS[s["sector"]]:
            rows.append({
                "ticker": sym,
                "name": name,
                "sector": s["sector"],
                "exposure": round(min(100.0, s["exposure"] * mult), 1),
                "bias": s["bias"],
            })
    rows.sort(key=lambda r: -r["exposure"])
    return rows


def _level(score: float) -> str:
    if score >= 70:
        return "High"
    if score >= 40:
        return "Elevated"
    if score >= 15:
        return "Moderate"
    return "Low"


TICKER_INFO = {sym: {"ticker": sym, "name": name, "sector": sector}
               for sector, rows in TICKERS.items() for sym, name, _ in rows}

TRANSMISSION = {
    "oil_supply": "Higher freight, insurance and crude costs can pressure transport margins while supporting energy prices.",
    "defense": "Defense contractors tend to catch a bid while travel and consumer names soften on risk aversion.",
    "supply_chain": "Semiconductor and hardware supply-chain risk can weigh on technology valuations.",
    "sanctions": "Tighter commodity supply can lift energy and materials while widening spreads for exposed lenders.",
    "cyber": "Operational disruption raises risk premia for technology, financials and utilities.",
    "risk_off": "Broad risk-off positioning can lift implied volatility across the index.",
}
DEESCALATION_TEXT = "De-escalation could release some of the conflict premium priced into defensive positioning."


def market_transmission(event, deescalation: bool) -> str:
    if deescalation:
        return DEESCALATION_TEXT
    return TRANSMISSION[event_profiles(event)[0]]


def followed_in(impacts: dict, watch: list[str], min_sensitivity: float = 0.5) -> list[str]:
    """Tickers in the watchlist whose sector is materially affected by an event."""
    return [t for t in watch if t in TICKER_INFO
            and impacts.get(TICKER_INFO[t]["sector"], {}).get("sensitivity", 0) >= min_sensitivity]
