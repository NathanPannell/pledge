// Checkout math for a usage-credit purchase with a volume discount, estimated
// tax and an optional round-up. All amounts are integer cents so totals never
// drift. Works in the browser (window.RoundUp) and in Node tests.
(function (root) {
  // Volume tiers offered on the purchase page.
  const TIERS = [
    { amount: 100, discount: 0.1 },
    { amount: 250, discount: 0.2 },
    { amount: 1000, discount: 0.3 },
  ];

  // Estimated tax for a British Columbia billing address (GST 5% + PST 7%).
  const TAX_RATE = 0.12;

  function discountFor(amount) {
    const tier = TIERS.find((t) => t.amount === amount);
    return tier ? tier.discount : 0;
  }

  function quote(amount, step, taxRate) {
    const rate = taxRate === undefined ? TAX_RATE : taxRate;
    const credits = Math.round(amount * 100);
    const discount = Math.round(credits * discountFor(amount));
    const tax = Math.round((credits - discount) * rate);
    const total = credits - discount + tax;
    const stepCents = step * 100;
    const rounded = Math.ceil(total / stepCents) * stepCents;
    return { credits, discount, tax, total, rounded, roundUp: rounded - total };
  }

  function usd(cents) {
    return "US$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function dollars(cents) {
    return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const api = { TIERS, TAX_RATE, discountFor, quote, usd, dollars };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RoundUp = api;
})(typeof window !== "undefined" ? window : globalThis);
