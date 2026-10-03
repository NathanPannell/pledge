// Tributary dashboard. Talks to the local API; secrets never reach the browser.
(function () {
  const $ = (id) => document.getElementById(id);
  let state = null;
  let saveTimer = null;

  const money = (cents) => "$" + Math.round(cents / 100).toLocaleString("en-US");
  const moneyExact = (cents) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtMonth = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("en-US", { month: "short" });
  const iso = (d) => d.toISOString().slice(0, 10);

  function period() {
    const days = Number($("period").value);
    const end = new Date();
    const start = new Date(Date.now() - (days - 1) * 86400000);
    return { days, start: iso(start), end: iso(end) };
  }

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Something went wrong.");
    return json;
  }

  let toastTimer;
  function toast(message, isError) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("err", Boolean(isError));
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 7000 : 4000);
  }

  async function busy(button, label, work) {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spin" aria-hidden="true"></span>${label}`;
    try {
      return await work();
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  async function load() {
    const p = period();
    state = await api("GET", `/api/state?start=${p.start}&end=${p.end}`);
    render();
  }

  // ---- Rendering -----------------------------------------------------------

  function render() {
    const hasOrg = Boolean(state.org);
    $("onboard").hidden = hasOrg;
    $("dash").hidden = !hasOrg;
    $("org-chip").hidden = !hasOrg;
    if (!hasOrg) return;
    $("org-chip").textContent = state.org.name;
    $("period-label").textContent = $("period").selectedOptions[0].textContent;
    renderConnections();
    renderKpis();
    renderChart();
    renderVendors();
    renderTransactions();
    renderInvoices();
    renderDial(true);
  }

  function renderConnections() {
    $("plaid-banner").hidden = state.plaid.configured;
    $("connect-plaid").disabled = !state.plaid.configured;
    $("connect-sandbox").hidden = !(state.plaid.configured && state.plaid.env === "sandbox");
    for (const kind of ["plaid", "anthropic", "openai"]) {
      const items = state.connections.filter((c) => c.kind === kind);
      $("items-" + kind).innerHTML = items.map((c) => `
        <div class="conn-item">
          <div style="display:grid;gap:2px;min-width:0;">
            <span style="font-weight:600;">${esc(c.label)}</span>
            ${c.status === "error"
              ? `<span class="pill err" title="${esc(c.error)}"><span class="dot"></span>Sync failed</span>`
              : `<code>${esc(c.hint || "")}</code>`}
          </div>
          <button class="btn btn-ghost btn-sm" type="button" data-remove="${c.id}" aria-label="Remove ${esc(c.label)}">Remove</button>
        </div>`).join("");
    }
  }

  function renderKpis() {
    const s = state.spend;
    const cardConns = state.connections.filter((c) => c.kind === "plaid").length;
    const provConns = state.connections.filter((c) => c.kind !== "plaid").length;
    $("k-card").textContent = money(s.cardCents);
    $("k-card-s").textContent = cardConns ? `${s.vendors.reduce((n, v) => n + v.count, 0)} AI charges` : "No card connected";
    $("k-usage").textContent = money(s.providerCents);
    $("k-usage-s").textContent = provConns ? s.providers.map((p) => p.vendor).join(" and ") : "No providers connected";
    $("k-share").textContent = s.allCardCents ? Math.round((s.cardCents / s.allCardCents) * 100) + "%" : "0%";
    $("k-vendors").textContent = String(s.vendors.length);
  }

  function niceMax(v) {
    if (v <= 0) return 100;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function renderChart() {
    const months = state.spend.months;
    const el = $("chart");
    if (!months.length) {
      el.innerHTML = '<div class="empty">Connect a card or a provider to see monthly AI spend.</div>';
      return;
    }
    const W = 640, H = 240, L = 52, B = 26, T = 8;
    const max = niceMax(Math.max(...months.map((m) => Math.max(m.cardCents, m.providerCents))) / 100);
    const y = (dollars) => T + (H - T - B) * (1 - dollars / max);
    const band = (W - L) / months.length;
    const barW = Math.min(36, (band - 24) / 2);
    let svg = "";
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      svg += `<line class="grid-line" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`;
      svg += `<text class="tick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">$${v >= 1000 ? (v / 1000).toLocaleString("en-US") + "k" : v}</text>`;
    }
    months.forEach((m, i) => {
      const cx = L + band * i + band / 2;
      const bars = [
        { cents: m.cardCents, color: "var(--series-card)", label: "Card charges", x: cx - barW - 1 },
        { cents: m.providerCents, color: "var(--series-usage)", label: "Provider usage", x: cx + 1 },
      ];
      for (const b of bars) {
        const top = y(b.cents / 100);
        const h = Math.max(0, H - B - top);
        if (h > 0) {
          const r = Math.min(4, h, barW / 2);
          // Rounded top, square base anchored to the axis.
          svg += `<path class="bar" fill="${b.color}" data-tip="${esc(fmtMonth(m.month))} · ${b.label}: ${money(b.cents)}" d="M${b.x},${H - B} V${top + r} q0,-${r} ${r},-${r} h${barW - 2 * r} q${r},0 ${r},${r} V${H - B} Z"/>`;
        }
      }
      svg += `<text class="tick" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(fmtMonth(m.month))}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Monthly AI spend, card charges and provider usage">${svg}</svg><div class="tip" hidden></div>`;
    const tip = el.querySelector(".tip");
    el.querySelectorAll(".bar").forEach((bar) => {
      bar.addEventListener("mouseenter", () => {
        const box = bar.getBoundingClientRect();
        const host = el.getBoundingClientRect();
        tip.textContent = bar.dataset.tip;
        tip.style.left = box.left - host.left + box.width / 2 + "px";
        tip.style.top = box.top - host.top + "px";
        tip.hidden = false;
      });
      bar.addEventListener("mouseleave", () => { tip.hidden = true; });
    });
  }

  function renderVendors() {
    const rows = [
      ...state.spend.vendors.map((v) => ({ ...v, kind: "card" })),
      ...state.spend.providers.map((v) => ({ ...v, kind: "usage" })),
    ];
    if (!rows.length) {
      $("vendors").innerHTML = '<div class="empty">No AI vendors found yet.</div>';
      $("vendor-note").textContent = "";
      return;
    }
    const max = Math.max(...rows.map((r) => r.cents));
    $("vendor-note").textContent = state.spend.providers.length ? "Card charges in blue, provider usage in teal" : "";
    $("vendors").innerHTML = rows.map((r) => `
      <div class="vrow ${r.kind === "usage" ? "usage" : ""}">
        <span>${esc(r.vendor)}${r.kind === "usage" ? ' <span class="faint small">usage</span>' : ""}</span>
        <span class="track"><i style="width:${Math.max(2, (r.cents / max) * 100)}%"></i></span>
        <span class="num">${money(r.cents)}</span>
      </div>`).join("");
  }

  function renderTransactions() {
    const rows = state.transactions;
    $("txns").innerHTML = rows.length
      ? rows.map((t) => `
        <tr class="${t.vendor ? "" : "not-ai"}">
          <td class="num">${fmtDate(t.date)}</td>
          <td>${esc(t.description)}</td>
          <td>${t.vendor ? `<span class="pill ai">${esc(t.vendor)}</span>` : '<span class="faint small">Not AI</span>'}</td>
          <td class="r num">${moneyExact(t.amount_cents)}</td>
        </tr>`).join("")
      : '<tr><td colspan="4" class="faint">Connect a card to see transactions.</td></tr>';
  }

  function renderInvoices() {
    const rows = state.invoices;
    $("invoices").innerHTML = rows.length
      ? rows.map((i) => `
        <tr>
          <td><code>${esc(i.number)}</code></td>
          <td class="num">${fmtDate(i.period_start)} – ${fmtDate(i.period_end)}</td>
          <td class="r num">${money(i.basis_cents)} × ${(i.rate * 100).toFixed(2)}%</td>
          <td class="r num"><strong>${moneyExact(i.amount_cents)}</strong></td>
          <td>${i.status === "paid" ? '<span class="pill ok"><span class="dot"></span>Paid</span>' : '<span class="pill warn"><span class="dot"></span>Invoiced</span>'}</td>
          <td class="r" style="white-space:nowrap;">
            ${i.stripe_url ? `<a class="btn btn-ghost btn-sm" href="${esc(i.stripe_url)}" target="_blank" rel="noopener">Open in Stripe</a>` : ""}
            ${i.status !== "paid" ? `<button class="btn btn-ghost btn-sm" type="button" data-paid="${i.id}">Mark paid</button>` : ""}
          </td>
        </tr>`).join("")
      : '<tr><td colspan="6" class="faint">No invoices yet. Set the dial and issue the first one.</td></tr>';
  }

  function currentBasis() {
    return document.querySelector('input[name="basis"]:checked').value;
  }

  function basisCents(basis) {
    const s = state.spend;
    if (basis === "card") return s.cardCents;
    if (basis === "provider") return s.providerCents;
    return Math.max(s.cardCents, s.providerCents);
  }

  function renderDial(fromState) {
    if (fromState) {
      $("rate").value = String(Math.round(state.org.pledgeRate * 10000) / 100);
      const b = document.querySelector(`input[name="basis"][value="${state.org.basis}"]`);
      if (b) b.checked = true;
    }
    const pct = Number($("rate").value);
    const basis = basisCents(currentBasis());
    const pledge = Math.round(basis * (pct / 100));
    const days = period().days;
    $("rate-out").textContent = pct.toFixed(2) + "%";
    $("pledge-amt").textContent = moneyExact(pledge);
    $("pledge-to").textContent = "to " + state.charity.name;
    $("pledge-period").textContent = $("period").selectedOptions[0].textContent;
    $("pledge-basis").textContent = money(basis);
    $("pledge-year").textContent = money(Math.round((pledge * 365) / days));
    $("issue").disabled = pledge < 100;
    $("issue-note").textContent = state.stripe.configured
      ? `Creates a Stripe invoice${state.stripe.testMode ? " (test mode)" : ""} and lists it on the public ledger.`
      : "Creates an invoice and lists it on the public ledger. Add a Stripe key to send it through Stripe.";
  }

  function savePledgeSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const out = await api("POST", "/api/pledge", { rate: Number($("rate").value) / 100, basis: currentBasis() });
        state.org.pledgeRate = out.org.pledge_rate;
        state.org.basis = out.org.basis;
      } catch (err) {
        toast(err.message, true);
      }
    }, 400);
  }

  // ---- Actions -------------------------------------------------------------

  $("org-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("POST", "/api/org", { name: $("org-name").value, billingEmail: $("org-email").value });
      await load();
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("period").addEventListener("change", () => load().catch((err) => toast(err.message, true)));

  $("refresh").addEventListener("click", (e) => busy(e.currentTarget, "Refreshing", async () => {
    try {
      await api("POST", "/api/refresh");
      await load();
      toast("Up to date.");
    } catch (err) {
      toast(err.message, true);
    }
  }));

  $("connect-plaid").addEventListener("click", (e) => busy(e.currentTarget, "Opening", async () => {
    try {
      const { linkToken } = await api("POST", "/api/plaid/link-token");
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken) => {
          try {
            await api("POST", "/api/plaid/exchange", { publicToken });
            await load();
            toast("Card connected.");
          } catch (err) {
            toast(err.message, true);
          }
        },
      });
      handler.open();
    } catch (err) {
      toast(err.message, true);
    }
  }));

  $("connect-sandbox").addEventListener("click", (e) => busy(e.currentTarget, "Connecting", async () => {
    try {
      await api("POST", "/api/plaid/sandbox");
      await load();
      toast("Demo card connected.");
    } catch (err) {
      toast(err.message, true);
    }
  }));

  const PROVIDERS = {
    anthropic: { title: "Add Anthropic admin key", help: "Create an admin key in your organization's console settings. Individual accounts can't create admin keys. We only call the cost report endpoint." },
    openai: { title: "Add OpenAI admin key", help: "Create an admin key in your organization's settings. We only call the costs endpoint." },
  };
  let providerKind = null;

  document.addEventListener("click", async (e) => {
    const provider = e.target.closest("[data-provider]");
    if (provider) {
      providerKind = provider.dataset.provider;
      $("key-title").textContent = PROVIDERS[providerKind].title;
      $("key-help").textContent = PROVIDERS[providerKind].help;
      $("key-input").value = "";
      $("key-error").hidden = true;
      $("key-dialog").showModal();
      return;
    }
    const remove = e.target.closest("[data-remove]");
    if (remove) {
      try {
        await api("DELETE", `/api/connections/${remove.dataset.remove}`);
        await load();
      } catch (err) {
        toast(err.message, true);
      }
      return;
    }
    const paid = e.target.closest("[data-paid]");
    if (paid) {
      try {
        await api("POST", `/api/invoices/${paid.dataset.paid}/paid`);
        await load();
        toast("Marked paid. The ledger is updated.");
      } catch (err) {
        toast(err.message, true);
      }
    }
  });

  $("key-cancel").addEventListener("click", () => $("key-dialog").close());
  $("key-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy($("key-save"), "Checking", async () => {
      try {
        await api("POST", `/api/providers/${providerKind}`, { key: $("key-input").value });
        $("key-dialog").close();
        await load();
        toast("Provider connected.");
      } catch (err) {
        $("key-error").textContent = err.message;
        $("key-error").hidden = false;
      }
    });
  });

  $("rate").addEventListener("input", () => { renderDial(false); savePledgeSoon(); });
  document.querySelectorAll('input[name="basis"]').forEach((r) => r.addEventListener("change", () => { renderDial(false); savePledgeSoon(); }));

  $("issue").addEventListener("click", (e) => busy(e.currentTarget, "Issuing", async () => {
    clearTimeout(saveTimer);
    try {
      await api("POST", "/api/pledge", { rate: Number($("rate").value) / 100, basis: currentBasis() });
      const p = period();
      const { invoice } = await api("POST", "/api/invoices", { start: p.start, end: p.end });
      await load();
      toast(`Invoice ${invoice.number} issued for ${moneyExact(invoice.amount_cents)}.`);
    } catch (err) {
      toast(err.message, true);
    }
  }));

  load().catch((err) => toast(err.message, true));
})();
