// Stripe invoicing over REST (form-encoded). Invoices are finalized, not
// emailed: the hosted invoice link is returned for the finance team to pay.

function form(params, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export function createStripe({ secretKey, baseUrl }, fetchImpl = fetch) {
  async function call(path, params = {}) {
    const res = await fetchImpl(baseUrl + path, {
      method: "POST",
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded" },
      body: form(params),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json?.error?.message || `Stripe request failed (${res.status})`).replace(/\b(?:rk|sk)_(?:test|live)_[^\s'"]+/g, '[redacted key]'));
    return json;
  }

  return {
    configured: Boolean(secretKey),
    testMode: secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_"),

    async ensureCustomer(existingId, { name, email }) {
      if (existingId) return existingId;
      const customer = await call("/v1/customers", { name, email });
      return customer.id;
    },

    async issueInvoice({ customerId, amountCents, description, number, charity }) {
      const invoice = await call("/v1/invoices", {
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: 30,
        currency: "usd",
        description: `AI pledge for ${charity}`,
        metadata: { pledge_number: number },
      });
      await call("/v1/invoiceitems", {
        customer: customerId,
        invoice: invoice.id,
        amount: amountCents,
        currency: "usd",
        description,
      });
      const finalized = await call(`/v1/invoices/${invoice.id}/finalize`);
      return { id: finalized.id, url: finalized.hosted_invoice_url };
    },
  };
}
