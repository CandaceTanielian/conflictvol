"""Seeds the database with a sample conflict feed, an S&P 500 price series,
the historical conflict-volatility archive, and a demo account.

The sample feed is fictionalized for demonstration. Historical archive figures
are approximate and meant for illustration; verify before citing.
"""
from datetime import date, datetime, timedelta, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import Alert, ArchiveEpisode, ConflictEvent, MarketBar, Notification, User, WatchItem
from .security import hash_password
from .services.projection import cri_history

DEMO_EMAIL = "demo@conflictvol.app"
DEMO_PASSWORD = "Demo1234!"

# (key, title, summary, region, country, lat, lon, category, fatalities, scope, escalating, chokepoint, days_ago, status)
SAMPLE_EVENTS = [
    ("ev-001", "Tanker seized near the Strait of Hormuz",
     "Naval forces boarded and diverted a crude tanker transiting the strait. Insurers raised war-risk premiums for Gulf routes within hours.",
     "Middle East", "Oman / Iran (Strait of Hormuz)", 26.6, 56.3, "naval_incident", 0, "regional", True, True, 1.5, "active"),
    ("ev-002", "Drone strikes hit refinery and export terminal",
     "Long-range drones struck a coastal refinery and an adjacent crude export terminal on the Black Sea, halting loadings.",
     "Eastern Europe", "Russia (Black Sea coast)", 44.7, 37.8, "drone_strike", 3, "regional", True, False, 3, "active"),
    ("ev-003", "Large-scale naval and air drills around Taiwan",
     "Joint exercises involving warships and aircraft were announced around Taiwan, including simulated blockade drills near major ports.",
     "East Asia", "Taiwan Strait", 24.0, 119.8, "military_exercise", 0, "regional", True, False, 2, "active"),
    ("ev-004", "Missile exchange across the Israel-Lebanon border",
     "Cross-border rocket and missile fire intensified over two days, with strikes reported on military positions on both sides.",
     "Middle East", "Israel / Lebanon", 33.1, 35.4, "missile_strike", 12, "regional", True, False, 4, "active"),
    ("ev-005", "New sanctions package targets oil shipping fleet",
     "A coordinated sanctions package designated dozens of tankers and shipping intermediaries tied to restricted oil exports.",
     "Eastern Europe", "Multilateral (EU / US)", 50.8, 4.4, "sanctions", 0, "global", False, False, 6, "active"),
    ("ev-006", "Commercial vessel struck by missile in the Red Sea",
     "A container ship was hit by an anti-ship missile off the Yemeni coast. Several carriers announced reroutes around the Cape of Good Hope.",
     "Middle East", "Yemen (Red Sea)", 14.5, 42.0, "missile_strike", 2, "regional", False, True, 5, "active"),
    ("ev-007", "Border clashes along the Line of Actual Control",
     "Troops clashed at a disputed high-altitude border post. Both governments called for restraint and local commander talks.",
     "South Asia", "India / China", 34.3, 78.6, "armed_clash", 4, "local", False, False, 8, "active"),
    ("ev-008", "Ransomware attack disrupts a major European port",
     "A ransomware attack took terminal operating systems offline at a major North Sea port, delaying container handling for two days.",
     "Western Europe", "Netherlands", 51.9, 4.1, "cyberattack", 0, "regional", False, False, 7, "active"),
    ("ev-009", "Ceasefire agreed in Sudan after mediated talks",
     "The warring parties signed a 30-day humanitarian ceasefire following regional mediation, with monitoring by observers.",
     "Africa", "Sudan", 15.5, 32.5, "ceasefire", 0, "regional", False, False, 3, "active"),
    ("ev-010", "Artillery fire intensifies along the eastern front line",
     "Heavy artillery and glide-bomb attacks were reported along a wide section of the front, with significant casualties.",
     "Eastern Europe", "Ukraine", 48.0, 37.8, "armed_clash", 40, "regional", False, False, 1, "active"),
    ("ev-011", "Armed attack on government buildings in the Sahel",
     "Gunmen attacked government and military buildings in a regional capital before security forces regained control.",
     "Africa", "Mali", 12.6, -8.0, "armed_clash", 15, "local", False, False, 10, "active"),
    ("ev-012", "Border talks resume between Venezuela and Guyana",
     "Delegations met under regional mediation to discuss the Essequibo border dispute and agreed to a follow-up round.",
     "Latin America", "Venezuela / Guyana", 6.8, -58.2, "peace_talks", 0, "regional", False, False, 9, "active"),
    ("ev-013", "Ballistic missile test over the Sea of Japan",
     "A ballistic missile was launched and fell into the sea outside Japan's exclusive economic zone.",
     "East Asia", "North Korea", 40.0, 134.0, "military_exercise", 0, "regional", False, False, 12, "active"),
    ("ev-014", "Militant attack near an LNG project",
     "Militants attacked a town near a liquefied natural gas development, prompting contractors to suspend work.",
     "Africa", "Mozambique", -11.3, 40.4, "terror_attack", 9, "local", False, False, 13, "active"),
    # Older events (drive the history chart)
    ("ev-015", "Air strikes on energy infrastructure in Iraq",
     "Strikes targeted pipelines and a gas processing plant in northern Iraq.",
     "Middle East", "Iraq", 35.5, 44.4, "missile_strike", 20, "regional", True, False, 62, "active"),
    ("ev-016", "Naval standoff in the South China Sea",
     "Coast guard vessels blocked a resupply mission to a disputed shoal; water cannon was used.",
     "East Asia", "Philippines", 9.7, 115.9, "naval_incident", 0, "regional", True, False, 58, "active"),
    ("ev-017", "Cyberattack on a US regional grid operator",
     "Intrusion into a grid operator's control network forced a precautionary manual-operations mode.",
     "North America", "United States", 39.9, -82.9, "cyberattack", 0, "regional", False, False, 40, "active"),
    ("ev-018", "Ceasefire collapse in Gaza",
     "A ceasefire broke down with renewed air strikes and ground operations.",
     "Middle East", "Israel / Gaza", 31.4, 34.4, "armed_clash", 60, "regional", True, False, 70, "active"),
    ("ev-019", "Expanded restrictions on advanced chip exports",
     "New export controls widened restrictions on advanced semiconductors and chipmaking tools.",
     "East Asia", "Multilateral", 37.5, 127.0, "sanctions", 0, "global", False, False, 35, "active"),
    ("ev-020", "Armed clashes in eastern DRC",
     "Rebel and government forces clashed near a provincial capital, displacing thousands.",
     "Africa", "DR Congo", -1.7, 29.2, "armed_clash", 30, "local", False, False, 45, "active"),
    # Queued in the sample feed; promoted one at a time by "Refresh data".
    ("ev-101", "Hormuz transits suspended after mine sighting",
     "Shipping authorities suspended tanker transits through the Strait of Hormuz after naval mines were reported in the channel. Brent crude jumped in after-hours trading.",
     "Middle East", "Strait of Hormuz", 26.5, 56.5, "naval_incident", 0, "global", True, True, 0, "pending"),
    ("ev-102", "Explosion damages a Baltic Sea gas pipeline",
     "An undersea explosion damaged a gas interconnector in the Baltic Sea. Operators isolated the line and investigators suspect sabotage.",
     "Western Europe", "Baltic Sea", 59.3, 23.0, "naval_incident", 0, "regional", True, False, 0, "pending"),
    ("ev-104", "Missile strike near a Red Sea port terminal",
     "A missile struck near a port terminal on the Red Sea coast, damaging fuel storage tanks. Two shipping lines paused calls at the port.",
     "Middle East", "Yemen (Red Sea)", 14.8, 42.9, "missile_strike", 6, "regional", True, True, 0, "pending"),
    ("ev-103", "Taiwan drills conclude; both sides signal talks",
     "Military drills around Taiwan ended on schedule and officials on both sides signalled openness to working-level talks.",
     "East Asia", "Taiwan Strait", 24.5, 120.5, "peace_talks", 0, "regional", False, False, 0, "pending"),
    ("ev-105", "Cyberattack disrupts a major US payment processor",
     "A coordinated cyberattack knocked a large card-payment processor offline for several hours. Officials are investigating a state-linked group.",
     "North America", "United States", 40.7, -74.0, "cyberattack", 0, "global", True, False, 0, "pending"),
    ("ev-106", "Ceasefire talks open on the Israel-Lebanon border",
     "Mediators convened the first direct talks in months aimed at a ceasefire along the Israel-Lebanon border. Cross-border fire eased overnight.",
     "Middle East", "Israel / Lebanon", 33.2, 35.6, "peace_talks", 0, "regional", False, False, 0, "pending"),
    ("ev-107", "Emergency export curbs on rare-earth minerals",
     "New emergency export controls restrict shipments of processed rare-earth minerals used in chips, EV motors and defense systems.",
     "East Asia", "Multilateral", 39.9, 116.4, "sanctions", 0, "global", True, False, 0, "pending"),
    ("ev-108", "Black Sea shipping corridor reopens under new deal",
     "A new agreement reopened a Black Sea shipping corridor for grain and fuel cargoes, with naval escorts and inspections.",
     "Eastern Europe", "Black Sea", 45.5, 31.5, "ceasefire", 0, "regional", False, False, 0, "pending"),
]

# Approximate figures (index volatility, VIX-style, and S&P 500 move) for illustration.
ARCHIVE = [
    ("Iraq invades Kuwait", date(1990, 8, 2), "Middle East", "invasion", 9.5, 17.2, 36.5, 15, 120, -15.9,
     "Oil prices doubled within weeks and the index slid into a bear market by October.", ["Energy", "Industrials", "Consumer Discretionary"]),
    ("September 11 attacks", date(2001, 9, 11), "North America", "terror_attack", 9.8, 31.8, 43.7, 4, 35, -11.6,
     "Markets closed for four sessions; the index fell sharply on reopening before recovering by mid-October.", ["Industrials", "Financials", "Consumer Discretionary"]),
    ("Iraq War begins", date(2003, 3, 20), "Middle East", "invasion", 8.0, 34.7, 29.2, 5, 10, 2.4,
     "Volatility had peaked in the run-up; once the invasion began uncertainty resolved and volatility fell.", ["Energy", "Industrials"]),
    ("Crimea annexation", date(2014, 3, 1), "Eastern Europe", "invasion", 7.0, 14.0, 17.8, 10, 20, -2.0,
     "A brief volatility spike; markets recovered within weeks as sanctions were limited.", ["Energy", "Financials", "Materials"]),
    ("North Korea missile standoff", date(2017, 8, 8), "East Asia", "missile_strike", 6.0, 10.0, 16.0, 3, 15, -1.5,
     "Escalating rhetoric lifted volatility from historic lows; the move faded within weeks.", ["Information Technology", "Industrials"]),
    ("Abqaiq-Khurais drone attack", date(2019, 9, 14), "Middle East", "drone_strike", 7.5, 13.7, 15.9, 6, 10, -0.3,
     "Half of Saudi oil output went offline briefly; oil spiked about 15% but equity volatility barely moved.", ["Energy", "Industrials"]),
    ("Soleimani strike", date(2020, 1, 3), "Middle East", "missile_strike", 7.0, 12.5, 14.0, 1, 5, -0.7,
     "A sharp one-day risk-off move that reversed after Iran's measured response.", ["Energy", "Industrials"]),
    ("Taiwan Strait live-fire drills", date(2022, 8, 4), "East Asia", "military_exercise", 6.5, 22.8, 23.9, 2, 6, 0.5,
     "Large drills followed a high-profile visit; semiconductor names wobbled but the index shrugged it off.", ["Information Technology"]),
    ("Russia invades Ukraine", date(2022, 2, 24), "Eastern Europe", "invasion", 9.5, 25.7, 36.5, 7, 60, -3.0,
     "Energy and commodity prices surged; volatility stayed elevated for weeks alongside rate-hike fears.", ["Energy", "Materials", "Industrials", "Financials"]),
    ("Hamas attack on Israel", date(2023, 10, 7), "Middle East", "terror_attack", 8.5, 17.5, 21.7, 9, 25, -2.5,
     "Oil rose and defense stocks rallied; volatility rose gradually, compounded by bond-market stress.", ["Industrials", "Energy"]),
    ("Red Sea shipping attacks escalate", date(2023, 12, 15), "Middle East", "missile_strike", 6.5, 12.3, 13.9, 10, 5, 1.0,
     "Major carriers rerouted around Africa; freight rates jumped but equity volatility stayed low.", ["Industrials", "Consumer Discretionary"]),
    ("Iran strikes Israel with drones and missiles", date(2024, 4, 13), "Middle East", "missile_strike", 8.0, 14.9, 19.2, 5, 12, -3.0,
     "First direct strike from Iranian territory; volatility rose for a week before easing.", ["Energy", "Industrials"]),
]


def _recent_trading_days(n: int, end: date) -> list[date]:
    days, d = [], end
    while len(days) < n:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    return list(reversed(days))


def seed(db: Session, force: bool = False) -> None:
    if db.scalar(select(User).limit(1)) and not force:
        return
    now = datetime.now(timezone.utc)

    events = []
    for (key, title, summary, region, country, lat, lon, cat, fat, scope, esc, choke, days_ago, status) in SAMPLE_EVENTS:
        e = ConflictEvent(
            external_id=key, title=title, summary=summary, region=region, country=country, lat=lat, lon=lon,
            category=cat, fatalities=fat, scope=scope, escalating=esc, chokepoint=choke, source="Sample feed",
            occurred_at=now - timedelta(days=days_ago), ingested_at=now - timedelta(days=days_ago) if status == "active" else None,
            status=status,
        )
        db.add(e)
        events.append(e)

    # Synthetic S&P 500 path whose daily volatility responds to the conflict index.
    last = now.date() - timedelta(days=1)
    days = _recent_trading_days(260, last)
    active = [e for e in events if e.status == "active"]
    cri = cri_history(active, days)
    rng = np.random.default_rng(11)
    price, path = 1.0, []
    for c in cri:
        sigma = (12.5 + 0.16 * c) / 100 / np.sqrt(252)
        price *= float(np.exp(0.0003 - 0.5 * sigma ** 2 + sigma * rng.standard_normal()))
        path.append(price)
    scale = 6742.0 / path[-1]  # anchor the sample series to a plausible index level
    for d, p in zip(days, path):
        db.add(MarketBar(symbol="SPX", day=d, close=round(p * scale, 2)))

    for (name, start, region, cat, sev, pre, peak, dtp, dtn, move, summary, sectors) in ARCHIVE:
        db.add(ArchiveEpisode(name=name, start_date=start, region=region, category=cat, peak_severity=sev,
                              pre_vol=pre, peak_vol=peak, days_to_peak=dtp, days_to_normalize=dtn,
                              sp_move_pct=move, summary=summary, sectors_hit=sectors))

    demo = User(email=DEMO_EMAIL, name="Demo Investor", password_hash=hash_password(DEMO_PASSWORD), plan="trial",
                trial_ends_at=now + timedelta(days=settings.trial_days), email_alerts=True)
    db.add(demo)
    db.flush()
    a1 = Alert(user_id=demo.id, name="Weekly volatility spike", target="S&P 500", metric="vol_1w", operator="above",
               threshold=21.5, channel="email")
    a2 = Alert(user_id=demo.id, name="Energy exposure", target="Energy", metric="exposure", operator="above",
               threshold=98.0, channel="in_app")
    a3 = Alert(user_id=demo.id, name="Conflict risk severe", target="S&P 500", metric="cri", operator="above",
               threshold=72.0, channel="in_app")
    db.add_all([a1, a2, a3])
    db.add_all([WatchItem(user_id=demo.id, ticker=t, created_at=now - timedelta(minutes=10 - i))
                for i, t in enumerate(["XOM", "LMT", "DAL", "NVDA"])])
    db.flush()
    db.add_all([
        Notification(user_id=demo.id, alert_id=a2.id, title="Energy exposure: Energy sector exposure score rose above 60",
                     body="Now at 71.4 (threshold 60). Leading driver: Tanker seized near the Strait of Hormuz.",
                     level="warning", created_at=now - timedelta(days=1, hours=3), read=True),
        Notification(user_id=demo.id, alert_id=None, title="Welcome to ConflictVol",
                     body="Your 14-day Premium trial is active: real-time projections, the full archive, and custom alerts.",
                     level="info", created_at=now - timedelta(days=2), read=True),
    ])
    db.commit()
