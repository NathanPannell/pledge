# One server, unchanged product flows

`server/src/main.js` starts **one Node process and one HTTP listener**, serving
Nathan's unchanged `web/` and both API handlers. There is no second backend
service and no extra frontend server. Node 22.13+ and Python 3 (extension ZIP
packaging) are required; runtime APIs use Node built-ins.

| Path | Owner and behavior |
| --- | --- |
| `/`, `/app.html`, `/invoice.html`, `/receipt.html`, `/assets/*` | Nathan's existing frontend, unchanged in this integration |
| `/api/*` | Nathan's company/statement/Plaid/provider/monthly invoice API |
| `/roundups/` | Direct extension install, pairing, pending balance, payment return; no link added to Nathan's UI |
| `/roundups/api/*` | Existing extension quote/pledge/pairing/Checkout API |
| `/roundups/extension.zip`, `/extension.zip` | Generated standalone MV3 package |
| `/artifacts/*` | Not served; retained source only |

`server/src/roundups.js` adapts Node requests to the existing ledger handler and
removes the mount prefix internally. It preserves headers, cookies, status codes,
CSRF checks, device authentication, and transactional ledger behavior.

Previously installed 0.1.0 extensions remain compatible: legacy `/api/*` calls
with a correctly shaped device Bearer token go to the round-up handler, and
legacy `/api/pair/redeem`, `/api/health`, `/api/webhook` are retained. Cookie-only
company `/api/state` and `/api/pledge` calls always go to Nathan's API, even if
the browser also has a `spare_session` cookie. Old Stripe root return URLs
redirect to `/roundups/`; new sessions return there directly. The popup and
OpenRouter overlay are unchanged; only endpoint configuration and the extension
version change. Existing device tokens and sessions survive database import.

## Data boundaries

Two SQLite files are opened **inside the same process**: Nathan's existing
`DATA_DIR/pledge.db` and the imported `ROUNDUPS_DB`. This avoids changing his
schema, keeps his demo's Start over behavior, and prevents it from deleting
extension pledges, accounts, device tokens, or checkout records. There is no
cross-database transaction because the product flows do not share operations.
The round-up ledger retains integer cents, atomic batch rollback, ownership
guards, payment matching, WAL, and synchronous FULL. Do not merge tables or
currencies merely because both flows use Stripe: monthly invoices remain USD;
extension payments remain CAD. The company flow's original manual Mark received
action and sample receipt stay as they were; they are not Stripe verification.

The company demo currently has one shared organization, no user authentication,
and a public reset/mark-paid API, as in Nathan's original implementation.
Preserving its behavior means it is a **shared sandbox demo**, not a production
multi-company service; use fictional statements/company data on the public
demo. Production accounts, real charity payments, and receipt issuance require
separate implementation and a charity-approved arrangement.

## Secrets and local development

Copy root `.env.example` to `.env`, add a Stripe **sandbox** key, then `npm start`.
Environment variables override root `.env`, which overrides legacy `server/.env`.
`STRIPE_SECRET_KEY` and `STRIPE_API_KEY` are aliases when only one is supplied;
different sandbox keys can be configured separately. The user chose
`COMPANY_STRIPE_MODE=local` for hosting and the root example: Nathan's invoices
retain his original local demo behavior even while the extension uses Stripe.
His optional Stripe invoicing can be enabled later with `COMPANY_STRIPE_MODE=stripe`
and the additional invoice permissions. Checkout does not require
a publishable key, since Stripe hosts card entry. Neither secret is sent to the
frontend or extension. A restricted shared key needs Customers, Invoices/Invoice
Items, Checkout Sessions, and Payment Intents permissions; keep it test-only.
Unconfigured Stripe preserves the existing local company invoice demo, while
extension payment attempts explain that sandbox Stripe is unavailable.

All `.env` files, databases and WAL/SHM, `.local/`, browser profiles, generated
downloads, test outputs, and hosting state are excluded from Git. Only
`.env.example` placeholders are committed. Hosted credentials and data are
outside repository and release folders, so a pull never replaces them.
No vault token is stored in the deployed environment. Optional local Hermie
startup is `SPARE_DROP_VAULT_TOKEN=1 python3 roundups/scripts/with-vault.py npm start`.

## Frontend work

Nathan can edit `web/` normally and optionally link a button/dropdown to
`/roundups/` or reuse installation content from `roundups/public/` and
`artifacts/spare-cad/public/`. Nothing is wired into his UI in this integration.
Preserve API namespaces and payment-return handling, and run both test suites
before deployment. Pushing GitHub changes does not automatically deploy them.
