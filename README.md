# Tributary

Aid budgets are shrinking. AI budgets aren't. Tributary connects to a company's business
card and AI provider accounts, measures what it spends on AI, and invoices a pledge the
company sets on a dial (0.25% to 5%). Pledges go to a charity partner and appear on a
public ledger. Built for UN SDG 17 (Partnerships for the Goals) at StormHacks 2026.

## How it works

1. **Business card through Plaid.** Transactions are read, and AI charges are picked out
   by vendor (Anthropic, OpenAI, Cursor, Copilot and 12 more).
2. **Provider cost reports.** Optional Anthropic and OpenAI admin keys add usage-level
   daily costs. Keys are encrypted at rest and only used for the cost endpoints.
3. **The dial.** The pledge is calculated on card charges, provider usage, or the larger
   of the two. Never the sum, because the card usually pays the provider.
4. **One invoice.** Issued through Stripe Invoicing when a key is set (test mode for the
   demo), otherwise recorded locally. Every invoice appears on the public ledger.

## Setup

Requires Node 22.13 or later. No npm dependencies.

```bash
cp server/.env.example server/.env
```

Fill in `server/.env`:

| Variable | Where to get it | Needed for |
|---|---|---|
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | dashboard.plaid.com, Developers > Keys (sandbox) | Connecting a card |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com, test mode API keys (`sk_test_...`) | Sending invoices through Stripe |
| `CHARITY_NAME`, `CHARITY_DESCRIPTION` | Your charity partner | Invoices, ledger, landing page |

Anthropic and OpenAI admin keys are pasted in the dashboard, not in `.env`. Anthropic
admin keys need a Console organization; individual accounts can't create them.

## Run

```bash
npm --prefix server start
```

- http://localhost:5173/ landing page and public ledger
- http://localhost:5173/app.html dashboard

With Plaid sandbox keys, **Use demo card** connects a business card with four months of
realistic charges (AI vendors plus ordinary expenses) without going through Plaid Link.
**Connect card** opens real Plaid Link. Print the demo card's config for Plaid's Sandbox
Studio with `npm --prefix server run sandbox-config`.

To reset everything, stop the server and delete `server/data/`.

## Demo script

1. Landing page: the pitch, the charity partner, the empty public ledger.
2. Dashboard: set up the company, click **Use demo card**. AI vendors appear among
   ordinary expenses.
3. Add an Anthropic or OpenAI admin key for provider usage (optional).
4. Turn the dial. The pledge and the yearly estimate update live.
5. **Issue invoice for this period.** Open it in Stripe, mark it paid.
6. Back to the landing page: the pledge is on the public ledger.

## Tests

```bash
npm --prefix server test
npm --prefix web test
```

## Other folders

- `web/settings/usage.html`, `web/console/billing.html`: unbranded provider checkout
  mockups with a native round-up step, from an earlier direction ("future: a checkbox in
  every AI checkout").
- `proxy/`: metering proxy from an earlier direction. Not used.
