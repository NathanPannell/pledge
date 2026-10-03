import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Provider admin keys and Plaid access tokens are stored encrypted at rest.
// The key lives in the data directory, outside the repo.
export function loadOrCreateKey(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const path = join(dataDir, "secret.key");
  if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString("hex"), { mode: 0o600 });
  return Buffer.from(readFileSync(path, "utf8").trim(), "hex");
}

export function seal(key, plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

export function open(key, sealed) {
  const [iv, tag, body] = sealed.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

// Shows enough of a key to recognise it, never enough to use it.
export function hint(secret) {
  return secret.length <= 8 ? "****" : secret.slice(0, 7) + "…" + secret.slice(-4);
}
