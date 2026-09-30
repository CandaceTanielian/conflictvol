# ConflictVol Proof of Concept Submission

## Recommended files to submit

1. `ConflictVol_POC_Source.zip` contains the React source, configuration, assets, README, and the supplied business plan.
2. `ConflictVol_POC_Web_Build.zip` contains the exported static website that can be hosted or opened through a local web server.
3. `ConflictVol_Process_PM_Plan.docx` is the business plan used as the prototype source document and is also included inside the source ZIP.

## Assignment requirements covered

- Clickable React-based prototype
- Screen-by-screen navigation
- Overview, Projections, and Conflicts use cases
- Market indicators, buy or sell bias, and bear or bull likelihood
- Current conflict stories linked to countries, industries, and companies
- Followed-company highlighting
- Day-in-the-life scenario in the README
- Front-end mock data only
- No backend, database, or external API calls
- Source files and production web build included

## Suggested submission description

ConflictVol is an interactive React proof of concept for retail investors and finance students. It converts global conflict events into an explainable short-term S&P 500 volatility signal. Users can move through an overview dashboard, a projection desk with risk-management guidance, and a conflict monitor that maps events to affected countries, industries, and companies. The prototype uses mock data and focuses exclusively on user experience.

## Instructor run instructions

From the source folder:

```powershell
npm install
npm run web
```

For a production export:

```powershell
npm run export:web
```

The exported site is written to `dist`.
