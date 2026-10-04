import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig } from "../src/config.js";
import { openDb } from "../src/db.js";
import { createPlaid } from "../src/plaid.js";
import { loadOrCreateKey } from "../src/secrets.js";
import { createApp } from "../src/server.js";
import { createService } from "../src/service.js";
import { createStripe } from "../src/stripe.js";

const today = new Date().toISOString().slice(0, 10);
const calls = [];
let upstream;
let app;
let base;
let tmp;

// One mock server stands in for Plaid, Anthropic, OpenAI and Stripe.
function mockUpstream() {
  return createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const url = new URL(req.url, "http://x");
    calls.push({ method: req.method, path: url.pathname, headers: req.headers, raw, query: url.searchParams });
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/sandbox/public_token/create") return json(200, { public_token: "public-sandbox-1" });
    if (url.pathname === "/item/public_token/exchange") return json(200, { access_token: "access-sandbox-secret" });
    if (url.pathname === "/item/get") return json(200, { item: { institution_name: "First Platypus Bank" } });
    if (url.pathname === "/transactions/sync") {
      return json(200, {
        added: [
          { transaction_id: "t1", date: today, name: "ANTHROPIC, PBC API CREDITS", amount: 2400, merchant_name: null },
          { transaction_id: "t2", date: today, name: "OPENAI *API USAGE", amount: 1850.4, merchant_name: "OpenAI" },
          { transaction_id: "t3", date: today, name: "WEWORK VANCOUVER", amount: 1450, merchant_name: "WeWork" },
          { transaction_id: "t4", date: today, name: "CURSOR, INC. TEAMS", amount: 640, merchant_name: null },
        ],
        modified: [],
        removed: [],
        next_cursor: "cursor-1",
        has_more: false,
      });
    }
    if (url.pathname === "/v1/organizations/cost_report") {
      if (req.headers["x-api-key"] !== "sk-ant-admin01-good") return json(401, { error: { message: "invalid x-api-key" } });
      return json(200, {
        data: [{ starting_at: `${today}T00:00:00Z`, results: [{ amount: "123456.7", currency: "USD" }] }],
        has_more: false,
      });
    }
    if (url.pathname === "/v1/organization/costs") {
      return json(200, {
        data: [{ start_time: Math.floor(Date.now() / 1000), results: [{ amount: { value: 250.5, currency: "usd" } }] }],
        has_more: false,
      });
    }
    if (url.pathname === "/v1/customers") return json(200, { id: "cus_1" });
    if (url.pathname === "/v1/invoices") return json(200, { id: "in_1" });
    if (url.pathname === "/v1/invoiceitems") return json(200, { id: "ii_1" });
    if (url.pathname === "/v1/invoices/in_1/finalize") return json(200, { id: "in_1", hosted_invoice_url: "https://invoice.example/in_1" });
    json(404, { error: "unmocked " + url.pathname });
  });
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "tributary-"));
  upstream = mockUpstream();
  const mock = `http://127.0.0.1:${await listen(upstream)}`;
  const config = readConfig({
    PLAID_CLIENT_ID: "cid",
    PLAID_SECRET: "psecret",
    PLAID_ENV: "sandbox",
    PLAID_BASE_URL: mock,
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_BASE_URL: mock,
    ANTHROPIC_BASE_URL: mock,
    OPENAI_BASE_URL: mock,
    CHARITY_NAME: "Test Foundation",
  });
  const webRoot = join(tmp, "web");
  mkdirSync(webRoot);
  writeFileSync(join(webRoot, "index.html"), "<h1>hi</h1>");
  const service = createService({
    db: openDb(":memory:"),
    key: loadOrCreateKey(join(tmp, "data")),
    plaid: createPlaid(config.plaid),
    stripe: createStripe(config.stripe),
    config,
  });
  app = createApp({ service, webRoot });
  base = `http://127.0.0.1:${await listen(app)}`;
});

after(() => {
  app.close();
  upstream.close();
  rmSync(tmp, { recursive: true, force: true });
});

test("connecting anything before company setup is refused", async () => {
  const res = await api("POST", "/api/plaid/sandbox");
  assert.equal(res.status, 400);
  assert.match(res.body.error, /company/);
});

test("saves the company", async () => {
  const res = await api("POST", "/api/org", { name: "Northgate Freight", billingEmail: "ap@northgate.example" });
  assert.equal(res.status, 200);
  assert.equal(res.body.org.name, "Northgate Freight");
});

test("connects the sandbox business card and detects AI vendors", async () => {
  const res = await api("POST", "/api/plaid/sandbox");
  assert.equal(res.status, 200);
  const { body } = await api("GET", "/api/state");
  assert.equal(body.connections[0].label, "First Platypus Bank");
  assert.equal(body.spend.cardCents, 240000 + 185040 + 64000);
  assert.equal(body.spend.allCardCents, 240000 + 185040 + 64000 + 145000);
  assert.deepEqual(body.spend.vendors.map((v) => v.vendor), ["Anthropic", "OpenAI", "Cursor"]);
  const wework = body.transactions.find((t) => t.description.startsWith("WEWORK"));
  assert.equal(wework.vendor, null);
});

test("sends the custom sandbox user to Plaid", () => {
  const create = calls.find((c) => c.path === "/sandbox/public_token/create");
  const sent = JSON.parse(create.raw);
  assert.equal(sent.options.override_username, "user_custom");
  const cfg = JSON.parse(sent.options.override_password);
  assert.ok(cfg.override_accounts[0].transactions.length > 20);
});

test("rejects a bad Anthropic admin key with the provider's message", async () => {
  const res = await api("POST", "/api/providers/anthropic", { key: "sk-ant-admin01-bad" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /invalid x-api-key/);
});

test("connects Anthropic and OpenAI cost reports", async () => {
  assert.equal((await api("POST", "/api/providers/anthropic", { key: "sk-ant-admin01-good" })).status, 200);
  assert.equal((await api("POST", "/api/providers/openai", { key: "sk-admin-openai" })).status, 200);
  const { body } = await api("GET", "/api/state");
  // Anthropic reports cents as a decimal string; OpenAI reports dollars.
  const byName = Object.fromEntries(body.spend.providers.map((p) => [p.vendor, p.cents]));
  assert.equal(byName.Anthropic, 123457);
  assert.equal(byName.OpenAI, 25050);
});

test("never returns secrets to the browser", async () => {
  const { body } = await api("GET", "/api/state");
  const text = JSON.stringify(body);
  assert.ok(!text.includes("access-sandbox-secret"));
  assert.ok(!text.includes("sk-ant-admin01-good"));
  assert.ok(!text.includes("sk-admin-openai"));
  assert.ok(body.connections.every((c) => !("secret" in c)));
});

test("issues a Stripe invoice for the pledge on the larger basis", async () => {
  await api("POST", "/api/pledge", { rate: 0.01, basis: "auto" });
  const res = await api("POST", "/api/invoices", { start: "2000-01-01", end: today });
  assert.equal(res.status, 200);
  const inv = res.body.invoice;
  // Card AI spend 4,890.40 beats provider spend 1,484.57, so 1% of card spend.
  assert.equal(inv.basis_cents, 489040);
  assert.equal(inv.amount_cents, 4890);
  assert.equal(inv.stripe_url, "https://invoice.example/in_1");
  assert.match(inv.number, /^TRB-\d{6}-001$/);
  const item = calls.find((c) => c.path === "/v1/invoiceitems");
  assert.match(item.raw, /amount=4890/);
});

test("the public ledger shows the pledge and marks it paid", async () => {
  const { body: before } = await api("GET", "/api/ledger");
  assert.equal(before.totals.pledged, 4890);
  assert.equal(before.entries[0].company, "Northgate Freight");
  const id = (await api("GET", "/api/state")).body.invoices[0].id;
  await api("POST", `/api/invoices/${id}/paid`);
  const { body: after } = await api("GET", "/api/ledger");
  assert.equal(after.totals.paid, 4890);
});

test("pledge rate is clamped to the dial's range", async () => {
  const res = await api("POST", "/api/pledge", { rate: 0.9, basis: "card" });
  assert.equal(res.body.org.pledgeRate ?? res.body.org.pledge_rate, 0.05);
});

test("demo seed leaves two paid months and last month ready to give", async () => {
  assert.equal((await api("POST", "/api/demo")).status, 200);
  const { body } = await api("GET", "/api/state?start=2000-01-01&end=" + today);
  assert.equal(body.org.name, "Northgate Freight");
  assert.equal(body.connections[0].kind, "demo");
  assert.equal(body.invoices.length, 2);
  assert.ok(body.invoices.every((i) => i.status === "paid" && i.amount_cents > 0));
  const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  assert.ok(body.invoices.every((i) => i.period_end < lastMonth));
  assert.equal(body.goal.raisedCents, body.invoices.reduce((s, i) => s + i.amount_cents, 0));
  // Refresh skips the demo card instead of calling Plaid with it.
  assert.equal((await api("POST", "/api/refresh")).status, 200);
});

test("reset clears everything", async () => {
  await api("POST", "/api/reset");
  const { body } = await api("GET", "/api/state");
  assert.equal(body.org, null);
  assert.equal(body.connections.length, 0);
});

test("serves the web app and keeps paths inside it", async () => {
  const ok = await fetch(base + "/");
  assert.equal(ok.status, 200);
  const escape = await fetch(base + "/..%2f..%2fpackage.json");
  assert.equal(escape.status, 404);
});
