# Tributary

International aid budgets are falling while AI budgets keep growing. Tributary routes a
small share of AI spend to development projects aligned with UN SDG 17 (Partnerships for
the Goals). Organizations meter their API usage through a proxy or pledge a share of
their AI budget. Individuals add a small top-up to their subscriptions.

StormHacks 2026 prototype. All figures, organizations and contributors on the pages are
demo data.

## Run the pages

No build step. Serve the `web` folder:

```bash
python -m http.server 5173 --directory web
```

Then open http://localhost:5173. Pages:

- `index.html` landing page with running totals, project of the month and contributor register
- `organizations.html` organization pledge flow
- `individuals.html` individual pledge flow

## Run the proxy

Requires Node 20 or later. No dependencies.

```bash
npm --prefix proxy start
```

Point a client at it by changing the base URL:

- OpenAI-compatible: `http://localhost:8787/openai/v1`
- Anthropic: `http://localhost:8787/anthropic`

Send `x-tributary-key: <contributor id>` to attribute usage. The proxy strips that header
before forwarding. It forwards everything else unchanged, reads token usage from JSON and
streamed responses, prices the call with `proxy/prices.json`, and appends a ledger line to
`proxy/data/ledger.jsonl`. Prompts and outputs are not stored.

`GET /tributary/summary` returns totals. The landing page reads it when the proxy is
running and adds a "Your local proxy" row to the register.

Configuration (environment variables):

| Variable | Default |
|---|---|
| `PORT` | `8787` |
| `PLEDGE_RATE` | `0.005` (0.5% of metered cost) |
| `OPENAI_UPSTREAM` | `https://api.openai.com` |
| `ANTHROPIC_UPSTREAM` | `https://api.anthropic.com` |
| `PRICES_PATH` | `proxy/prices.json` |
| `LEDGER_PATH` | `proxy/data/ledger.jsonl` |

The prices in `prices.json` are placeholders. Add real per-model prices before relying on
the cost figures.

## Tests

```bash
npm --prefix proxy test
```

## Not built yet

- Payments. Both pledge flows end in a demo confirmation.
- A shared ledger. The proxy ledger is a local file.
- Proxy authentication, rate limiting and deployment.
