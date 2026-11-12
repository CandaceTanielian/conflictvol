# ConflictVol

**CS 4800.02 · Fall 2026 · Assignment 2: initial customer-facing application**
Team: Candace Tanielian (Project Manager) · Alex Broy (Developer) · Reim Nouh (QA / Business Analyst)

ConflictVol helps retail investors and finance students understand how global conflict events translate into short-term S&P 500 volatility. It tracks conflicts, scores how much each one matters to markets, and projects 1-day, 1-week and 1-month volatility ranges with a plain-language rationale. It also shows which sectors and followed companies are exposed, and alerts users when their thresholds are crossed.

This version builds on the Assignment 1 clickable prototype. It keeps the same Expo / React Native stack and visual identity, and the prototype's Overview, Projections and Conflicts screens now run on real data from a FastAPI backend. The app was generated with AI assistance (Claude), using the team's Business Plan, Process & Project Management Plan, UML Use Case / Activity diagrams and the Assignment 1 prototype as source documents.

## Live app

[Open ConflictVol](https://candacetanielian.github.io/conflictvol/). Sign in with **demo@conflictvol.app / Demo1234!** or create an account.

The hosted GitHub Pages version runs in **demo mode**: it replays snapshots exported from the real backend, and accounts, alerts and watchlists live in your browser. Run the backend locally for the full client-server version.

## What changed since Assignment 1

| Assignment 1 prototype | Assignment 2 application |
|---|---|
| Front-end only, hard-coded mock data | FastAPI backend + SQLite/PostgreSQL; every number comes from the API |
| 3 screens (Overview, Projections, Conflicts) | 8 screens + sign in/register: adds Exposure, Archive, Alerts, Notifications, Settings |
| Static "REFRESH" animation | Refresh ingests new events, re-runs the projection and evaluates every alert |
| One hard-coded followed company (Maersk) | Real watchlist: follow any covered S&P 500 ticker; highlighted across the feed, map and projection desk |
| Static candlestick chart | Interactive chart: realized vol + projected range, S&P price with ±1σ cone, risk index; 1M/3M; hover to inspect |
| Mock market clocks | Live session status for Tokyo, London, New York and S&P futures |
| "Watch" toggle did nothing | Watch creates a real 1-week volatility alert |

## Features → Use Cases

| Use case (UML diagram) | Screen | API |
|---|---|---|
| Register / Log In | Sign in / Create account (validation, demo account, 14-day Premium trial) | `POST /api/auth/register`, `/login`, `GET /me` (bcrypt + JWT) |
| View Volatility Projection Dashboard | **Overview**: tickers, projection card, model posture & confidence, chart, signal breakdown, conflict feed | `GET /api/dashboard` |
| View Projection Rationale | **Projections**: horizon tabs, expected vol, confidence, risk window, rationale, waterfall, contributions, analog, risk-management ideas, watchlist impact | `GET /api/rationale`, `/dashboard` |
| Track Global Conflict Events | **Conflicts**: map, level/region/search filters, event cards with countries, industries, companies and market transmission; detail with scoring breakdown | `GET /api/events`, `/events/{id}` |
| View Sector / Ticker Exposure | **Exposure**: 11 sectors with tailwind/headwind bias and drivers; ticker table with follow stars (Premium) | `GET /api/exposure` |
| Browse Historical Archive | **Archive**: 12 past conflict episodes, matched analogs, sort/filter (Free plan sees 3) | `GET /api/archive` |
| Configure Volatility Alerts | **Alerts**: create/edit/pause/test/delete with a live "would fire now" preview | `/api/alerts` (CRUD) |
| Receive Alert Notification | **Notifications** inbox, unread badge, toasts; email channel via the Notification Gateway | `/api/notifications` |
| Ingest Conflict / Market Data → Generate Projection | REFRESH button | `POST /api/data/refresh` |
| Follow companies (from the Assignment 1 prototype) | Watchlist editor, follow stars, "Following" card | `/api/watchlist` |

The business plan's Free / Premium tiers are enforced (alerts, archive depth, ticker detail), and new accounts start on a 14-day Premium trial.

## Day in the life

A finance student opens ConflictVol before the U.S. session. **Overview** shows 1-week volatility projected at 20.7% (Elevated), 7 points above realized, with a Defensive model posture. Most of that move comes from conflict signals led by a tanker seizure near the Strait of Hormuz. She follows XOM, LMT and DAL, so those events are highlighted in the feed. On **Projections** she reads why the model expects the move, sees that Industrials and Energy are the most sensitive channels, and checks the closest historical analog. She sets an alert for 1-week volatility above 21.5%. Later, new data is ingested: a mine sighting suspends Hormuz transits, the risk index jumps from 60 to 70, and her alert fires in Notifications with the reason attached.

## Run locally

Requirements: Node.js 18+, Python 3.11+.

```bash
# 1) Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload        # http://localhost:8000 · API docs at /docs

# 2) App (second terminal, repo root)
npm install
npm run web                          # Expo web; talks to http://localhost:8000
```

- Point the app at another server with `EXPO_PUBLIC_API_URL=https://api.example.com npm run web`.
- Run the in-browser demo without a backend with `npm run web:demo`.
- Native: `npm run ios` / `npm run android` (Expo).
- Tests: `cd backend && python -m pytest -q` (12 end-to-end API tests covering every use case).
- Typecheck: `npm run typecheck`.

### Deploy to GitHub Pages

```bash
npm run deploy      # exports the demo build to deploy-dist and publishes the gh-pages branch
```

After changing backend data or logic, refresh the demo snapshots with `cd backend && python scripts/export_demo_data.py`.

## Architecture (3-tier)

```
Presentation   Expo / React Native (+ react-native-web), react-native-svg charts, d3-geo map, Manrope
     │  REST / JSON, JWT bearer auth
Application    FastAPI · services: scoring, projection, exposure, rationale, alerts, feeds, snapshot
     │  SQLAlchemy 2.0
Data           SQLite (dev) · PostgreSQL (prod via DATABASE_URL)
External       Conflict-Monitoring API (ACLED adapter) · Market-Data API (Alpha Vantage adapter) · SMTP gateway
```

**Projection model (v1, transparent by design)**
- *Severity* (−5 to 10) = category base × scope, plus escalation, chokepoint and fatalities. Ceasefires and talks score negative.
- *Conflict Risk Index* (0–100) = 100 · tanh(Σ severity × region relevance × recency / 70), with a 7-day recency half-life.
- *Projected vol(h)* = 17.5 + (RV20 − 17.5) · 0.94^h + CRI · k_h, with an 80% band that widens with horizon and risk.
- *Model posture, confidence and risk window* come from the projection, the band width and the lead event's age.

Without API keys the app uses a bundled sample feed, so the full ingest → score → project → alert loop works offline. Set `ACLED_API_KEY`, `ACLED_EMAIL` and `ALPHAVANTAGE_API_KEY` for the live adapters, and `SMTP_HOST` for real alert emails.

## Project structure

```
App.tsx                  providers, fonts, screen routing
src/screens/             Auth, Overview, Projections, Conflicts, Exposure, Archive, Alerts, Notifications, Settings
src/components/          Shell (nav, banner, market clocks), VolChart, WorldMap, WatchlistEditor, ui
src/api/                 client.ts (REST) · demo.ts + demo-data.json (in-browser backend for GitHub Pages)
src/theme.ts, state.tsx  design tokens · app state, navigation, data hooks
backend/app/             FastAPI app: models, routers, services, seed data
backend/tests/           end-to-end API tests
docs/                    screenshots, screenshot PDF, capture script
public/                  logo and signal-map assets
```

## Known limitations (Sprints 2–3)

- Conflict and market data come from a fictionalized **sample feed**. Archive figures are approximate and for illustration.
- Billing is not connected; plan changes apply instantly.
- Sprint 3 scope (security hardening, rate limiting, password reset, push notifications on native) is not in this version.
- Projections are statistical estimates for research and education, not investment advice.
