# Tributary

Aid budgets are shrinking. AI budgets aren't. Tributary is a round-up button inside AI
credit checkouts. A Canadian buying US$25 of credits pays C$38.64 after conversion and
tax; one checkbox rounds it to C$39.00 and sends the 36 cents to a development project
chosen each month (UN SDG 17, targets 17.3 and 17.17).

StormHacks 2026 prototype.

## Run

No build step and no backend. Serve the `web` folder:

```bash
python -m http.server 5173 --directory web
```

- http://localhost:5173/console/billing.html the provider's billing page. Click Buy
  credits, tick the round-up, pay.
- http://localhost:5173/ the Tributary page. Your round-up appears in the latest
  round-ups feed and in October's total.

Round-ups are passed between the pages through browser `localStorage`. To reset the demo,
run `localStorage.removeItem("tributary.roundups")` in the browser console.

## Demo script

1. Billing page: low balance, click Buy credits, pick $25, BC.
2. Tick "Round up for global development". The total goes from C$38.64 to C$39.00.
3. Pay. The confirmation shows the 36 cents going to this month's project.
4. Open the Tributary page: totals, the new round-up at the top of the feed, giving history.

## Tests

```bash
npm --prefix web test
```

## Proxy

`proxy/` holds a metering proxy from an earlier direction. It is not used by the current
demo. See its tests with `npm --prefix proxy test`.
