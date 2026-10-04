import { test } from "node:test";
import assert from "node:assert/strict";
import { detectVendor } from "../src/vendors.js";
import { basisCents, clampRate, pledgeCents } from "../src/pledge.js";
import { hint, open, seal } from "../src/secrets.js";
import { randomBytes } from "node:crypto";
import { buildCustomUser } from "../src/sandbox-config.js";
import { sampleGifts } from "../src/community.js";

test("detects AI vendors from card descriptors", () => {
  assert.equal(detectVendor("ANTHROPIC, PBC API CREDITS"), "Anthropic");
  assert.equal(detectVendor("OPENAI *CHATGPT TEAM"), "OpenAI");
  assert.equal(detectVendor("CURSOR, INC. TEAMS"), "Cursor");
  assert.equal(detectVendor("GITHUB COPILOT BUSINESS"), "GitHub Copilot");
  assert.equal(detectVendor("AMAZON WEB SERVICES"), null);
  assert.equal(detectVendor("WEWORK VANCOUVER"), null);
  assert.equal(detectVendor(""), null);
});

test("pledge basis never double counts card and provider spend", () => {
  const spend = { cardCents: 5000, providerCents: 3000 };
  assert.equal(basisCents(spend, "card"), 5000);
  assert.equal(basisCents(spend, "provider"), 3000);
  assert.equal(basisCents(spend, "auto"), 5000);
});

test("pledge math and clamping", () => {
  assert.equal(pledgeCents(489040, 0.01), 4890);
  assert.equal(clampRate(0), 0.0025);
  assert.equal(clampRate(1), 0.05);
  assert.equal(clampRate("abc"), 0.01);
});

test("sealed secrets round-trip and hints hide the key", () => {
  const key = randomBytes(32);
  const sealed = seal(key, "sk-ant-admin01-abcdefghijkl");
  assert.ok(!sealed.includes("abcdef"));
  assert.equal(open(key, sealed), "sk-ant-admin01-abcdefghijkl");
  assert.equal(hint("sk-ant-admin01-abcdefghijkl"), "sk-ant-…ijkl");
});

test("sample community gifts cover last month", () => {
  const gifts = sampleGifts(new Date(Date.UTC(2026, 9, 3)));
  assert.equal(gifts.length, 8);
  assert.ok(gifts.every((g) => g.period_start === "2026-09-01" && g.period_end === "2026-09-30"));
  assert.equal(new Set(gifts.map((g) => g.number)).size, 8);
});

test("sandbox custom user has no future-dated transactions", () => {
  const today = new Date(Date.UTC(2026, 9, 3));
  const cfg = buildCustomUser(today);
  const txns = cfg.override_accounts[0].transactions;
  assert.ok(txns.every((t) => t.date_transacted <= "2026-10-03"));
  assert.ok(txns.some((t) => t.description.includes("ANTHROPIC")));
});
