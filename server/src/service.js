import { SAMPLE, sampleGifts } from "./community.js";
import { now } from "./db.js";
import { anthropicCosts, openaiCosts } from "./providers.js";
import { basisCents, clampRate, monthKey, pledgeCents } from "./pledge.js";
import { buildCustomUser } from "./sandbox-config.js";
import { hint, open, seal } from "./secrets.js";
import { detectVendor } from "./vendors.js";

const PROVIDER_LABEL = { anthropic: "Anthropic", openai: "OpenAI" };
const HISTORY_DAYS = 120;

export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000);
}

export function createService({ db, key, plaid, stripe, config, fetchImpl = fetch }) {
  const q = (sql) => db.prepare(sql);

  function org() {
    return q("select * from org where id = 1").get() || null;
  }

  function saveOrg({ name, billingEmail }) {
    const clean = String(name || "").trim();
    if (!clean) throw new UserError("Enter your company name.");
    q(`insert into org (id, name, billing_email, created_at) values (1, ?, ?, ?)
       on conflict(id) do update set name = excluded.name, billing_email = excluded.billing_email`)
      .run(clean, String(billingEmail || "").trim() || null, now());
    return org();
  }

  function requireOrg() {
    const o = org();
    if (!o) throw new UserError("Set up your company first.");
    return o;
  }

  function setPledge({ rate, basis }) {
    requireOrg();
    const b = ["card", "provider", "auto"].includes(basis) ? basis : "auto";
    q("update org set pledge_rate = ?, basis = ? where id = 1").run(clampRate(rate), b);
    return org();
  }

  // ---- Plaid --------------------------------------------------------------

  function storeCardTxns(connectionId, added, removed) {
    const upsert = q(`insert into card_txn (id, connection_id, date, description, merchant, amount_cents, vendor)
      values (?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set date = excluded.date, description = excluded.description,
        merchant = excluded.merchant, amount_cents = excluded.amount_cents, vendor = excluded.vendor`);
    const del = q("delete from card_txn where id = ?");
    for (const t of added) {
      const description = t.original_description || t.name || "";
      const merchant = t.merchant_name || null;
      const vendor = detectVendor(`${merchant || ""} ${description}`);
      upsert.run(t.transaction_id, connectionId, t.date, description, merchant, Math.round(t.amount * 100), vendor);
    }
    for (const id of removed) del.run(id);
  }

  async function syncPlaid(conn) {
    const token = open(key, conn.secret);
    const { added, removed, cursor } = await plaid.sync(token, conn.cursor);
    storeCardTxns(conn.id, added, removed);
    q("update connection set cursor = ?, synced_at = ?, status = 'ok', error = null where id = ?").run(cursor, now(), conn.id);
  }

  async function addPlaidItem(accessToken) {
    requireOrg();
    const institution = (await plaid.institutionName(accessToken)) || "Business card";
    const { lastInsertRowid } = q(`insert into connection (kind, label, secret, hint, created_at)
      values ('plaid', ?, ?, ?, ?)`).run(institution, seal(key, accessToken), "Transactions, read-only", now());
    const conn = q("select * from connection where id = ?").get(lastInsertRowid);
    await syncPlaid(conn);
    return conn.id;
  }

  async function linkToken() {
    if (!plaid.configured) throw new UserError("Add PLAID_CLIENT_ID and PLAID_SECRET to server/.env.", 503);
    return plaid.linkToken("org-1");
  }

  async function connectPlaid(publicToken) {
    if (!publicToken) throw new UserError("Missing public token.");
    return addPlaidItem(await plaid.exchange(publicToken));
  }

  async function connectSandboxCard() {
    if (!plaid.configured) throw new UserError("Add PLAID_CLIENT_ID and PLAID_SECRET to server/.env.", 503);
    if (config.plaid.env !== "sandbox") throw new UserError("The demo card only works with PLAID_ENV=sandbox.");
    const publicToken = await plaid.sandboxPublicToken(buildCustomUser());
    return addPlaidItem(await plaid.exchange(publicToken));
  }

  // ---- Providers ----------------------------------------------------------

  async function fetchCosts(kind, apiKey) {
    const args = { key: apiKey, start: daysAgo(HISTORY_DAYS), end: new Date() };
    if (kind === "anthropic") return anthropicCosts({ ...args, baseUrl: config.anthropicBaseUrl }, fetchImpl);
    if (kind === "openai") return openaiCosts({ ...args, baseUrl: config.openaiBaseUrl }, fetchImpl);
    throw new UserError("Unknown provider.");
  }

  function storeCosts(connectionId, days) {
    const upsert = q(`insert into provider_cost (connection_id, date, amount_cents) values (?, ?, ?)
      on conflict(connection_id, date) do update set amount_cents = excluded.amount_cents`);
    for (const d of days) upsert.run(connectionId, d.date, d.cents);
  }

  async function connectProvider(kind, apiKey) {
    requireOrg();
    const k = String(apiKey || "").trim();
    if (!PROVIDER_LABEL[kind]) throw new UserError("Unknown provider.");
    if (!k) throw new UserError("Paste an admin API key.");
    let days;
    try {
      days = await fetchCosts(kind, k);
    } catch (err) {
      throw new UserError(`${PROVIDER_LABEL[kind]} rejected the key: ${err.message}`);
    }
    const { lastInsertRowid } = q(`insert into connection (kind, label, secret, hint, synced_at, created_at)
      values (?, ?, ?, ?, ?, ?)`).run(kind, PROVIDER_LABEL[kind], seal(key, k), hint(k), now(), now());
    storeCosts(lastInsertRowid, days);
    return Number(lastInsertRowid);
  }

  async function syncProvider(conn) {
    const days = await fetchCosts(conn.kind, open(key, conn.secret));
    storeCosts(conn.id, days);
    q("update connection set synced_at = ?, status = 'ok', error = null where id = ?").run(now(), conn.id);
  }

  async function refresh() {
    for (const conn of q("select * from connection where kind != 'demo'").all()) {
      try {
        if (conn.kind === "plaid") await syncPlaid(conn);
        else await syncProvider(conn);
      } catch (err) {
        q("update connection set status = 'error', error = ? where id = ?").run(err.message, conn.id);
      }
    }
  }

  function removeConnection(id) {
    q("delete from connection where id = ?").run(Number(id));
  }

  // ---- Demo ---------------------------------------------------------------

  function reset() {
    db.exec("delete from invoice; delete from provider_cost; delete from card_txn; delete from connection; delete from org;");
  }

  // A ready-made company for the happy path: a card with four months of
  // charges and gifts already made for the months before last. Last month's
  // gift is left ready to give. Works without Plaid or Stripe keys.
  function seedDemo(today = new Date()) {
    reset();
    q(`insert into org (id, name, billing_email, pledge_rate, basis, created_at)
       values (1, 'Northgate Freight', 'ap@northgate.example', 0.01, 'card', ?)`).run(now());
    const { lastInsertRowid: connId } = q(`insert into connection (kind, label, secret, hint, synced_at, created_at)
      values ('demo', 'Business Visa ending 4821', ?, 'Read-only', ?, ?)`).run(seal(key, "demo"), now(), now());
    const txns = buildCustomUser(today).override_accounts[0].transactions;
    storeCardTxns(Number(connId), txns.map((t, i) => ({
      transaction_id: `demo-${i}`, date: t.date_posted, name: t.description, amount: t.amount, merchant_name: null,
    })), []);

    const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    for (let back = 3; back >= 2; back--) {
      const first = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() - (back - 1), 1));
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
      const start = first.toISOString().slice(0, 10);
      const end = last.toISOString().slice(0, 10);
      const basis = spend(start, end).cardCents;
      const issued = new Date(last.getTime() + 2 * 86400000).toISOString();
      q(`insert into invoice (number, period_start, period_end, basis, basis_cents, rate, amount_cents, charity, status, created_at)
         values (?, ?, ?, 'card', ?, 0.01, ?, ?, 'paid', ?)`)
        .run(nextInvoiceNumber(end), start, end, basis, pledgeCents(basis, 0.01), config.charity.name, issued);
    }
  }

  // ---- Spend and pledges --------------------------------------------------

  function spend(start, end) {
    const card = q(`select vendor, sum(amount_cents) cents, count(*) n from card_txn
      where vendor is not null and amount_cents > 0 and date >= ? and date <= ? group by vendor order by cents desc`).all(start, end);
    const provider = q(`select c.label vendor, sum(p.amount_cents) cents from provider_cost p join connection c on c.id = p.connection_id
      where p.date >= ? and p.date <= ? group by c.label order by cents desc`).all(start, end);
    const cardMonths = q(`select substr(date, 1, 7) month, sum(amount_cents) cents from card_txn
      where vendor is not null and amount_cents > 0 and date >= ? and date <= ? group by month`).all(start, end);
    const providerMonths = q(`select substr(date, 1, 7) month, sum(amount_cents) cents from provider_cost
      where date >= ? and date <= ? group by month`).all(start, end);
    const allCard = q(`select sum(amount_cents) cents from card_txn where amount_cents > 0 and date >= ? and date <= ?`).get(start, end);

    const months = new Map();
    for (const m of cardMonths) months.set(m.month, { month: m.month, cardCents: m.cents, providerCents: 0 });
    for (const m of providerMonths) {
      const row = months.get(m.month) || { month: m.month, cardCents: 0, providerCents: 0 };
      row.providerCents = m.cents;
      months.set(m.month, row);
    }
    const cardCents = card.reduce((s, r) => s + r.cents, 0);
    return {
      start,
      end,
      cardCents,
      providerCents: provider.reduce((s, r) => s + r.cents, 0),
      allCardCents: allCard?.cents || 0,
      vendors: card.map((r) => ({ vendor: r.vendor, cents: r.cents, count: r.n })),
      providers: provider.map((r) => ({ vendor: r.vendor, cents: r.cents })),
      months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  function recentTransactions(limit = 40) {
    return q(`select t.id, t.date, t.description, t.merchant, t.amount_cents, t.vendor
      from card_txn t order by t.date desc, t.amount_cents desc limit ?`).all(limit);
  }

  function nextInvoiceNumber(date) {
    const prefix = `TRB-${date.slice(0, 4)}${date.slice(5, 7)}-`;
    const row = q("select count(*) n from invoice where number like ?").get(prefix + "%");
    return prefix + String(row.n + 1).padStart(3, "0");
  }

  async function issueInvoice({ start, end }) {
    const o = requireOrg();
    if (!start || !end || start > end) throw new UserError("Choose a valid period.");
    const s = spend(start, end);
    const basis = basisCents(s, o.basis);
    const amount = pledgeCents(basis, o.pledge_rate);
    if (amount < 100) throw new UserError("The pledge for this period is under $1. Connect spend or choose a longer period.");

    const number = nextInvoiceNumber(end);
    let stripeId = null;
    let stripeUrl = null;
    if (stripe.configured) {
      const customerId = await stripe.ensureCustomer(o.stripe_customer_id, { name: o.name, email: o.billing_email });
      if (customerId !== o.stripe_customer_id) q("update org set stripe_customer_id = ? where id = 1").run(customerId);
      const pct = (o.pledge_rate * 100).toFixed(2);
      const out = await stripe.issueInvoice({
        customerId,
        amountCents: amount,
        number,
        charity: config.charity.name,
        description: `${pct}% of AI spend, ${start} to ${end}, donated to ${config.charity.name}`,
      });
      stripeId = out.id;
      stripeUrl = out.url;
    }
    const { lastInsertRowid } = q(`insert into invoice (number, period_start, period_end, basis, basis_cents, rate,
      amount_cents, charity, status, stripe_invoice_id, stripe_url, created_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)`)
      .run(number, start, end, o.basis, basis, o.pledge_rate, amount, config.charity.name, stripeId, stripeUrl, now());
    return q("select * from invoice where id = ?").get(lastInsertRowid);
  }

  function markPaid(id) {
    q("update invoice set status = 'paid' where id = ?").run(Number(id));
  }

  function invoices() {
    return q("select * from invoice order by created_at desc").all();
  }

  // Everything the dashboard needs in one call. Secrets never leave the server.
  function state({ start, end }) {
    const o = org();
    return {
      org: o && { name: o.name, billingEmail: o.billing_email, pledgeRate: o.pledge_rate, basis: o.basis },
      charity: config.charity,
      community: community(),
      plaid: { configured: plaid.configured, env: config.plaid.env },
      stripe: { configured: stripe.configured, testMode: stripe.testMode },
      connections: q("select id, kind, label, hint, status, error, synced_at from connection order by id").all(),
      spend: spend(start, end),
      transactions: recentTransactions(),
      invoices: invoices(),
    };
  }

  // Totals across every giving company: this one plus the sample community.
  function community() {
    const real = q("select coalesce(sum(amount_cents), 0) total, count(*) n from invoice").get();
    const latest = q("select amount_cents from invoice order by period_end desc limit 1").get();
    const sample = config.communitySample ? SAMPLE : { companies: 0, monthlyCents: 0, totalCents: 0 };
    return {
      // A company counts once it has given at least once.
      companies: sample.companies + (real.n > 0 ? 1 : 0),
      monthlyCents: sample.monthlyCents + (latest?.amount_cents || 0),
      totalCents: sample.totalCents + real.total,
      ownGifts: real.n,
    };
  }

  function ledger() {
    const o = org();
    const own = q(`select number, period_start, period_end, amount_cents, charity, status, created_at
      from invoice order by period_end desc, created_at desc limit 50`).all()
      .map((r) => ({ ...r, company: o?.name || "" }));
    const others = config.communitySample ? sampleGifts() : [];
    const entries = [...own, ...others]
      .sort((a, b) => b.period_end.localeCompare(a.period_end) || b.amount_cents - a.amount_cents)
      .slice(0, 12);
    return { charity: config.charity, community: community(), entries };
  }

  return {
    org, saveOrg, setPledge, linkToken, connectPlaid, connectSandboxCard, connectProvider,
    refresh, removeConnection, reset, seedDemo, spend, issueInvoice, markPaid, invoices, state, ledger, monthKey,
  };
}
