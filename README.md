# Tributary

Aid budgets are shrinking. AI budgets aren't. Tributary is a round-up button inside AI
credit checkouts. A US$100 usage-credit purchase with its volume discount and BC tax comes
to US$100.80; one checkbox rounds it to US$101.00 and sends the 20 cents to a development
project chosen each month (UN SDG 17, targets 17.3 and 17.17).

StormHacks 2026 prototype.

## Run

No build step and no backend. Serve the `web` folder:

```bash
python -m http.server 5173 --directory web
```

- http://localhost:5173/settings/usage.html the provider's Settings > Usage page. Click
  Buy more usage, tick the round-up, pay.
- http://localhost:5173/console/billing.html the provider's API console billing page.
  Click Buy credits from US$5; US$20 + tax = $22.40 rounds to $23.00.
- http://localhost:5173/ the Tributary page. Your round-up appears in the latest
  round-ups feed and in October's total.

Round-ups are passed between the pages through browser `localStorage`. To reset the demo,
run `localStorage.removeItem("tributary.roundups")` in the browser console.

## Demo script

1. Settings > Usage: weekly limit at 91%, no usage credits. Click Buy more usage.
2. $100 (save 10%) is selected. Tick "Round up for global development". Total due goes
   from US$100.80 to US$101.00. Try "Next $5" to show US$105.00, then switch back.
3. Pay. The confirmation shows the 20 cents going to this month's project.
4. Open the Tributary page: totals, the new round-up at the top of the feed, giving history.

## Tests

```bash
npm --prefix web test
```

## Proxy

`proxy/` holds a metering proxy from an earlier direction. It is not used by the current
demo. See its tests with `npm --prefix proxy test`.
