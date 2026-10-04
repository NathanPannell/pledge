import { loadEnv, readConfig, WEB_ROOT } from "./config.js";
import { openDb } from "./db.js";
import { createPlaid } from "./plaid.js";
import { loadOrCreateKey } from "./secrets.js";
import { createApp } from "./server.js";
import { createService } from "./service.js";
import { createStripe } from "./stripe.js";

loadEnv();
const config = readConfig();
const service = createService({
  db: openDb(config.dataDir),
  key: loadOrCreateKey(config.dataDir),
  plaid: createPlaid(config.plaid),
  stripe: createStripe(config.stripe),
  config,
});

createApp({ service, webRoot: WEB_ROOT }).listen(config.port, () => {
  console.log(`Pledge on http://localhost:${config.port}`);
  console.log(`  Plaid:  ${config.plaid.clientId ? config.plaid.env : "not configured"}`);
  console.log(`  Stripe: ${config.stripe.secretKey ? "configured" : "not configured (invoices stay local)"}`);
  console.log(`  Charity: ${config.charity.name}`);
});
