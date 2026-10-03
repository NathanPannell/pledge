// Checkout math for a USD credit purchase charged in CAD, with an optional
// round-up. Works in the browser (window.RoundUp) and in Node tests.
(function (root) {
  const USD_TO_CAD = 1.38;

  // Combined sales tax applied to digital services, by province.
  const PROVINCES = {
    BC: { name: "British Columbia", rate: 0.12, label: "GST 5% + PST 7%" },
    AB: { name: "Alberta", rate: 0.05, label: "GST 5%" },
    ON: { name: "Ontario", rate: 0.13, label: "HST 13%" },
    QC: { name: "Quebec", rate: 0.14975, label: "GST 5% + QST 9.975%" },
  };

  // Work in integer cents so totals never drift by a fraction of a cent.
  function toCents(dollars) {
    return Math.round(dollars * 100);
  }

  function quote(usdAmount, provinceCode, step) {
    const province = PROVINCES[provinceCode];
    const subtotal = toCents(usdAmount * USD_TO_CAD);
    const tax = Math.round(subtotal * province.rate);
    const total = subtotal + tax;
    const stepCents = step * 100;
    const rounded = Math.ceil(total / stepCents) * stepCents;
    return {
      usd: toCents(usdAmount),
      subtotal,
      tax,
      total,
      rounded,
      roundUp: rounded - total,
      province,
    };
  }

  function cad(cents) {
    return "C$" + (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const api = { USD_TO_CAD, PROVINCES, quote, cad };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RoundUp = api;
})(typeof window !== "undefined" ? window : globalThis);
