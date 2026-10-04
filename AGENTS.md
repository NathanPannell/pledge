# Pledge integration and hosted-service boundaries

Read `docs/ARCHITECTURE.md` and `docs/DEPLOYMENT.md` before changing server startup,
routes, migrations, environment loading, builds, or deployment. `CLAUDE.md`
describes Nathan's original flow; its frontend and product behavior were retained.

- One Node process serves `web/`, company `/api/*`, and `/roundups/api/*`.
- Do not start a second production backend or change Caddy/tunnel configuration
  for ordinary updates; the combined server keeps loopback port 4175.
- Keep company and round-up databases independent; company reset must never
  affect the round-up ledger. Preserve CAD/15-cent/C$5 behavior and sandbox-only
  payments. Never submit a real AI credit purchase during E2E.
- Preserve device Bearer compatibility routes and Stripe return redirects.
- `artifacts/` is not a static root. Adding installation UI to `web/` is separate
  frontend work; this integration intentionally makes no such changes.
- Never commit `.env`, SQLite/WAL/SHM, browser profiles, vault tokens, Stripe
  credentials, or deployment backups. Keep hosted data and secrets outside releases.
- The running service uses an immutable release, not this editable checkout.
  Pulling/building/testing here must not disrupt it. Deployment is manual, only
  after the user requests it; use the documented candidate checks and rollback.
- Do not edit/remove applied migrations; add new backward-compatible migrations.
  Rollbacks switch code, never rewind financial data or erase new pledges.
- Never request Claude magic links; current live-provider E2E scope is OpenRouter.
- Local `.env` startup must work without 1Password; sandbox key aliases support
  collaborators' own environment. For this host's protected vault bootstrap,
  follow parent workspace `AGENTS.md` and `roundups/scripts/with-vault.py`.
- Run `npm test`, `npm run validate`, and applicable browser tests after changes.
  Public company demo is a shared single organization; do not store real users'
  private statements or treat its sample receipts as official receipts.
