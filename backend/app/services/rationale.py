"""Plain-language rationale behind each projection, plus historical analogs."""
from .scoring import CATEGORY_LABELS, cri_label


def find_analogs(event, severity: float, episodes, limit: int = 3) -> list[dict]:
    scored = []
    for ep in episodes:
        score = 0.0
        if ep.category == event.category:
            score += 3
        elif _family(ep.category) == _family(event.category):
            score += 1.5
        if ep.region == event.region:
            score += 2.5
        score += max(0.0, 2 - abs(ep.peak_severity - severity) / 2)
        scored.append((score, ep))
    scored.sort(key=lambda x: -x[0])
    out = []
    for score, ep in scored[:limit]:
        out.append({
            "id": ep.id,
            "name": ep.name,
            "start_date": ep.start_date.isoformat(),
            "similarity": round(min(100.0, score / 7.5 * 100), 0),
            "pre_vol": ep.pre_vol,
            "peak_vol": ep.peak_vol,
            "vol_change": round(ep.peak_vol - ep.pre_vol, 1),
            "days_to_peak": ep.days_to_peak,
            "sp_move_pct": ep.sp_move_pct,
        })
    return out


def _family(category: str) -> str:
    if category in ("armed_clash", "missile_strike", "drone_strike", "invasion"):
        return "kinetic"
    if category in ("naval_incident",):
        return "maritime"
    if category in ("ceasefire", "peace_talks"):
        return "deescalation"
    return category


def build_rationale(horizon: dict, rv: float, cri: float, drivers: list[dict], sectors: list[dict],
                    analog: dict | None, scored_top) -> dict:
    direction = "up" if horizon["change"] > 0.05 else "down" if horizon["change"] < -0.05 else "flat"
    move_word = {"up": "above", "down": "below", "flat": "in line with"}[direction]
    headline = (
        f"{horizon['phrase']} S&P 500 volatility is projected at {horizon['vol']}% "
        f"({horizon['regime']}), {abs(horizon['change'])} pts {move_word} today's realized {rv}%."
        if direction != "flat"
        else f"{horizon['phrase']} S&P 500 volatility is projected at {horizon['vol']}% ({horizon['regime']}), "
             f"roughly unchanged from today's realized {rv}%."
    )
    paras = []
    paras.append(
        f"The Conflict Risk Index is {cri} ({cri_label(cri)}). On its own, volatility would drift toward its "
        f"long-run average, giving a baseline of {horizon['baseline']}%. Current conflict activity adds about "
        f"{horizon['conflict_premium']} pts on top of that."
    )
    pos = [d for d in drivers if d["vol_points"] > 0]
    if pos:
        lead = pos[0]
        e = scored_top[0].event if scored_top else None
        cat = CATEGORY_LABELS.get(e.category, e.category).lower() if e else "event"
        txt = (
            f"The largest single driver is \"{lead['title']}\" ({lead['region']}, severity {lead['severity']}/10), "
            f"worth roughly {lead['vol_points']} pts of the conflict premium."
        )
        if len(pos) > 1:
            others = ", ".join(f"\"{d['title']}\"" for d in pos[1:3])
            txt += f" Other contributors: {others}."
        paras.append(txt)
    neg = [d for d in drivers if d["vol_points"] < 0]
    if neg:
        paras.append(
            f"Partly offsetting this, \"{neg[0]['title']}\" is a de-escalation signal that pulls the estimate down."
        )
    if analog:
        verb = "rose" if analog["vol_change"] >= 0 else "fell"
        paras.append(
            f"The closest historical analog is {analog['name']} ({analog['start_date'][:4]}), when index "
            f"volatility {verb} from about {analog['pre_vol']} to {analog['peak_vol']} over "
            f"{analog['days_to_peak']} trading days."
        )
    exposed = [s for s in sectors if s["exposure"] >= 40][:3]
    if exposed:
        parts = [f"{s['sector']} ({s['bias']})" for s in exposed]
        paras.append("Sectors carrying the most exposure: " + ", ".join(parts) + ".")
    factors = [
        {"label": "Long-run average volatility", "value": 17.5, "kind": "anchor"},
        {"label": "Current 20-day realized volatility", "value": rv, "kind": "input"},
        {"label": "Mean-reversion baseline", "value": horizon["baseline"], "kind": "baseline"},
        {"label": "Conflict premium", "value": horizon["conflict_premium"], "kind": "premium"},
        {"label": "Projected volatility", "value": horizon["vol"], "kind": "result"},
    ]
    return {
        "horizon": horizon["horizon"],
        "headline": headline,
        "paragraphs": paras,
        "factors": factors,
        "drivers": drivers,
        "analog": analog,
        "disclaimer": "ConflictVol projections are statistical estimates for research and education, not investment advice.",
    }
