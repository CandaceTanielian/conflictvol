"""Capture screenshots of every screen with headless Chrome (Playwright).

Start the backend (:8000) and serve the web export on :8081, then:
    python docs/capture_screenshots.py [base_url] [out_dir]
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8081"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).parent / "screenshots")
OUT.mkdir(parents=True, exist_ok=True)
errors: list[str] = []
VIEW = {"width": 1440, "height": 900}

FULL_HEIGHT_JS = """() => {
  let h = document.documentElement.clientHeight;
  for (const el of document.querySelectorAll('div')) {
    if (el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflowY !== 'visible') h = Math.max(h, el.scrollHeight + 64);
  }
  return Math.min(h, 6000);
}"""


def shot(page, name, full=True, keep_toasts=False):
    page.wait_for_timeout(900)
    page.evaluate(f"(() => {{ const t = document.querySelector('[data-testid=toasts]'); if (t) t.style.visibility = '{'visible' if keep_toasts else 'hidden'}'; }})()")
    if full:
        h = page.evaluate(FULL_HEIGHT_JS)
        page.set_viewport_size({"width": VIEW["width"], "height": int(h)})
        page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f"{name}.png"))
    if full:
        page.set_viewport_size(VIEW)
    page.evaluate("(() => { const t = document.querySelector('[data-testid=toasts]'); if (t) t.style.visibility = 'visible'; })()")
    print("saved", name)


def nav(page, label):
    page.get_by_role("link", name=label).first.click()
    page.wait_for_timeout(700)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = browser.new_context(viewport=VIEW)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))

    page.goto(BASE)
    page.get_by_text("FILL DEMO CREDENTIALS", exact=False).wait_for()
    shot(page, "01_sign_in", full=False)
    page.get_by_role("tab", name="CREATE ACCOUNT").click()
    page.get_by_role("button", name="CREATE ACCOUNT  →").click()
    shot(page, "02_register_validation", full=False)

    page.get_by_role("tab", name="SIGN IN").click()
    page.get_by_text("FILL DEMO CREDENTIALS", exact=False).click()
    page.get_by_role("button", name="SIGN IN  →").click()
    page.get_by_text("Conflict intelligence").wait_for()
    shot(page, "03_overview_market_pulse")

    nav(page, "Projections")
    page.get_by_text("WATCHLIST IMPACT").wait_for()
    shot(page, "04_projection_desk")

    nav(page, "Conflicts")
    page.get_by_text("MARKET TRANSMISSION").first.wait_for()
    shot(page, "05_conflict_monitor")
    page.get_by_text("Tanker seized near the Strait of Hormuz").first.click()
    page.get_by_text("How it's scored").wait_for()
    shot(page, "06_event_detail", full=False)
    page.get_by_role("button", name="Close", exact=True).click()

    nav(page, "Exposure")
    page.get_by_text("Representative tickers").wait_for()
    shot(page, "07_sector_exposure")

    nav(page, "Archive")
    page.get_by_text("Conflict episodes").wait_for()
    shot(page, "08_historical_archive")

    nav(page, "Alerts")
    page.get_by_text("CURRENT LEVELS").wait_for()
    shot(page, "09_alerts")
    page.get_by_role("button", name="+ NEW ALERT").click()
    page.get_by_label("Alert name").fill("Energy sector stress")
    page.get_by_role("button", name="SECTOR", exact=True).click()
    page.get_by_role("button", name="ENERGY", exact=True).click()
    page.get_by_label("Threshold").fill("99")
    shot(page, "10_new_alert", full=False)
    page.get_by_role("button", name="CREATE ALERT").click()
    page.wait_for_timeout(800)

    nav(page, "Overview")
    page.get_by_text("Conflict intelligence").wait_for()
    page.get_by_role("button", name="Refresh data: ingest new events, re-run the projection and check alerts").click()
    page.get_by_text("New event ingested", exact=False).wait_for()
    shot(page, "11_refresh_alerts_fired", full=False, keep_toasts=True)

    page.get_by_role("button", name="Notifications", exact=False).first.click()
    page.get_by_text("MARK ALL READ").wait_for()
    shot(page, "12_notifications")

    page.get_by_role("button", name="Settings", exact=True).click()
    page.get_by_text("Data sources").wait_for()
    shot(page, "13_settings")
    page.get_by_role("button", name="EDIT", exact=True).click()
    page.get_by_text("Followed companies").last.wait_for()
    shot(page, "14_watchlist_editor", full=False)
    page.get_by_role("button", name="CANCEL").click()

    page.get_by_role("radio").first.click()  # Free plan
    page.wait_for_timeout(600)
    nav(page, "Exposure")
    page.get_by_text("Ticker-level exposure is a Premium feature").wait_for()
    shot(page, "15_free_plan_gating")
    page.get_by_role("button", name="Settings", exact=True).click()
    page.get_by_role("radio").nth(1).click()

    m = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    mp = m.new_page()
    mp.goto(BASE)
    mp.get_by_text("FILL DEMO CREDENTIALS", exact=False).click()
    mp.get_by_role("button", name="SIGN IN  →").click()
    mp.get_by_text("Conflict intelligence").wait_for()
    mp.wait_for_timeout(900)
    mp.screenshot(path=str(OUT / "16_mobile_overview.png"))
    print("saved 16_mobile_overview")
    browser.close()

print("console/page errors:", errors or "none")
