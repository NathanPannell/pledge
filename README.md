# Pledge

This repository now serves Nathan's existing frontend/company demo and the
OpenRouter round-up extension from **one Node backend**. His `web/` files remain
unchanged by the integration; extension installation is directly accessible at
`/roundups/`, with no new frontend links. Old previews remain in `artifacts/`.
The hosted demo is https://pledge.pauravhp.com.

Read [architecture and routes](docs/ARCHITECTURE.md),
[local setup and safe deployment](docs/DEPLOYMENT.md), and
[extension instructions](roundups/README.md) before changing startup or hosting.
Pulling or pushing Git does not deploy; the owner requests each update manually.

Aid budgets are shrinking. AI budgets aren't. Pledge finds what a company spends on AI,
lets it choose a share (most give 1%), and turns that into one gift a month for a charity,
with every gift on a public record. Built for UN SDG 17 (Partnerships for the Goals) at
StormHacks 2026.

The scale argument: the world will spend $2.67 trillion on AI in 2026 (Gartner, September
2026). One percent is $26.7 billion, about 15% of all foreign aid given in 2025, the year
aid fell a record 23.1% to $174.3 billion (OECD, April 2026).

## The product in three steps

1. **Find.** Drop in a card statement (CSV from any bank or card portal). The browser reads
   it and matches AI vendors locally (`web/assets/statement.js`, patterns from
   `GET /api/vendors`). Only AI rows (date, description, amount) are sent, and the server
   re-checks each one and drops anything else. Plaid (read-only) and provider cost
   reports (admin keys) are optional extra sources.
2. **Choose.** A dial from 0.25% to 5%, showing the gift per month and per year.
3. **Give.** One invoice a month, paid straight to that month's charity. The charity
   issues the tax receipt.

AI charges are matched by merchant descriptor, not merchant category code. MCCs like 5734,
7372 and 5818 cover all software and digital goods, so they can't tell AI from other SaaS.

## Charities, invoices and receipts

- Each month's gifts go to one charity from a rotation (`server/src/charities.js`):
  October is the StormHacks 2026 cause (VGH & UBC Hospital Foundation), then charities
  whose work matches SDG 17 targets. The rotation is a proposal; each charity must agree.
- `web/invoice.html?id=N`: gift invoice draft. Payable to the charity, no Pledge fee,
  no GST/HST, and the next three charities in the rotation.
- `web/receipt.html?id=N`: sample official donation receipt with every field the CRA
  requires, watermarked as a sample. The charity issues the real one.

## Setup

Requires Node 22.13 or later and Python 3 for packaging the extension.
Runtime APIs use Node built-ins; Playwright is a development dependency.

```bash
cp .env.example .env
npm ci
```

| Variable | Where to get it | Needed for |
|---|---|---|
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | dashboard.plaid.com, Developers > Keys (sandbox) | Connecting a card |
| `STRIPE_API_KEY` or `STRIPE_SECRET_KEY` | Stripe sandbox API keys (`rk_test_...` or `sk_test_...`) | Extension sandbox Checkout; keep `COMPANY_STRIPE_MODE=local` for the original company demo |
| `COMMUNITY_SAMPLE` | `on` or `off` | Sample giving from 45 other companies |

## Run

```bash
npm start
```

- http://localhost:5173/ landing page
- http://localhost:5173/app.html giving flow and company home
- http://localhost:5173/roundups/ extension installation, pairing and payment return

`npm start` builds the extension for APP_ORIGIN and starts one server. Load
`.local/extension/` in Chrome for localhost, or `roundups/extension/` to use the
hosted backend. The root environment is ignored by Git; never put keys in web
or extension files. Company invoices stay local by default in the root example;
Stripe payments are sandbox-only and do not represent real charity donations.

To reset, click **Start over** at the bottom of the company home (it asks once more), or
stop the server and delete `server/data/`.

## Demo script (about 2 minutes, no keys needed)

Open the landing page and the giving page side by side in the same browser.

1. **Landing hero.** Every 14 seconds a recent gift passes over the photo and the
   "pledged so far this month" total rolls up to include it. Scroll to **The scale**: it
   steps from one team ($188 a month) to companies on Pledge ($24,500 a month) to every
   company ($26.7 billion a year), about 7 seconds each, until you pick a step.
2. **Giving page, Find.** Click **Try a sample company**, or drop in
   `samples/harbourline-card-statement.csv`. Watch the statement scan: each transaction
   streams past, AI charges light up, and the AI spend total climbs.
3. **Choose.** "Northgate Freight spent $18,822 on AI in September, up 29% since July."
   Drag the dial, then set it back to 1%.
4. **Give $188.22 for September.** The thank-you counts the gift up, then the community
   grows from 45 to 46 companies. The landing page next to it updates at the same moment:
   new totals, and Northgate Freight at the top of the record.
5. **Home.** Next gift on November 1 goes to Engineers Without Borders Canada (SDG 17.8).
   Open the invoice; mark the gift received to show the tax receipt.

Click **Start over** before each take.

## Sample statement

`samples/harbourline-card-statement.csv` is a card statement export for a fictional
Vancouver studio, July 1 to October 2, 2026: 113 rows in a common bank layout
(`Transaction Date, Posted Date, Description, Category, Amount`, MM/DD/YYYY dates, card
payments as negative amounts). It has 10 AI tools mixed in with rent, cloud, travel and
meals. September AI spend is $11,519.95, so the gift at 1% is $115.20, up 35% since July.
Drop it on the Find step to show the upload path with a file that isn't built in.

## Motion

`web/assets/motion.js` holds the shared motion: scroll reveals (`data-reveal`,
`data-reveal-group`, `data-inview`), number tweens, the "+$" chips and the heart burst.
With `prefers-reduced-motion`, nothing is hidden and every number lands at once.

## Tests

```bash
npm test
npm run validate
```

For browser tests, `npx playwright install chromium`, then run
`PLEDGE_E2E_ORIGIN=http://localhost:5173 npm run test:browser`; its default is
read-only for company data. On an **isolated localhost database only**, set
`PLEDGE_E2E_ALLOW_COMPANY_RESET=1` to test the complete company flow.
`node scripts/payments-e2e.mjs` exercises actual sandbox Checkout against a
fresh browser account; set PLEDGE_E2E_ORIGIN to your running test server.
`npm run test:openrouter` needs an already authenticated protected profile via
PLEDGE_OPENROUTER_PROFILE; it reuses that session, never signs in to Claude, and
never submits an OpenRouter purchase. Test outputs stay ignored in test-results/.
