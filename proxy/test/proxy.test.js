import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLedger } from "../src/ledger.js";
import { createProxy } from "../src/server.js";

// $1 per 1M input tokens, $4 per 1M output tokens, so costs are easy to check.
const PRICES = { default: { input: 1, output: 4 }, models: { "big-": { input: 10, output: 40 } } };
const RATE = 0.01;

let upstream;
let proxy;
let base;
let lastUpstreamHeaders;
let tmp;

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

function mockUpstream() {
  return createServer((req, res) => {
    lastUpstreamHeaders = req.headers;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/v1/chat/completions") {
        const parsed = JSON.parse(body);
        if (parsed.stream) {
          res.writeHead(200, { "content-type": "text/event-stream" });
          res.write('data: {"model":"small-1","choices":[{"delta":{"content":"Hi"}}],"usage":null}\n\n');
          res.write('data: {"model":"small-1","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":50}}\n\n');
          res.end("data: [DONE]\n\n");
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ model: "small-1", usage: { prompt_tokens: 1000, completion_tokens: 500 } }));
        return;
      }
      if (req.url === "/v1/messages") {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write('event: message_start\ndata: {"type":"message_start","message":{"model":"big-2","usage":{"input_tokens":2000,"output_tokens":1}}}\n\n');
        res.write('event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":300}}\n\n');
        res.end('event: message_stop\ndata: {"type":"message_stop"}\n\n');
        return;
      }
      if (req.url === "/v1/fail") {
        res.writeHead(429, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "rate_limited", usage: { prompt_tokens: 5, completion_tokens: 5 } }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
}

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "tributary-"));
  upstream = mockUpstream();
  const upstreamPort = await listen(upstream);
  const upstreamUrl = `http://127.0.0.1:${upstreamPort}`;
  proxy = createProxy({
    upstreams: { openai: upstreamUrl, anthropic: upstreamUrl },
    prices: PRICES,
    pledgeRate: RATE,
    ledger: createLedger(join(tmp, "ledger.jsonl")),
  });
  base = `http://127.0.0.1:${await listen(proxy)}`;
});

after(() => {
  proxy.close();
  upstream.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function summary() {
  const res = await fetch(`${base}/tributary/summary`);
  return { res, body: await res.json() };
}

test("passes a JSON completion through unchanged and records its pledge", async () => {
  const res = await fetch(`${base}/openai/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer sk-test", "x-tributary-key": "acme" },
    body: JSON.stringify({ model: "small-1", messages: [] }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.usage.prompt_tokens, 1000);

  assert.equal(lastUpstreamHeaders.authorization, "Bearer sk-test");
  assert.equal(lastUpstreamHeaders["x-tributary-key"], undefined, "contributor key must not reach the provider");

  const { body: s } = await summary();
  assert.equal(s.calls, 1);
  // 1000 * $1/M + 500 * $4/M = $0.003, pledge at 1% = $0.00003
  assert.ok(Math.abs(s.costUsd - 0.003) < 1e-12);
  assert.ok(Math.abs(s.contributors.acme - 0.00003) < 1e-12);
});

test("meters an OpenAI stream from its final usage chunk", async () => {
  const res = await fetch(`${base}/openai/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "small-1", stream: true }),
  });
  const text = await res.text();
  assert.match(text, /\[DONE\]/);
  const { body: s } = await summary();
  assert.equal(s.calls, 2);
  assert.equal(s.inputTokens, 1100);
  assert.equal(s.outputTokens, 550);
});

test("meters an Anthropic stream and applies the model's price", async () => {
  await (await fetch(`${base}/anthropic/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tributary-key": "acme" },
    body: JSON.stringify({ model: "big-2", stream: true }),
  })).text();
  const { body: s } = await summary();
  assert.equal(s.calls, 3);
  // 2000 * $10/M + 300 * $40/M = $0.032 on top of $0.003 + $0.0003
  assert.ok(Math.abs(s.costUsd - 0.0353) < 1e-12);
});

test("does not record a pledge for failed upstream calls", async () => {
  const res = await fetch(`${base}/openai/v1/fail`, { method: "POST", body: "{}" });
  assert.equal(res.status, 429);
  const { body: s } = await summary();
  assert.equal(s.calls, 3);
});

test("summary allows cross-origin reads for the landing page", async () => {
  const { res, body } = await summary();
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.equal(body.pledgeRate, RATE);
});

test("rejects unknown providers with a helpful message", async () => {
  const res = await fetch(`${base}/mystery/v1/x`);
  assert.equal(res.status, 404);
  assert.match((await res.json()).detail, /openai/);
});

test("ledger file is append-only JSONL and rebuilds totals on restart", () => {
  const path = join(tmp, "ledger.jsonl");
  const lines = readFileSync(path, "utf8").trim().split("\n");
  assert.equal(lines.length, 3);
  const reloaded = createLedger(path).summary();
  assert.equal(reloaded.calls, 3);
});
