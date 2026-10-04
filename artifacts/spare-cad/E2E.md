# Spare verification — 2026-10-04

Public demo: https://pledge.pauravhp.com
Proof: https://pledge.pauravhp.com/proof/index.html
Release extension: https://pledge.pauravhp.com/extension.zip

## Live OpenRouter, release extension, public backend

Passed with persistent OpenRouter login and the actual release MV3 extension (endpoint configuration unchanged). Provider Purchase was never submitted. Final quote: USD 10.80 (USD 10 credits + USD 0.80 service fee, tax N/A). USD denomination corroborated by https://openrouter.ai/support/. With Bank of Canada benchmark 1.4246 plus an explicitly assumed 2.5% card fee: estimated CAD 15.77; round-up CAD 0.23 to CAD 16.00. This is not the card issuer’s exact CAD charge.

Verified no prompt on balance-only screen; final merchant total triggers offer; changing credits updates total including fees; manual CAD29.99 produces a CAD1.01 pledge to CAD31.00; whole CAD30.00 removes unapproved offer; Yes records an unfunded pledge; CAD4.84 of explicit synthetic setup plus CAD0.23 immediately opens the threshold prompt; second Yes opens a separate CAD5.07 Stripe sandbox Checkout; test payment clears precisely that reserved balance after server verification. No real provider purchase or donation occurred.

## Hosted phone and ledger test

Passed at 390px against the public domain: concurrent duplicate Yes requests produce one pledge; repeated checkout requests reuse one reservation/session; actual systemd service restart preserves CAD5.36 of pending pledges; cancellation return expires Stripe checkout and preserves all unpaid pledges; subsequent CAD5.36 sandbox payment settles once; reload retains paid balance; another browser account cannot see the payment or balance. Cancellation was tested through the app’s cancel-return URL (and native Stripe backlink when available).

Eighteen automated financial/API/detector checks pass: minimum/whole/integer rounding, malformed/ambiguous currency rejection, provider allowlist, duplicate pledges, concurrent reservation, ownership, settlement replay, transaction rollback, expired-checkout release, paid-row immutability, device revocation, forged-payment rejection, and close/reopen durability.

Public DNS was verified with Google and Cloudflare DNS; public TLS verified. The test browser pinned the published Cloudflare address to avoid the Netcup resolver’s cached NXDOMAIN after the new hostname was created. This changes only QA network resolution, not the extension endpoint, domain, certificate validation, app, or provider flow.

## Hosting and limits

Existing Cloudflare named tunnel → loopback Caddy → isolated `spare-cad-demo.service` on port4175. Private SQLite WAL ledger with synchronous FULL and atomic transactions/triggers, `.local/hosted.sqlite`. Service enabled with restart-on-failure. Sandbox key is loaded from Hermie at startup; the broader vault token is dropped before the backend starts. Migration files were preserved. Sites D1 deployment was abandoned after a migration error; no hosted D1 success is claimed.

OpenRouter-only checkout detection. Claude auth requests stopped and its existing profile/tab retained. No completed AI purchase or post-purchase receipt detection is claimed. A pledge records a user intention before purchase, and is not a transfer of money.

Stripe verifies payment on redirect or next account-state read; webhook route is implemented but no webhook signing secret is configured. This prototype makes no real donations. Live charity payments require a charity-approved recipient/payment arrangement. Cards saved at OpenRouter are not available to Spare. First payment requires Stripe details; saving a card for later payments requires explicit consent.

Sanitized screenshots and evidence: public/proof/. Authentication profiles, private investigation scripts, videos with unmasked account data, and credentials are excluded from published assets/source.
