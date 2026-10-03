import { createServer } from "node:http";
import { costUsd, usageFromJson, usageFromSse } from "./metering.js";

// Headers that describe the hop rather than the request, or that would stop
// us from reading the upstream body as plain text.
const DROP_REQUEST = new Set(["host", "connection", "content-length", "accept-encoding", "x-tributary-key"]);
const DROP_RESPONSE = new Set(["content-length", "content-encoding", "transfer-encoding", "connection"]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

export function createProxy({ upstreams, prices, pledgeRate, ledger }) {
  return createServer(async (req, res) => {
    try {
      await route(req, res, { upstreams, prices, pledgeRate, ledger });
    } catch (err) {
      if (!res.headersSent) sendJson(res, 502, { error: "upstream_unreachable", detail: err.message });
      else res.end();
    }
  });
}

async function route(req, res, ctx) {
  const url = new URL(req.url, "http://proxy.local");

  if (url.pathname === "/tributary/summary") {
    if (req.method === "OPTIONS") return sendEmpty(res, 204, CORS);
    return sendJson(res, 200, { ...ctx.ledger.summary(), pledgeRate: ctx.pledgeRate }, CORS);
  }
  if (url.pathname === "/tributary/health") return sendJson(res, 200, { ok: true });

  const [, provider, ...rest] = url.pathname.split("/");
  const base = ctx.upstreams[provider];
  if (!base) {
    return sendJson(res, 404, {
      error: "unknown_provider",
      detail: "Use /openai/... or /anthropic/... as the base path.",
    });
  }

  const target = new URL("/" + rest.join("/") + url.search, base);
  await forward(req, res, target, provider, ctx);
}

async function forward(req, res, target, provider, ctx) {
  const body = await readBody(req);
  const upstream = await fetch(target, {
    method: req.method,
    headers: forwardHeaders(req.headers),
    body: body.length && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
  });

  const headers = {};
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key)) headers[key] = value;
  });
  res.writeHead(upstream.status, headers);

  // Stream to the client as bytes arrive, and keep a copy to meter afterwards.
  const chunks = [];
  if (upstream.body) {
    for await (const chunk of upstream.body) {
      chunks.push(chunk);
      res.write(chunk);
    }
  }
  res.end();

  if (upstream.ok) {
    const text = Buffer.concat(chunks).toString("utf8");
    const streamed = (upstream.headers.get("content-type") ?? "").includes("text/event-stream");
    meter(text, streamed, provider, req.headers["x-tributary-key"], ctx);
  }
}

function meter(text, streamed, provider, contributor, ctx) {
  let usage = null;
  if (streamed) {
    usage = usageFromSse(text);
  } else {
    try {
      usage = usageFromJson(JSON.parse(text));
    } catch {
      usage = null;
    }
  }
  if (!usage) return;

  const cost = costUsd(ctx.prices, usage);
  ctx.ledger.record({
    ts: new Date().toISOString(),
    contributor: contributor ?? null,
    provider,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: cost,
    pledgeUsd: cost * ctx.pledgeRate,
  });
}

function forwardHeaders(incoming) {
  const out = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (!DROP_REQUEST.has(key)) out[key] = value;
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload, extra = {}) {
  res.writeHead(status, { "content-type": "application/json", ...extra });
  res.end(JSON.stringify(payload));
}

function sendEmpty(res, status, extra = {}) {
  res.writeHead(status, extra);
  res.end();
}
