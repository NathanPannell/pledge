# Tributary (StormHacks)

Hackathon project for UN SDG 17 (Partnerships for the Goals). Tributary is a round-up
button inside AI providers' credit checkouts: the buyer rounds their total up to the
next $1 or $5, and the change goes to a development project chosen each month.

## Layout

- `web/` static pages, no build step. Serve the folder (see README).
  - `index.html` Tributary landing page: message, running totals, project of the month,
    latest round-ups, giving history, provider pitch.
  - `settings/usage.html` unbranded Settings > Usage page and "Buy more usage" checkout with
    the round-up in the order summary. Mirrors the native purchase steps.
  - `assets/roundup.js` checkout math (volume discount, estimated tax, round-up), in cents.
  - `assets/styles.css`, `assets/site.js` shared Tributary styles and helpers.
- `proxy/` Node metering proxy from an earlier direction. Not part of the current demo.

## Conventions

- The pages present sample figures as real for a local demo. They are not labeled as
  samples on purpose. Do not publish or deploy them as-is.
- The settings page must stay free of any real provider's name, logo or branding.
- The checkout writes completed round-ups to `localStorage` key `tributary.roundups`;
  the landing page reads it to update totals and the feed.
- Run tests with `npm --prefix web test` and `npm --prefix proxy test`.
