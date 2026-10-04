import { loadEnv, readConfig, WEB_ROOT } from "./config.js";
import { openDb } from "./db.js";
import { createPlaid } from "./plaid.js";
import { loadOrCreateKey } from "./secrets.js";
import { createApp } from "./server.js";
import { createService } from "./service.js";
import { createStripe } from "./stripe.js";
import { createRoundups } from "./roundups.js";

loadEnv();
const config = readConfig();
const service = createService({
  db: openDb(config.dataDir),
  key: loadOrCreateKey(config.dataDir),
  plaid: createPlaid(config.plaid),
  stripe: createStripe(config.stripe),
  config,
});

const roundups = createRoundups(config);
const app = createApp({ service, webRoot: WEB_ROOT, roundups });
app.listen(config.port, config.host, () => {
  console.log(`Pledge on http://localhost:${config.port}`);
  console.log(`  Plaid:  ${config.plaid.clientId ? config.plaid.env : "not configured"}`);
  console.log(`  Stripe: ${config.stripe.secretKey ? "configured" : "not configured (invoices stay local)"}`);
  console.log(`  Charity: ${config.charity.name}`);
  console.log(`  Extension setup: ${config.appOrigin}/roundups/`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    app.close(() => { roundups.close(); process.exit(0); });
    app.closeIdleConnections();
    setTimeout(() => process.exit(1), 15000).unref();
  });
}
