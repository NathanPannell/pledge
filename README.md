# Tributary

Aid budgets are shrinking. AI budgets aren't. Tributary finds what a company spends on AI,
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
- `web/invoice.html?id=N`: gift invoice draft. Payable to the charity, no Tributary fee,
  no GST/HST, and the next three charities in the rotation.
- `web/receipt.html?id=N`: sample official donation receipt with every field the CRA
  requires, watermarked as a sample. The charity issues the real one.

## Setup

Requires Node 22.13 or later. No npm dependencies.

```bash
cp server/.env.example server/.env
```

| Variable | Where to get it | Needed for |
|---|---|---|
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | dashboard.plaid.com, Developers > Keys (sandbox) | Connecting a card |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com, test mode API keys (`sk_test_...`) | Sending invoices through Stripe |
| `COMMUNITY_SAMPLE` | `on` or `off` | Sample giving from 45 other companies |

## Run

```bash
npm --prefix server start
```

- http://localhost:5173/ landing page
- http://localhost:5173/app.html giving flow and company home

To reset, click **Start over** at the bottom of the company home (it asks once more), or
stop the server and delete `server/data/`.

## Demo script (about 2 minutes, no keys needed)

Open the landing page and the giving page side by side in the same browser.

1. **Landing hero.** The live "pledged so far this month" counter ticks and recent gifts
   pass over the photo. Scroll to **The scale**: it walks from one team ($188 a month) to
   Tributary today ($24,500 a month) to every company ($26.7 billion a year).
2. **Giving page, Find.** Click **Try a sample company**. Watch the statement scan: each
   transaction streams past, AI charges light up, and the AI spend total climbs.
3. **Choose.** "Northgate Freight spent $18,822 on AI in September, up 29% since July."
   Drag the dial, then set it back to 1%.
4. **Give $188.22 for September.** The thank-you counts the gift up, then the community
   grows from 45 to 46 companies. The landing page next to it updates at the same moment:
   new totals, and Northgate Freight at the top of the record.
5. **Home.** Next gift on November 1 goes to Engineers Without Borders Canada (SDG 17.8).
   Open the invoice; mark the gift received to show the tax receipt.

Click **Start over** before each take.

## Tests

```bash
npm --prefix server test
npm --prefix web test
```
