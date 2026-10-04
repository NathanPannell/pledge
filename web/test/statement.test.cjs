const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseCsv, readStatement, summarize, toIsoDate, toAmount } = require("../assets/statement.js");

const VENDORS = [
  { name: "Anthropic", source: "ANTHROPIC|CLAUDE\\.AI", flags: "i" },
  { name: "OpenAI", source: "OPENAI|CHATGPT", flags: "i" },
];

test("parses quoted fields with commas and doubled quotes", () => {
  const rows = parseCsv('a,b\r\n"ANTHROPIC, PBC","say ""hi"""\n');
  assert.deepEqual(rows, [["a", "b"], ["ANTHROPIC, PBC", 'say "hi"']]);
});

test("keeps only AI charges and totals them by vendor", () => {
  const csv = [
    "Transaction Date,Description,Amount",
    '2026-09-02,"ANTHROPIC, PBC API CREDITS",3800.00',
    "2026-09-03,OPENAI *API USAGE,2950.40",
    "2026-09-04,WEWORK VANCOUVER,4200.00",
  ].join("\n");
  const out = readStatement(csv, VENDORS);
  assert.equal(out.totalRows, 3);
  assert.equal(out.rows.length, 2);
  assert.ok(!out.rows.some((r) => r.description.includes("WEWORK")));
  assert.equal(out.byVendor[0][0], "Anthropic");
  assert.equal(Math.round(out.total * 100), 675040);
});

test("handles banks that show charges as negative, in a debit column, or with MM/DD/YYYY dates", () => {
  const negative = readStatement("Date,Payee,Amount\n09/02/2026,ANTHROPIC,\"-$3,800.00\"\n09/03/2026,OPENAI,-12.50\n", VENDORS);
  assert.deepEqual(negative.rows.map((r) => r.amount), [3800, 12.5]);
  assert.equal(negative.rows[0].date, "2026-09-02");
  const debit = readStatement("Posted Date,Description,Debit,Credit\n2026-09-02,ANTHROPIC,100.00,\n2026-09-05,ANTHROPIC,,100.00\n", VENDORS);
  assert.equal(debit.rows.length, 1);
});

test("keeps every charge locally for the scan view, but only AI rows for sending", () => {
  const csv = "Date,Description,Amount\n2026-09-02,ANTHROPIC,10\n2026-09-03,WEWORK,20\n2026-09-04,Payment received,-500\n";
  const out = readStatement(csv, VENDORS);
  assert.equal(out.all.length, 2);
  assert.deepEqual(out.all.map((r) => r.vendor), ["Anthropic", null]);
  assert.deepEqual(Object.keys(out.rows[0]).sort(), ["amount", "date", "description"]);
});

test("summarizes AI spend by month and growth across full months", () => {
  const rows = [
    { date: "2026-07-05", amount: 100 },
    { date: "2026-08-05", amount: 120 },
    { date: "2026-09-05", amount: 150 },
    { date: "2026-10-01", amount: 40 },
  ];
  const s = summarize(rows, new Date(Date.UTC(2026, 9, 3)));
  assert.equal(s.lastFull.month, "2026-09");
  assert.equal(s.lastFull.total, 150);
  assert.equal(s.growthFrom, "2026-07");
  assert.ok(Math.abs(s.growth - 0.5) < 1e-9);
  const single = summarize([{ date: "2026-09-05", amount: 10 }], new Date(Date.UTC(2026, 9, 3)));
  assert.equal(single.growth, null);
  assert.equal(summarize([{ date: "2026-10-01", amount: 10 }], new Date(Date.UTC(2026, 9, 3))).lastFull, null);
});

test("explains a file it can't read", () => {
  assert.match(readStatement("foo,bar\n1,2\n", VENDORS).error, /columns/);
  assert.match(readStatement("", VENDORS).error, /empty/);
});

test("date and amount helpers", () => {
  assert.equal(toIsoDate("25/09/2026"), "2026-09-25");
  assert.equal(toIsoDate("2026-9-5"), "2026-09-05");
  assert.equal(toAmount("(42.10)"), -42.1);
});
