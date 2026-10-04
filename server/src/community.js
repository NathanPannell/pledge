// Sample giving from other companies for the demo. Merged with real records
// by service.community(); turned off with COMMUNITY_SAMPLE=off.

export const SAMPLE = {
  companies: 45,
  monthlyCents: 2450000,
  totalCents: 14680000,
};

// Recent monthly gifts, newest first. Period is the month the gift covers.
const RECENT = [
  ["Cedarline Robotics", 1840.0],
  ["Lumen Harbour Labs", 1312.45],
  ["Seawall Software", 968.2],
  ["Kitsilano Data Co.", 744.9],
  ["Burrard Analytics", 611.35],
  ["Fraser Signal", 507.8],
  ["Granville Studio", 382.15],
  ["Coquitlam Cloudworks", 296.6],
];

export function sampleGifts(today = new Date()) {
  const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const start = month.toISOString().slice(0, 10);
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const issued = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString();
  return RECENT.map(([company, dollars], i) => ({
    number: `TRB-${end.slice(0, 4)}${end.slice(5, 7)}-${String(101 + i).padStart(3, "0")}`,
    company,
    period_start: start,
    period_end: end,
    amount_cents: Math.round(dollars * 100),
    charity: null,
    status: i < 5 ? "paid" : "issued",
    created_at: issued,
  }));
}
