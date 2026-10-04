import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { UserError } from "./service.js";
import { AI_VENDORS } from "./vendors.js";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new UserError("Request too large.", 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new UserError("Invalid JSON.");
  }
}

function defaultPeriod(url) {
  const end = url.searchParams.get("end") || new Date().toISOString().slice(0, 10);
  const start = url.searchParams.get("start") || new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
  return { start, end };
}

async function serveStatic(webRoot, pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = normalize(join(webRoot, rel));
  if (!file.startsWith(normalize(webRoot) + sep) && file !== normalize(webRoot)) return send(res, 404, { error: "Not found" });
  try {
    const info = await stat(file);
    if (info.isDirectory()) return serveStatic(webRoot, rel + "/", res);
    const body = await readFile(file);
    // Files change while the server runs; never let a browser show a stale page.
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
  } catch {
    send(res, 404, "Not found", "text/plain");
  }
}

export function createApp({ service, webRoot }) {
  const routes = {
    "GET /api/state": (req, url) => service.state(defaultPeriod(url)),
    "GET /api/ledger": () => service.ledger(),
    "POST /api/org": (req, url, body) => ({ org: service.saveOrg(body) }),
    "POST /api/pledge": (req, url, body) => ({ org: service.setPledge(body) }),
    "POST /api/plaid/link-token": async () => ({ linkToken: await service.linkToken() }),
    "POST /api/plaid/exchange": async (req, url, body) => ({ id: await service.connectPlaid(body.publicToken) }),
    "POST /api/plaid/sandbox": async () => ({ id: await service.connectSandboxCard() }),
    "POST /api/providers/anthropic": async (req, url, body) => ({ id: await service.connectProvider("anthropic", body.key) }),
    "POST /api/providers/openai": async (req, url, body) => ({ id: await service.connectProvider("openai", body.key) }),
    "POST /api/refresh": async () => {
      await service.refresh();
      return { ok: true };
    },
    "POST /api/invoices": async (req, url, body) => ({ invoice: await service.issueInvoice(body) }),
    "POST /api/statement": (req, url, body) => service.importStatement(body),
    // Patterns the browser uses to pick AI charges out of a statement locally.
    "GET /api/vendors": () => ({ vendors: AI_VENDORS.map((v) => ({ name: v.name, source: v.pattern.source, flags: v.pattern.flags })) }),
    "POST /api/reset": () => {
      service.reset();
      return { ok: true };
    },
  };

  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      const del = url.pathname.match(/^\/api\/connections\/(\d+)$/);
      if (req.method === "DELETE" && del) {
        service.removeConnection(del[1]);
        return send(res, 200, { ok: true });
      }
      const doc = url.pathname.match(/^\/api\/invoices\/(\d+)$/);
      if (req.method === "GET" && doc) return send(res, 200, service.invoiceDocument(doc[1]));
      const paid = url.pathname.match(/^\/api\/invoices\/(\d+)\/paid$/);
      if (req.method === "POST" && paid) {
        service.markPaid(paid[1]);
        return send(res, 200, { ok: true });
      }
      const handler = routes[`${req.method} ${url.pathname}`];
      if (handler) {
        const body = req.method === "POST" ? await readJson(req) : {};
        return send(res, 200, await handler(req, url, body));
      }
      if (req.method === "GET" && url.pathname === "/api/sample-statement.csv") {
        res.writeHead(200, {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="sample-business-card.csv"',
        });
        return res.end(service.sampleStatementCsv());
      }
      if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "Not found" });
      if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
      return serveStatic(webRoot, url.pathname, res);
    } catch (err) {
      const status = err instanceof UserError ? err.status : 500;
      if (status === 500) console.error(err);
      return send(res, status, { error: err.message || "Something went wrong." });
    }
  });
}
