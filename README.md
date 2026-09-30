# ConflictVol Interactive Proof of Concept

ConflictVol is a clickable React prototype for retail investors and finance students. It demonstrates how global conflict events can be translated into an explainable short-term S&P 500 volatility signal. The prototype is based on the supplied ConflictVol Process Model and Project Management Plan.

This submission is front-end only. It uses realistic mock data and does not connect to a backend, database, market-data service, or external API.

## Live prototype

[Open the clickable ConflictVol prototype](https://candacetanielian.github.io/conflictvol/)

## Prototype screens

### Overview

The default market-pulse screen gives a trader an immediate risk read. It includes global market clocks, major market instruments, a buy-or-sell bias, bear and bull likelihoods, candlesticks, technical indicators, model confidence, and a live conflict-intelligence panel.

### Projections

The projection desk summarizes the next five trading days. It explains expected volatility, confidence, the risk window, the dominant market drivers, suggested risk-management actions, and watchlist sensitivity.

### Conflicts

The conflict monitor turns each event into market impact. Every story identifies affected countries, industries, companies, expected transmission into the market, and estimated pressure. A followed company is highlighted so the user can immediately see personally relevant exposure.

## Primary click-through flow

1. Start on Overview and scan the market clocks and live signal.
2. Select a ticker to change the instrument being monitored.
3. Change the chart range or toggle the watch state.
4. Open Projections to review the forecast summary and risk-management tips.
5. Open Conflicts to inspect event-level market effects and the highlighted followed company.
6. Filter the conflict feed by All, High, or Watch and expand the signal list.

## Day in the life scenario

A finance student opens ConflictVol before the U.S. session. The Overview screen shows elevated conflict-linked volatility and a sell-or-hedge bias. The student checks Projections to understand the five-day risk window and sees that energy and freight are the strongest drivers. On Conflicts, a Red Sea shipping story highlights Maersk because it is on the user's watchlist. The student can now explain not only that volatility may rise, but why the model expects the move and which market channels are exposed.

## Run locally

Requirements: Node.js 18 or newer and npm.

```powershell
npm install
npm run web
```

Open the localhost URL shown by Expo.

## Verify and export

```powershell
npm run typecheck
npm run export:web
```

The static web output is written to `dist`.

## Source notes

- Main prototype: `App.tsx`
- App entry point: `index.ts`
- Project configuration: `app.config.ts`
- Logo and visualization assets: `public`
- All data displayed in this proof of concept is mock data created to demonstrate the user experience.
