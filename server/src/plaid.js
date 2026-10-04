// Plaid REST client (https://plaid.com/docs/api/). Plain fetch, no SDK.

export class PlaidError extends Error {
  constructor(body, status) {
    super(body?.error_message || `Plaid request failed (${status})`);
    this.code = body?.error_code;
    this.status = status;
  }
}

export function createPlaid({ clientId, secret, baseUrl }, fetchImpl = fetch) {
  async function call(path, body) {
    const res = await fetchImpl(baseUrl + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, secret, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlaidError(json, res.status);
    return json;
  }

  return {
    configured: Boolean(clientId && secret),

    async linkToken(userId) {
      const out = await call("/link/token/create", {
        user: { client_user_id: userId },
        client_name: "Pledge",
        products: ["transactions"],
        country_codes: ["CA", "US"],
        language: "en",
      });
      return out.link_token;
    },

    async exchange(publicToken) {
      const out = await call("/item/public_token/exchange", { public_token: publicToken });
      return out.access_token;
    },

    // Sandbox only: creates an item from a custom user config without Link.
    async sandboxPublicToken(customConfig) {
      const out = await call("/sandbox/public_token/create", {
        institution_id: "ins_109508",
        initial_products: ["transactions"],
        options: { override_username: "user_custom", override_password: JSON.stringify(customConfig) },
      });
      return out.public_token;
    },

    async institutionName(accessToken) {
      try {
        const out = await call("/item/get", { access_token: accessToken });
        return out.item?.institution_name || null;
      } catch {
        return null;
      }
    },

    // Pages through /transactions/sync from a cursor. A brand-new item can
    // report nothing until Plaid finishes its first pull, so retry briefly.
    async sync(accessToken, cursor, { attempts = 8, delayMs = 1500 } = {}) {
      const added = [];
      const removed = [];
      let next = cursor || undefined;
      for (let attempt = 0; attempt < attempts; attempt++) {
        let hasMore = true;
        while (hasMore) {
          const page = await call("/transactions/sync", { access_token: accessToken, cursor: next, count: 500 });
          added.push(...page.added, ...page.modified);
          removed.push(...page.removed.map((r) => r.transaction_id));
          next = page.next_cursor;
          hasMore = page.has_more;
        }
        if (added.length || cursor) break;
        await new Promise((r) => setTimeout(r, delayMs));
      }
      return { added, removed, cursor: next };
    },
  };
}
