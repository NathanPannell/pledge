import { test } from "node:test";
import assert from "node:assert/strict";
import { costUsd, priceFor, usageFromJson, usageFromSse } from "../src/metering.js";

test("reads OpenAI chat completion usage", () => {
  const u = usageFromJson({ model: "m", usage: { prompt_tokens: 3, completion_tokens: 4 } });
  assert.deepEqual(u, { model: "m", inputTokens: 3, outputTokens: 4 });
});

test("reads Responses API and Anthropic usage", () => {
  const u = usageFromJson({ model: "m", usage: { input_tokens: 7, output_tokens: 9 } });
  assert.deepEqual(u, { model: "m", inputTokens: 7, outputTokens: 9 });
});

test("returns null when a body has no usage", () => {
  assert.equal(usageFromJson({ error: "x" }), null);
  assert.equal(usageFromSse("data: {\"choices\":[]}\n\ndata: [DONE]\n"), null);
});

test("reads usage from a Responses API completed event", () => {
  const sse = 'data: {"type":"response.completed","response":{"model":"r1","usage":{"input_tokens":11,"output_tokens":22}}}\n';
  assert.deepEqual(usageFromSse(sse), { model: "r1", inputTokens: 11, outputTokens: 22 });
});

test("longest matching price prefix wins", () => {
  const prices = { default: { input: 1, output: 1 }, models: { "gpt-": { input: 2, output: 2 }, "gpt-big": { input: 9, output: 9 } } };
  assert.equal(priceFor(prices, "gpt-big-2").input, 9);
  assert.equal(priceFor(prices, "gpt-small").input, 2);
  assert.equal(priceFor(prices, "other").input, 1);
  assert.equal(priceFor(prices, null).input, 1);
});

test("prices a call per million tokens", () => {
  const prices = { default: { input: 2, output: 8 }, models: {} };
  assert.equal(costUsd(prices, { model: "x", inputTokens: 1_000_000, outputTokens: 500_000 }), 6);
});
