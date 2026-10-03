const { test } = require("node:test");
const assert = require("node:assert/strict");
const { quote, usd, dollars, discountFor } = require("../assets/roundup.js");

test("$100 tier matches the native checkout: US$100.80 total", () => {
  const q = quote(100, 1);
  assert.equal(q.credits, 10000);
  assert.equal(q.discount, 1000);
  assert.equal(q.tax, 1080);
  assert.equal(q.total, 10080);
});

test("rounds US$100.80 up to US$101.00", () => {
  const q = quote(100, 1);
  assert.equal(q.rounded, 10100);
  assert.equal(q.roundUp, 20);
});

test("rounds to the next $5", () => {
  const q = quote(100, 5);
  assert.equal(q.rounded, 10500);
  assert.equal(q.roundUp, 420);
});

test("custom amounts get no volume discount", () => {
  assert.equal(discountFor(37), 0);
  const q = quote(37, 1);
  assert.equal(q.total, 4144);
  assert.equal(q.roundUp, 56);
});

test("a total that is already round has no round-up", () => {
  const q = quote(25, 1, 0);
  assert.equal(q.roundUp, 0);
});

test("console credits at face value: US$20 + 12% rounds US$22.40 to US$23.00", () => {
  const q = quote(20, 1, undefined, false);
  assert.equal(q.discount, 0);
  assert.equal(q.total, 2240);
  assert.equal(q.roundUp, 60);
});

test("formats cents", () => {
  assert.equal(usd(10080), "US$100.80");
  assert.equal(dollars(123456), "$1,234.56");
});
