import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import worker from "../../roundups/worker/index.js";
import { SQLiteD1 } from "../../roundups/scripts/sqlite-adapter.mjs";

// Both products share one HTTP listener, but retain their existing financial
// models and databases; company reset must never affect extension pledges.
export function createRoundups(config, overrides = {}) {
  if (config.roundupsDb !== ":memory:") {
    mkdirSync(dirname(config.roundupsDb), { recursive: true, mode: 0o700 });
  }
  const db = new SQLiteD1(config.roundupsDb);
  db.migrate();
  if (config.roundupsDb !== ":memory:") chmodSync(config.roundupsDb, 0o600);
  const env = {
    DB: db,
    APP_ORIGIN: config.appOrigin,
    ROUNDUPS_RETURN_PATH: "/roundups/",
    STRIPE_API_KEY: config.roundupKey,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    ...overrides,
  };

  return {
    db,
    close: () => db.close(),
    async handle(req, res, url) {
      // Preserve payment returns created before the monorepo cutover.
      if (url.pathname === "/" && (url.searchParams.has("checkout") || url.searchParams.has("cancel"))) {
        res.writeHead(302, { location: "/roundups/" + url.search, "cache-control": "no-store" });
        res.end();
        return true;
      }
      let path;
      if (url.pathname === "/roundups") {
        res.writeHead(302, { location: "/roundups/" + url.search });
        res.end();
        return true;
      }
      if (url.pathname.startsWith("/roundups/")) path = url.pathname.slice("/roundups".length);
      else if (url.pathname === "/extension.zip") path = "/extension.zip";
      // Previously installed extensions can keep using their device token.
      // Never dispatch Nathan's cookie-only /api/state or /api/pledge here.
      else if (url.pathname.startsWith("/api/") && (
        /^Bearer [a-f0-9]{64}$/.test(req.headers.authorization || "") ||
        ["/api/pair/redeem", "/api/health", "/api/webhook"].includes(url.pathname)
      )) path = url.pathname;
      else return false;

      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 64 * 1024) {
          res.writeHead(413, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Request too large." }));
          return true;
        }
        chunks.push(chunk);
      }
      const request = new Request(config.appOrigin + path + url.search, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const response = await worker.fetch(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return true;
    },
  };
}
