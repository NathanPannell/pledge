const { test } = require("node:test");
const assert = require("node:assert/strict");
const { quote, cad } = require("../assets/roundup.js");

test("$25 USD in BC rounds C$38.64 up to C$39.00", () => {
  const q = quote(25, "BC", 1);
  assert.equal(q.subtotal, 3450);
  assert.equal(q.tax, 414);
  assert.equal(q.total, 3864);
  assert.equal(q.rounded, 3900);
  assert.equal(q.roundUp, 36);
});

test("rounding to the next $5", () => {
  const q = quote(25, "BC", 5);
  assert.equal(q.rounded, 4000);
  assert.equal(q.roundUp, 136);
});

test("a total that is already round has no round-up", () => {
  // C$100.00 subtotal in Alberta: 10000 + 500 tax = C$105.00 exactly.
  const q = quote(100 / 1.38, "AB", 5);
  assert.equal(q.total, 10500);
  assert.equal(q.roundUp, 0);
});

test("formats cents as Canadian dollars", () => {
  assert.equal(cad(3864), "C$38.64");
  assert.equal(cad(123456), "C$1,234.56");
});
