# ConflictVol: Assignment 2 Submission

## Files to submit on Canvas (one team member)

1. `ConflictVol_Source.zip`: full source (Expo app, FastAPI backend, tests, README).
2. `ConflictVol_Screenshots.pdf`: 16 captioned screenshots (desktop + mobile).
3. Links:
   - Live app: https://candacetanielian.github.io/conflictvol/ (demo account: demo@conflictvol.app / Demo1234!)
   - Source: https://github.com/CandaceTanielian/conflictvol

## Assignment requirements covered

- Initial version of the class project application, generated with AI assistance (Claude)
- Built from the Business Plan, Process & PM Plan, Use Case / Activity diagrams and the Assignment 1 prototype
- Customer-facing and functional: sign-up/sign-in, dashboard, projections, conflict monitor, exposure, archive, alerts, notifications, settings
- User-experience focus: prototype visual identity kept, responsive web + mobile layout, loading/empty/error states, validation, toasts
- Backend, database and external-API adapters included (FastAPI, SQLAlchemy, ACLED / Alpha Vantage / SMTP adapters)
- Source ZIP, screenshots and viewable links

## Instructor run instructions

```bash
cd backend && pip install -r requirements.txt && uvicorn app.main:app
# second terminal, repo root
npm install && npm run web
```
