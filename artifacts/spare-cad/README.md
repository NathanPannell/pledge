# Spare · OpenRouter CAD round-ups

Demo: https://pledge.pauravhp.com
Proof and phone screenshots: https://pledge.pauravhp.com/proof/index.html

## Try it

Open the demo on your phone or desktop. Try the CAD examples or “Try the C$5 checkout”. This is Stripe sandbox only; use test card `4242 4242 4242 4242`, a future expiry and any three-digit CVC. No real money moves.

On desktop Chrome, choose Install in Chrome, download/unzip the package, open `chrome://extensions`, enable Developer mode and Load unpacked. Generate a connection code in the demo and paste it into Spare’s popup. In OpenRouter → Settings → Credits → Add Credits, Spare detects the visible final total including fees. Your AI purchase stays with OpenRouter.

Yes adds an unfunded CAD pledge. At CAD5 or more, another Yes opens Stripe for a separately confirmed sandbox payment. Exact CAD entry is available; USD conversion is explicitly an estimate. Whole CAD totals do not prompt, and fractional gifts have a CAD0.15 minimum.

## Develop and verify

`npm install`, `npm run build`, `npm run test`, `npm run validate`. Fonts are checked into this project. Run local backend with `python3 scripts/with-vault.py node scripts/dev.mjs`; keys are loaded in memory from Hermie. Private `.local/` contains the database and browser profiles.

`SPARE_E2E_ORIGIN=https://pledge.pauravhp.com node scripts/live-openrouter-e2e.mjs` uses the existing protected OpenRouter browser profile and never clicks provider Purchase. `node scripts/deployed-e2e.mjs` verifies the hosted phone/payment flow. Both browser scripts currently use the preinstalled Playwright at `/tmp/spare-browser/node_modules/playwright/index.mjs`. Optional `SPARE_E2E_EDGE_IP` pins a verified public Cloudflare address for QA. `SPARE_E2E_RESTART=1` additionally tests actual local user-service restart. See E2E.md for results and scope.

## Deployment

User service template: deploy/spare-cad-demo.service. Enabled service: `spare-cad-demo.service`. Existing named Cloudflare tunnel and loopback Caddy route serve pledge.pauravhp.com. Backend binds only 127.0.0.1:4175; private SQLite WAL database persists across service restart. Restart after backend/bundled-asset changes with `systemctl --user restart spare-cad-demo.service`. Source/bootstrap secrets are never exposed as public files.

No real charity affiliation or tax receipts are represented. A vendor’s saved card is not shared with Spare.
