# OpenRouter round-ups

This is the existing Spare Chrome extension and transactional ledger, integrated
into Pledge's one Node HTTP server. Start the **repository root**, not another
backend: `npm start`. Root `/api/*` belongs to the company flow;
`/roundups/api/*` belongs to the extension. See [architecture](../docs/ARCHITECTURE.md)
and [deployment](../docs/DEPLOYMENT.md).

`extension/` is a complete unpacked Chrome extension with bundled fonts; its
default configuration targets `https://pledge.pauravhp.com`. No npm or build is
needed to load that folder. It requires the hosted API and one-time pairing.
`npm run build` from the repository root additionally creates `.local/extension/`
and the download ZIP for `APP_ORIGIN` (or `EXTENSION_ORIGIN`); use the generated
folder for localhost testing or a new domain. Do not commit device tokens.

Detection, CAD rounding rules, and separate Stripe confirmation retain the previous
behavior. The popup, the OpenRouter panel and `/roundups/` use Pledge's design system
(the Figtree font is bundled in `extension/assets/`, with its licence). Already whole CAD totals do not prompt; otherwise round to
the next dollar, advancing another dollar if the gap is less than 15 cents.
Yes is an **unfunded pledge**. Only Stripe-verified sandbox payments clear the
reserved entries. Estimated CAD charges remain explicitly labeled estimates.

The installation/pairing/payment-return page is `/roundups/`; the landing page's
For individuals screen covers the same install steps and connection code. Previous web previews, phone screenshots, proof, and
their original build/browser scripts are retained in `../artifacts/spare-cad/`
and are not served. Those historical scripts are snapshots, not current entry
points. New browser commands are documented in the root README.

Migration files are additive and recorded in `local_migrations`. Never delete,
rename, or edit an applied migration; never reset or copy over a hosted ledger.
SQLite uses WAL, synchronous FULL, foreign keys, and atomic batches. Stripe
requests are outside database transactions and use persisted idempotency keys.
See `PRODUCT.md` for the original specification (its web-preview description is
historical; the active page now only installs/pairs and confirms payment returns).
