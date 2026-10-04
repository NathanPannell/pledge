import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const WEB_ROOT = fileURLToPath(new URL("../../web", import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

// Minimal .env reader so the server needs no dependencies. Real environment
// variables win over the file.
export function loadEnv(path) {
  if (!path) {
    loadEnv(REPO_ROOT + ".env");
    loadEnv(ROOT + ".env");
    return;
  }
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith("#")) continue;
    const [, key, raw] = match;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

export function readConfig(env = process.env) {
  const port = Number(env.PORT || 5173);
  const stripeKey = env.STRIPE_SECRET_KEY || env.STRIPE_API_KEY || "";
  const roundupKey = env.STRIPE_API_KEY || stripeKey;
  const companyStripeMode = env.COMPANY_STRIPE_MODE || "stripe";
  if (!["local", "stripe"].includes(companyStripeMode)) throw new Error("COMPANY_STRIPE_MODE must be local or stripe.");
  if ([stripeKey, roundupKey].some((key) => key && !/^(sk|rk)_test_/.test(key))) {
    throw new Error("This combined demo accepts Stripe sandbox keys only.");
  }
  return {
    port,
    host: env.HOST || "127.0.0.1",
    appOrigin: new URL(env.APP_ORIGIN || `http://localhost:${port}`).origin,
    roundupsDb: env.ROUNDUPS_DB || REPO_ROOT + ".local/roundups.sqlite",
    roundupKey,
    dataDir: env.DATA_DIR || ROOT + "data",
    plaid: {
      clientId: env.PLAID_CLIENT_ID || "",
      secret: env.PLAID_SECRET || "",
      env: env.PLAID_ENV || "sandbox",
      baseUrl: env.PLAID_BASE_URL || `https://${env.PLAID_ENV || "sandbox"}.plaid.com`,
    },
    stripe: {
      secretKey: companyStripeMode === "local" ? "" : stripeKey,
      baseUrl: env.STRIPE_BASE_URL || "https://api.stripe.com",
    },
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    openaiBaseUrl: env.OPENAI_BASE_URL || "https://api.openai.com",
    charity: {
      name: env.CHARITY_NAME || "VGH & UBC Hospital Foundation",
      shortName: env.CHARITY_SHORT_NAME || "VGH Foundation",
      description: env.CHARITY_DESCRIPTION ||
        "Funds care and research at Vancouver General Hospital, UBC Hospital, G.F. Strong Rehabilitation Centre and Vancouver Coastal Health.",
      url: env.CHARITY_URL || "https://vghfoundation.ca",
      registration: env.CHARITY_REGISTRATION || "132173063RR0001",
    },
    // Sample giving from other companies, added to real records so the demo
    // shows a full community. Set COMMUNITY_SAMPLE=off to show real data only.
    communitySample: env.COMMUNITY_SAMPLE !== "off",
  };
}
