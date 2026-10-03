import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createLedger } from "./ledger.js";
import { createProxy } from "./server.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = process.env;

const config = {
  port: Number(env.PORT ?? 8787),
  pledgeRate: Number(env.PLEDGE_RATE ?? 0.005),
  upstreams: {
    openai: env.OPENAI_UPSTREAM ?? "https://api.openai.com",
    anthropic: env.ANTHROPIC_UPSTREAM ?? "https://api.anthropic.com",
  },
  prices: JSON.parse(readFileSync(env.PRICES_PATH ?? root + "prices.json", "utf8")),
  ledgerPath: env.LEDGER_PATH ?? root + "data/ledger.jsonl",
};

const proxy = createProxy({
  upstreams: config.upstreams,
  prices: config.prices,
  pledgeRate: config.pledgeRate,
  ledger: createLedger(config.ledgerPath),
});

proxy.listen(config.port, () => {
  const pct = (config.pledgeRate * 100).toFixed(2);
  console.log(`Tributary proxy on http://localhost:${config.port} (pledge ${pct}% of metered cost)`);
  console.log(`  OpenAI clients:    base_url=http://localhost:${config.port}/openai/v1`);
  console.log(`  Anthropic clients: base_url=http://localhost:${config.port}/anthropic`);
  console.log(`  Summary:           http://localhost:${config.port}/tributary/summary`);
});
