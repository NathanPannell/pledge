# Tributary (StormHacks)

Hackathon project for UN SDG 17 (Partnerships for the Goals). Tributary routes a small
percentage of AI spend (API usage, subscriptions, corporate AI budgets) to development
projects, as international aid budgets decline.

## Layout

- `web/` static pages, no build step. Open the HTML files directly or serve the folder.
  - `index.html` landing page: running total, project of the month, contributors.
  - `organizations.html` pledge flow for companies.
  - `individuals.html` pledge flow for people.
  - `assets/` shared stylesheet and script.
- `proxy/` Node (no dependencies) metering proxy in front of OpenAI- or Anthropic-compatible
  APIs. Records usage and the pledge owed in a JSONL ledger.

## Conventions

- All figures, organizations and contributors on the pages are demo data. Never present
  them as real.
- Model prices in `proxy/prices.json` are placeholders. Verify against provider pricing
  before relying on them.
- Run proxy tests with `npm test` inside `proxy/`.
