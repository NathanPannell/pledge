# Pledge (StormHacks 2026)

A company finds its AI spend (card statement, Plaid, or provider cost reports), chooses a
share on a dial, and gives once a month to a rotating charity. Gifts are invoices payable
to the charity and listed on a public record. UN SDG 17.

## Layout

- `server/` Node 22.13+, no npm dependencies. Built-in `node:sqlite`, plain `fetch`.
  - `src/main.js` entry; serves `web/` and `/api/*` on one port (default 5173).
  - `src/service.js` all business logic; `src/server.js` HTTP routing and static files.
  - `src/plaid.js`, `src/providers.js`, `src/stripe.js` external API clients.
  - `src/vendors.js` AI vendor detection from card descriptors.
  - `src/pledge.js` pledge math in integer cents.
  - `src/charities.js` monthly charity rotation (proposal).
  - `src/community.js` sample giving from 45 other companies (see conventions).
  - `src/sandbox-config.js` realistic business card data, used for the sample statement
    (`GET /api/sample-statement.csv`) and the Plaid sandbox card.
  - `data/` SQLite database and encryption key. Git-ignored.
- `web/` static frontend, no build step.
  - `index.html`, `assets/landing.js` landing page: hero that rotates through the
    charities, live monthly total and gift stream, scale steps, gift record. Polls
    `/api/ledger` and listens on the `pledge` BroadcastChannel for gifts made in another tab.
    The Start giving menu opens For enterprise (`app.html`) or For individuals (a dialog
    about Pledge for Chrome).
  - `assets/extension.js`, `assets/extension.css` Pledge for Chrome install steps,
    connection codes and the round-up demo; shared with `/roundups/`.
  - `assets/fonts/` self-hosted Figtree (OFL), for pages whose security policy blocks
    Google Fonts.
  - `assets/chart.js` the scale chart: OpenAI + Anthropic annualized revenue against all
    foreign aid, with the projected crossing. Data and its derivation are at the top of
    the file; sources are notes 3 to 5 on the landing page.
  - `app.html`, `assets/app.js` guided Find, Choose, Give flow for a new company (with
    the animated statement scan of the gift month), then the company home.
  - `assets/statement.js` CSV parsing and AI matching in the browser.
  - `invoice.html`, `receipt.html` gift invoice and sample tax receipt.
  - `assets/pledge.css` shared design system: light mode, Figtree, SDG 17 navy brand,
    teal for money going to charity. `assets/pledge-mark.svg` is the logo and favicon.
  - `assets/motion.js` shared motion, loaded in `<head>`: scroll reveals, number tweens,
    "+$" chips, heart burst.
- `samples/` a card statement CSV for demoing the upload path. A web test pins its totals.
- `roundups/` Pledge for Chrome (extension, `/roundups/` page, ledger), merged from a
  teammate. See its README and `docs/ARCHITECTURE.md`.

## Conventions

- Money is integer cents everywhere on the server.
- Card and provider spend overlap; the pledge basis is one or the larger, never the sum.
- Secrets (Plaid access tokens, admin keys) are sealed with AES-256-GCM before storage and
  never returned by the API. Tests assert this.
- Statement uploads send only AI rows; the server re-checks every row.
- Stripe invoices are finalized, never emailed by the server.
- Disclaimers and sources go in the notes at the bottom of each page, never inline.
- The statement scan reads only the month the first gift is for and sums whole cents, so
  its total equals the Choose step's figure and the invoice.
- "Each month" figures use last full month's spend everywhere, so the first gift, the
  Choose step and the home dial agree.
- `COMMUNITY_SAMPLE=off` turns off the 45-company sample. The sample is not real giving;
  never present it as real traction.
- Motion respects `prefers-reduced-motion`. Styles that hide content until it is revealed
  only apply under `html.motion`, which motion.js sets when motion is allowed.
- The landing total stays still between gifts and rolls up over one second as each lands;
  it never ticks by the cent.
- Tests: `npm --prefix server test` (mock upstream for Plaid, Anthropic, OpenAI, Stripe),
  `npm --prefix web test`.
