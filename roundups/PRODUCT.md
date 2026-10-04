# Spare CAD prototype

Audience: Canadians buying USD AI credits or subscriptions directly from providers.
The customer task is one small Yes to add a CAD pledge, followed by a separate
confirmation when pending pledges reach C$5. This build remains sandbox-only.

The intended future charity is VGH & UBC Hospital Foundation. There is no claimed
partnership, real donation, grant, or tax receipt. All demo payment copy says so.
The two earlier prototypes remain available and unchanged.

Use a displayed final CAD amount when available, an explicitly entered CAD total
as a fallback, or a clearly labelled estimate using the latest Bank of Canada
daily USD/CAD benchmark and a visible 2.5% assumed card FX fee. Actual issuer
conversion, taxes and merchant conversion can differ. Never call an estimate exact.

All monetary amounts are integer cents. A whole-dollar total produces no offer;
otherwise use the next whole CAD dollar. If the gap is below C$0.15, use the
following dollar. Exactly C$0.15 qualifies. Confirming a quote records an unfunded
pledge, never a debit or reservation of money. At C$5 or more, ask again and open
Stripe Checkout in CAD. Stripe owns all card fields and optional card saving.

Database-backed anonymous accounts use HttpOnly cookies. The browser extension
connects to that account through a one-time, five-minute pairing code and a
revocable device credential. No bank connection or AI API key is required.
Account recovery across devices and email/Google signup are outside this MVP.

SQLite/D1 is the authoritative ledger. Quote and pledge uniqueness prevents
duplicate credit. An atomic batch reserves one active checkout and an immutable
amount. Verified payment settles exactly the reserved rows in the same database
transaction; new pledges stay pending. Stripe calls sit outside database
transactions and use durable idempotency keys. These are retry-safe distributed
operations, not a claim of a distributed ACID transaction with Stripe.

The website reproduces the compact extension surface on phones. The installable
MV3 extension only watches explicitly allowlisted billing pages, visible total
labels and supported provider checkout redirects. It does not inspect card inputs
or run a bank-feed watcher. Provider support is recorded in the E2E report, not
inferred from an adapter existing. Unknown or ambiguous totals yield no auto-offer.

Demo controls outside the customer prompt supply example purchases and seven
explicitly synthetic unfunded pledges to exercise the C$5 threshold. A real Stripe
sandbox payment is possible; real AI purchases are not authorized by this build.

## Current verified scope

OpenRouter credit checkout only. Detect its visible final Total due including service fees; never infer a purchase from the account balance. Other provider adapters are outside the current scope. Invalid or absent totals dismiss an unapproved offer, and changing totals replace it before approval. A prior approved pledge remains independent of the provider purchase.
