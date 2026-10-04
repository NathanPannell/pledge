# Hosting and safe manual updates

## Current host

The same machine serves **the frontend and both API flows** through one enabled
user service, `spare-cad-demo.service`. Node binds only `127.0.0.1:4175`.
The existing loopback Caddy and named Cloudflare tunnel expose
`https://pledge.pauravhp.com`; ordinary app changes require no DNS, Caddy, or
tunnel changes. Restarting this one app service briefly affects both frontend
and APIs; no blue/green or zero-downtime claim is made.

| Location, relative to the host user's home | Purpose |
| --- | --- |
| `stormhacks/pledge/` | Editable Git checkout; never the live working directory |
| `.local/share/pledge/releases/<commit>/` | Immutable prepared source/build |
| `.local/share/pledge/current` | Active release symlink |
| `.local/share/pledge/previous` | Previous release for code rollback after later updates |
| `.config/pledge/demo.env` | Protected 0600 environment, sandbox keys, public origin, port, absolute data paths |
| `.local/state/pledge/roundups.sqlite` | Imported authoritative extension ledger, plus WAL/SHM |
| `.local/state/pledge/company/pledge.db` | Nathan's existing company database |
| `.local/state/pledge/company/secret.key` | Encryption key for his provider/Plaid tokens; keep with that database |
| `.local/state/pledge/backups/` | Consistent protected SQLite backups |
| `stormhacks/spare-cad/.local/openrouter-browser` | Existing protected provider session; outside this repo |

The hosted environment selects `COMPANY_STRIPE_MODE=local`, preserving Nathan's
original local monthly-invoice demo while extension checkout uses real Stripe
**sandbox** sessions. No real payments or charity payouts are enabled.
The webhook route exists, but it is not configured until a signing secret and
matching sandbox endpoint are registered. Redirect/state reconciliation verifies
payments in the meantime; do not describe the webhook as active.

## A friend develops locally

Requires Node 22.13+, npm, and Python 3. From the repository root:

```sh
cp .env.example .env
# Add STRIPE_API_KEY or STRIPE_SECRET_KEY: sandbox only; never commit it.
npm ci
npm start
```

The frontend and both APIs are at `http://localhost:5173`; setup is `/roundups/`.
`npm start` builds the ZIP before starting one server. Load the generated
`.local/extension/` in Chrome for localhost; `roundups/extension/` itself targets
the hosted domain. Keys never belong in extension/config.js or web assets.
Local databases are separate from hosting. Sharing a test key is not a deployment
dependency: collaborators can use their own sandbox, and unconfigured Stripe
still allows company demo invoices. Keep keys and test customer identifiers from
the same sandbox when using an existing ledger.

`npm --prefix server start` still starts the combined server, but run
`npm run build` first; root `npm start` is the recommended entry point.
Root `.env` wins over legacy `server/.env`; externally set environment wins over
both. Updating `.env` requires restarting the process and rebuilding the ZIP
if APP_ORIGIN/EXTENSION_ORIGIN changed. Build outputs are ignored.

## Pull and run only when the owner requests it

GitHub pushes do **not** deploy. Nathan can change his frontend in Git, while
the running service uses its existing immutable release. The integration branch
must be merged into main before the usual main-branch update workflow; never
deploy an older main that lacks the combined server.

When the owner says to pull/run a change:

1. Check this checkout for uncommitted work; preserve it, never use `reset --hard`.
2. Fetch/pull the agreed branch with authenticated Git; for main use
   `git switch main` then `git pull --ff-only`, and review changes.
3. From the clean checkout, run `python3 scripts/deploy.py --ref HEAD`.
4. Inspect both the landing/company flow and `/roundups/` on the public domain.
   Exercise affected browser flows against **isolated** data before activation.

The deployment helper serializes updates, archives the exact commit into a new
immutable release, installs locked dependencies, builds the package for the
hosted origin, runs all unit/API tests and validation, and starts a candidate on
a spare loopback port against **copies** of the hosted databases. It checks
frontend bytes and both APIs while the current service stays up. Only then does
it back up live databases, atomically switch the release symlink, restart the
app service, and check it; failed activation restores the previous code.
Private preparation logs stay under the state directory. Do not print env files
or credential-bearing logs while troubleshooting.

Release preparation adds a commit-specific query parameter to local asset links
in the archived company and `/roundups/` HTML, including the setup page's local
scripts and styles. The editable frontend files and visible UI stay unchanged;
new releases fetch matching JavaScript and CSS even when Cloudflare still caches
the previous unversioned URLs. This requires no cache-purge permission or changes
to the shared zone. After activation, verify the public page and its versioned
assets as well as the loopback checks; reload a tab opened before deployment.

No task, watcher, frontend hot reload, Git hook, or CI job may restart the hosted
service merely because someone edits/pushes code. Never run local `npm start`
on port 4175, point development at hosted data paths, or use the public reset API
to clean up tests. Keep the bind address loopback-only behind the existing edge.

## Rollback and migrations

After later deployments, `python3 scripts/deploy.py --rollback` switches to the
previous code release and checks it. It **does not restore older databases**:
restoring an old financial ledger can lose pledges or revive paid ones. Keep
migrations additive and backward-compatible; never edit an applied SQL file.
A migration that cannot run with the previous code needs a separately reviewed
roll-forward recovery plan before deployment. Retain backups and old releases.

## First-time import/cutover

This integration's initial cutover uses a staged release prepared with
`python3 scripts/deploy.py --stage-only --import-source /absolute/old/hosted.sqlite`.
Stop the old app service **only after** candidate tests succeed, then import the
old SQLite using Python's SQLite `backup()` API, check integrity and ledger
counts, and set file permissions to 0600. Never copy only a running `.sqlite`
file while its committed data can still be in `-wal`.

Preserve the old unit in the private backup directory, point `current` at the
prepared release, install `deploy/spare-cad-demo.service`, run
`systemctl --user daemon-reload`, and start the same service. Caddy/tunnel still
target port 4175. If initial activation fails, the old source remains available;
restore its saved unit but set `SPARE_DB` to the **new external authoritative
ledger** before restarting it, so rollback never rewinds financial records.
After initial cutover, use the normal release helper, not another import.

## Future domain

When the owner provides a new domain, configure its existing approved edge
route, update protected APP_ORIGIN, and prepare/deploy a new extension package
with matching host permission and Stripe return origin. Keep old-domain API
compatibility during migration, or instruct installed users to reload/reconnect;
changing DNS alone does not update an extension's packaged backend address.
