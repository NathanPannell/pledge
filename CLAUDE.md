# Tributary (StormHacks 2026)

Companies connect a business card (Plaid) and AI provider admin keys (Anthropic, OpenAI
cost reports). Tributary measures AI spend, the company sets a pledge rate on a dial, and
Tributary issues one invoice per period (Stripe Invoicing). Pledges go to a charity partner
and are listed on a public ledger. UN SDG 17.

## Layout

- `server/` Node 22.13+, no npm dependencies. Built-in `node:sqlite`, plain `fetch`.
  - `src/main.js` entry; serves `web/` and `/api/*` on one port (default 5173).
  - `src/service.js` all business logic; `src/server.js` HTTP routing and static files.
  - `src/plaid.js`, `src/providers.js`, `src/stripe.js` external API clients.
  - `src/vendors.js` AI vendor detection from card descriptors.
  - `src/pledge.js` pledge math in integer cents.
  - `src/sandbox-config.js` Plaid sandbox custom user (demo business card).
  - `data/` SQLite database and encryption key. Git-ignored.
- `web/` static frontend, no build step.
  - `index.html` landing page and public ledger (reads `/api/ledger`).
  - `app.html`, `assets/app.js` dashboard.
  - `assets/tributary.css` shared design system: light mode, Figtree, SDG 17 navy brand,
    teal for money going to charity. Chart series: card `#2f6fd0`, usage `#1fa392`
    (validated for color-vision deficiency).
  - `settings/`, `console/`, `assets/roundup.js` older checkout mockups. Not linked. They
    must stay free of any real provider's name, logo or branding.
- `proxy/` older metering proxy. Not used.

## Conventions

- Money is integer cents everywhere on the server.
- Card and provider spend overlap; the pledge basis is one or the larger, never the sum.
- Secrets (Plaid access tokens, admin keys) are sealed with AES-256-GCM before storage and
  never returned by the API. Tests assert this.
- Stripe invoices are finalized, never emailed by the server.
- Charity name comes from `CHARITY_NAME` in `server/.env`.
- `src/community.js` adds sample giving from 45 other companies to real records so
  the landing page and giving page show a full community. `COMMUNITY_SAMPLE=off` turns
  it off. The sample is not real giving; never present it as real traction.
- Tests: `npm --prefix server test` (mock upstream for Plaid, Anthropic, OpenAI, Stripe),
  `npm --prefix web test`.
