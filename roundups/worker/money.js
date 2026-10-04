export const MINIMUM_GIFT = 15;
export const DONATION_THRESHOLD = 500;
export function cents(value) {
  const s = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(s)) throw Object.assign(new Error('Enter an amount with up to two decimal places.'),{status:400});
  const [whole, fraction = ''] = s.split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(n) || n <= 0 || n > 100000000) throw Object.assign(new Error('Enter an amount between C$0.01 and C$1,000,000.'),{status:400});
  return n;
}
export function roundUp(cadCents) {
  if (!Number.isSafeInteger(cadCents) || cadCents <= 0 || cadCents > 100000000) throw new Error('Invalid CAD total.');
  const remainder = cadCents % 100;
  if (!remainder) return 0;
  const gap = 100 - remainder;
  return gap < MINIMUM_GIFT ? gap + 100 : gap;
}
// Bank of Canada rates are decimal strings; integer arithmetic avoids floating-point cent drift.
export function convertUSD(usdCents, rate, feeBasisPoints = 250) {
  if (!Number.isSafeInteger(usdCents) || usdCents <= 0 || usdCents > 100000000) throw new Error('Invalid USD total.');
  if (!/^\d\.\d{1,6}$/.test(String(rate)) || !Number.isInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints > 1000) throw new Error('Invalid FX inputs.');
  const [a,b] = String(rate).split('.');
  const scaledRate = BigInt(a) * 1000000n + BigInt(b.padEnd(6,'0'));
  const denominator = 10000000000n;
  return Number((BigInt(usdCents) * scaledRate * BigInt(10000 + feeBasisPoints) + denominator/2n) / denominator);
}
