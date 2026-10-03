// Pledge math. All money is integer cents.

export const MIN_RATE = 0.0025;
export const MAX_RATE = 0.05;

export function clampRate(rate) {
  const r = Number(rate);
  if (!Number.isFinite(r)) return 0.01;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, r));
}

// Card charges are what the company paid; provider costs are what it used.
// They overlap when the card pays the provider, so the basis is one or the
// other, never the sum.
export function basisCents(spend, basis) {
  if (basis === "provider") return spend.providerCents;
  if (basis === "card") return spend.cardCents;
  return Math.max(spend.cardCents, spend.providerCents);
}

export function pledgeCents(basis, rate) {
  return Math.round(basis * clampRate(rate));
}

export function monthKey(date) {
  return String(date).slice(0, 7);
}
