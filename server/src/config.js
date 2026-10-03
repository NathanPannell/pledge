import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const WEB_ROOT = fileURLToPath(new URL("../../web", import.meta.url));

// Minimal .env reader so the server needs no dependencies. Real environment
// variables win over the file.
export function loadEnv(path = ROOT + ".env") {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith("#")) continue;
    const [, key, raw] = match;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

export function readConfig(env = process.env) {
  return {
    port: Number(env.PORT || 5173),
    dataDir: env.DATA_DIR || ROOT + "data",
    plaid: {
      clientId: env.PLAID_CLIENT_ID || "",
      secret: env.PLAID_SECRET || "",
      env: env.PLAID_ENV || "sandbox",
      baseUrl: env.PLAID_BASE_URL || `https://${env.PLAID_ENV || "sandbox"}.plaid.com`,
    },
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY || "",
      baseUrl: env.STRIPE_BASE_URL || "https://api.stripe.com",
    },
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    openaiBaseUrl: env.OPENAI_BASE_URL || "https://api.openai.com",
    charity: {
      name: env.CHARITY_NAME || "VGH & UBC Hospital Foundation",
      description: env.CHARITY_DESCRIPTION || "Supports Vancouver General Hospital and UBC Hospital.",
    },
  };
}
