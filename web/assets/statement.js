// Reads a card statement CSV in the browser and picks out AI charges.
// Nothing here talks to the network: the caller decides what to send.
// Works in the browser (window.Statement) and in Node tests.
(function (root) {
  // RFC 4180-style parsing: quoted fields, doubled quotes, CRLF or LF.
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some((f) => f.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
    return rows;
  }

  const HEADERS = {
    date: /^(transaction date|trans\.? date|date|posted date|posting date|post date)$/i,
    description: /^(description|merchant|merchant name|payee|name|details|transaction description|narrative)$/i,
    amount: /^(amount|amount \(cad\)|amount \(usd\)|transaction amount|charge)$/i,
    debit: /^(debit|debit amount|withdrawal|withdrawals)$/i,
  };

  function findColumns(header) {
    const cols = {};
    header.forEach((h, i) => {
      const name = h.trim();
      for (const [key, re] of Object.entries(HEADERS)) {
        if (cols[key] === undefined && re.test(name)) cols[key] = i;
      }
    });
    return cols;
  }

  function toIsoDate(value) {
    const v = value.trim();
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      let [, a, b, y] = m;
      if (y.length === 2) y = "20" + y;
      // Month first unless the first number can't be a month.
      const [month, day] = Number(a) > 12 ? [b, a] : [a, b];
      return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    const parsed = new Date(v);
    return isNaN(parsed) ? null : parsed.toISOString().slice(0, 10);
  }

  function toAmount(value) {
    if (value === undefined) return NaN;
    const v = value.trim();
    const negative = /^\(.*\)$/.test(v) || v.startsWith("-");
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return negative ? -n : n;
  }

  // vendors: [{ name, source, flags }] from /api/vendors.
  function readStatement(text, vendors) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { error: "That file looks empty." };
    const cols = findColumns(rows[0]);
    if (cols.date === undefined || cols.description === undefined || (cols.amount === undefined && cols.debit === undefined)) {
      return { error: "Couldn't find date, description and amount columns. Export the statement as CSV with a header row." };
    }
    const matchers = vendors.map((v) => ({ name: v.name, re: new RegExp(v.source, v.flags) }));
    const body = rows.slice(1);
    const parsed = [];
    for (const r of body) {
      const description = (r[cols.description] || "").trim();
      const date = toIsoDate(r[cols.date] || "");
      const amount = cols.debit !== undefined && (r[cols.debit] || "").trim() !== "" ? toAmount(r[cols.debit]) : toAmount(r[cols.amount]);
      if (!description || !date || !Number.isFinite(amount) || amount === 0) continue;
      const vendor = matchers.find((m) => m.re.test(description));
      parsed.push({ date, description, amount, vendor: vendor ? vendor.name : null });
    }
    // Some banks show charges as negative numbers. Charges are what we want,
    // so flip the sign when most rows are negative, then drop credits.
    const negatives = parsed.filter((r) => r.amount < 0).length;
    const all = (negatives > parsed.length / 2 ? parsed.map((r) => ({ ...r, amount: -r.amount })) : parsed).filter((r) => r.amount > 0);
    const charges = all.filter((r) => r.vendor);
    const byVendor = {};
    for (const r of charges) byVendor[r.vendor] = (byVendor[r.vendor] || 0) + r.amount;
    return {
      // Only these leave the device: date, description and amount of AI charges.
      rows: charges.map(({ date, description, amount }) => ({ date, description, amount })),
      // Every charge with its match, kept in the browser for the scan view.
      all,
      totalRows: body.length,
      byVendor: Object.entries(byVendor).sort((a, b) => b[1] - a[1]),
      total: charges.reduce((s, r) => s + r.amount, 0),
    };
  }

  // AI spend per calendar month. The current month is partial, so the
  // "last full month" is the latest month before it.
  function summarize(rows, today) {
    const now = (today || new Date()).toISOString().slice(0, 7);
    const byMonth = {};
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + r.amount;
    }
    const months = Object.keys(byMonth).sort().map((m) => ({ month: m, total: byMonth[m] }));
    const full = months.filter((m) => m.month < now);
    const last = full.length ? full[full.length - 1] : null;
    const first = full.length > 1 ? full[0] : null;
    return {
      months,
      lastFull: last,
      growth: first && last && first.total > 0 ? last.total / first.total - 1 : null,
      growthFrom: first ? first.month : null,
    };
  }

  const api = { parseCsv, readStatement, summarize, toIsoDate, toAmount };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Statement = api;
})(typeof window !== "undefined" ? window : globalThis);
