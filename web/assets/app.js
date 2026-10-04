// Tributary giving page. Talks to the local API; secrets never reach the browser.
(function () {
  const $ = (id) => document.getElementById(id);
  let state = null;
  let saveTimer = null;

  const money = (cents) => "$" + Math.round(cents / 100).toLocaleString("en-US");
  const moneyExact = (cents) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const iso = (d) => d.toISOString().slice(0, 10);
  const monthLong = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("en-US", { month: "long" });
  const monthYear = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const shortDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const pctText = (rate) => {
    const p = Math.round(rate * 10000) / 100;
    return (Number.isInteger(p) ? p : p.toFixed(2)) + "%";
  };

  function monthBounds(month) {
    const [y, m] = month.split("-").map(Number);
    return { start: iso(new Date(Date.UTC(y, m - 1, 1))), end: iso(new Date(Date.UTC(y, m, 0))) };
  }

  function thisMonth() {
    return iso(new Date()).slice(0, 7);
  }

  // Five full months plus this one, enough to show history and an average.
  function range() {
    const now = new Date();
    return { start: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))), end: iso(now) };
  }

  async function api(method, path, body) {
    const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
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
    toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 7000 : 3500);
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
    const r = range();
    state = await api("GET", `/api/state?start=${r.start}&end=${r.end}`);
    render();
  }

  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  const HEART_SMALL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0e7f72" stroke-width="2" style="flex:none"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

  // ---- Derived numbers -------------------------------------------------------

  function rate() {
    return Number($("rate").value) / 100;
  }

  function basisOf(m, basis) {
    if (basis === "card") return m.cardCents;
    if (basis === "provider") return m.providerCents;
    return Math.max(m.cardCents, m.providerCents);
  }

  function fullMonths() {
    return state.spend.months.filter((m) => m.month < thisMonth());
  }

  function lastGiftEnd() {
    return state.invoices.reduce((max, i) => (i.period_end > max ? i.period_end : max), "");
  }

  // The most recent finished month that hasn't been given for yet.
  function readyMonth() {
    const after = lastGiftEnd();
    const candidates = fullMonths().filter((m) => monthBounds(m.month).end > after && basisOf(m, $("basis").value) > 0);
    return candidates.length ? candidates[candidates.length - 1] : null;
  }

  function averageMonthlyBasis() {
    const basis = $("basis").value;
    const recent = fullMonths().slice(-3);
    if (recent.length) return recent.reduce((s, m) => s + basisOf(m, basis), 0) / recent.length;
    const current = state.spend.months.find((m) => m.month === thisMonth());
    if (!current) return 0;
    const day = new Date().getUTCDate();
    return (basisOf(current, basis) / day) * 30;
  }

  // ---- Rendering -------------------------------------------------------------

  function render() {
    document.querySelectorAll(".charity-name").forEach((el) => { el.textContent = state.charity.name; });
    const hasOrg = Boolean(state.org);
    $("welcome").hidden = hasOrg;
    $("home").hidden = !hasOrg;
    if (!hasOrg) return;
    $("rate").value = String(Math.round(state.org.pledgeRate * 10000) / 100);
    $("basis").value = state.org.basis;
    renderImpact();
    renderReady();
    renderDial();
    renderGifts();
    renderSpend();
    $("org-email-out").textContent = state.org.billingEmail ? `Invoices go to ${state.org.billingEmail}` : "";
  }

  function givenCents() {
    return state.invoices.reduce((s, i) => s + i.amount_cents, 0);
  }

  function renderImpact() {
    const given = givenCents();
    const gifts = state.invoices.length;
    $("given-amt").textContent = moneyExact(given);
    $("org-name-out").textContent = state.org.name;
    $("s-gifts").textContent = String(gifts);
    const first = state.invoices.reduce((min, i) => (!min || i.period_start < min ? i.period_start : min), "");
    $("s-since").textContent = first ? monthLong(first.slice(0, 7)) : "this month";
    $("s-rate").textContent = pctText(state.org.pledgeRate);

    const c = state.community;
    $("community").innerHTML = gifts
      ? `${HEART_SMALL}<span>You&rsquo;re one of <b>${c.companies}</b> companies giving <b>${money(c.monthlyCents)}</b> to the foundation every month.</span>`
      : `${HEART_SMALL}<span><b>${c.companies}</b> companies already give <b>${money(c.monthlyCents)}</b> a month. Your first gift adds to it.</span>`;
  }

  function renderReady() {
    const m = readyMonth();
    $("ready").hidden = !m;
    $("next").hidden = Boolean(m);
    const r = rate();
    if (m) {
      const basis = basisOf(m, $("basis").value);
      const amount = Math.round(basis * r);
      $("ready-title").textContent = `${monthLong(m.month)}’s gift is ready`;
      $("ready-month").textContent = monthLong(m.month);
      $("ready-basis").textContent = money(basis);
      $("ready-rate").textContent = pctText(r);
      $("ready-amt-inline").textContent = moneyExact(amount);
      $("give").textContent = `Give ${moneyExact(amount)}`;
      $("give").disabled = amount < 100;
      $("give").dataset.month = m.month;
      $("give-note").textContent = state.stripe.configured
        ? `One invoice to ${state.org.billingEmail || "your finance team"}${state.stripe.testMode ? " (Stripe test mode)" : ""}.`
        : `Recorded as a gift to ${state.charity.shortName || state.charity.name}.`;
      return;
    }
    const now = new Date();
    const nextFirst = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    $("next-title").textContent = nextFirst.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
    const current = state.spend.months.find((x) => x.month === thisMonth());
    const soFar = current ? basisOf(current, $("basis").value) : 0;
    $("next-text").textContent = soFar
      ? `${monthLong(thisMonth())} so far: ${money(soFar)} of AI spend, ${moneyExact(Math.round(soFar * r))} at ${pctText(r)}.`
      : "Connect a card to see this month's AI spend.";
  }

  function renderDial() {
    const r = rate();
    const monthly = averageMonthlyBasis() * r;
    $("rate-out").textContent = pctText(r);
    $("o-month").textContent = money(monthly);
    $("o-year").textContent = money(monthly * 12);
    $("o-ten").textContent = money(monthly * 120);
  }


  function renderGifts() {
    const rows = state.invoices;
    $("gifts").innerHTML = rows.length
      ? rows.map((i) => `
        <div class="g">
          <span class="mark">${HEART}</span>
          <div><div class="t">${esc(monthYear(i.period_end.slice(0, 7)))}</div>
            <div class="s num">${pctText(i.rate)} of ${money(i.basis_cents)} AI spend &middot; ${esc(i.number)}</div></div>
          <div class="r"><b class="num">${moneyExact(i.amount_cents)}</b>
            ${i.status === "paid" ? '<span class="pill ok"><span class="dot"></span>Received</span>' : `<span class="pill warn"><span class="dot"></span>On its way</span>`}
            <span class="small"><a href="invoice.html?id=${i.id}">Invoice</a>${i.status === "paid" ? ` &middot; <a href="receipt.html?id=${i.id}">Tax receipt</a>` : ""}</span>
            ${i.status !== "paid" ? `<button class="linkish" type="button" data-paid="${i.id}">Mark received</button>` : ""}
          </div>
        </div>`).join("")
      : '<p class="muted">No gifts yet. Your first one will appear here.</p>';
  }

  function renderSpend() {
    const s = state.spend;
    $("plaid-banner").hidden = state.plaid.configured;
    $("connect-plaid").disabled = !state.plaid.configured;
    $("connect-sandbox").hidden = !(state.plaid.configured && state.plaid.env === "sandbox");
    $("spend-period").textContent = s.months.length ? `Since ${monthLong(s.months[0].month)}` : "";
    $("sources").innerHTML = state.connections.map((c) => `
      <span class="source ${c.status === "error" ? "err" : ""}" title="${esc(c.error || "")}">
        ${esc(c.kind === "anthropic" || c.kind === "openai" ? c.label + " usage" : c.label)}
        <button class="x" type="button" data-remove="${c.id}" aria-label="Remove ${esc(c.label)}">&times;</button>
      </span>`).join("") || '<span class="muted small">Nothing connected yet.</span>';
    const rows = [...s.vendors.map((v) => ({ ...v, usage: false })), ...s.providers.map((v) => ({ ...v, usage: true }))]
      .sort((a, b) => b.cents - a.cents).slice(0, 7);
    const max = Math.max(1, ...rows.map((r) => r.cents));
    $("tools").innerHTML = rows.map((r) => `
      <div class="tool ${r.usage ? "usage" : ""}">
        <span>${esc(r.vendor)}${r.usage ? ' <span class="faint small">usage</span>' : ""}</span>
        <span class="track"><i style="width:${Math.max(2, (r.cents / max) * 100)}%"></i></span>
        <span class="num">${money(r.cents)}</span>
      </div>`).join("");
    $("txns").innerHTML = state.transactions.map((t) => `
      <tr class="${t.vendor ? "" : "not-ai"}"><td class="num">${shortDate(t.date)}</td><td>${esc(t.description)}</td>
      <td>${t.vendor ? `<span class="pill ai">${esc(t.vendor)}</span>` : "&mdash;"}</td><td class="r num">${moneyExact(t.amount_cents)}</td></tr>`).join("")
      || '<tr><td colspan="4" class="faint">No card transactions yet.</td></tr>';
  }

  // ---- Actions ---------------------------------------------------------------

  function savePledgeSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      api("POST", "/api/pledge", { rate: rate(), basis: $("basis").value })
        .then((out) => { state.org.pledgeRate = out.org.pledge_rate; state.org.basis = out.org.basis; renderImpact(); })
        .catch((err) => toast(err.message, true));
    }, 350);
  }

  $("rate").addEventListener("input", () => { renderDial(); renderReady(); savePledgeSoon(); });
  $("basis").addEventListener("change", () => { renderDial(); renderReady(); savePledgeSoon(); });

  $("try-demo").addEventListener("click", (e) => busy(e.currentTarget, "Setting up", async () => {
    try {
      await api("POST", "/api/demo");
      await load();
    } catch (err) {
      toast(err.message, true);
    }
  }));

  $("show-setup").addEventListener("click", () => { $("setup").hidden = false; $("org-name").focus(); });
  $("setup").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("POST", "/api/org", { name: $("org-name").value, billingEmail: $("org-email").value });
      await load();
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("give").addEventListener("click", () => busy($("give"), "Giving", async () => {
    clearTimeout(saveTimer);
    const month = $("give").dataset.month;
    try {
      await api("POST", "/api/pledge", { rate: rate(), basis: $("basis").value });
      const { start, end } = monthBounds(month);
      const { invoice } = await api("POST", "/api/invoices", { start, end });
      await load();
      $("t-amt").textContent = moneyExact(invoice.amount_cents);
      $("t-text").textContent = `is on its way to the ${state.charity.name}. That brings ${state.org.name} to ${moneyExact(givenCents())} given.`;
      $("t-invoice").hidden = !invoice.stripe_url;
      if (invoice.stripe_url) $("t-invoice").href = invoice.stripe_url;
      $("thanks").showModal();
    } catch (err) {
      toast(err.message, true);
    }
  }));
  $("t-done").addEventListener("click", () => $("thanks").close());

  // Wipes every company, connection and gift, so it asks once more in place.
  let resetArmed = false;
  $("reset").addEventListener("click", async () => {
    if (!resetArmed) {
      resetArmed = true;
      $("reset").textContent = "Delete everything and start over?";
      setTimeout(() => { resetArmed = false; $("reset").textContent = "Start over"; }, 4000);
      return;
    }
    resetArmed = false;
    $("reset").textContent = "Start over";
    try {
      await api("POST", "/api/reset");
      await load();
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("connect-plaid").addEventListener("click", (e) => busy(e.currentTarget, "Opening", async () => {
    try {
      const { linkToken } = await api("POST", "/api/plaid/link-token");
      window.Plaid.create({
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
      }).open();
    } catch (err) {
      toast(err.message, true);
    }
  }));

  $("connect-sandbox").addEventListener("click", (e) => busy(e.currentTarget, "Connecting", async () => {
    try {
      await api("POST", "/api/plaid/sandbox");
      await load();
      toast("Sandbox card connected.");
    } catch (err) {
      toast(err.message, true);
    }
  }));

  const PROVIDERS = {
    anthropic: { title: "Add Anthropic admin key", help: "Create an admin key in your organization's console settings (individual accounts can't). Tributary only reads the cost report." },
    openai: { title: "Add OpenAI admin key", help: "Create an admin key in your organization's settings. Tributary only reads the costs report." },
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
      } catch (err) {
        toast(err.message, true);
      }
    }
  });

  // ---- Statement upload: read locally, send only AI charges -----------------

  let pending = null;

  $("csv-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const [text, { vendors }] = await Promise.all([file.text(), api("GET", "/api/vendors")]);
      const result = window.Statement.readStatement(text, vendors);
      if (result.error) return toast(result.error, true);
      if (!result.rows.length) return toast(`No AI charges found among ${result.totalRows} rows in ${file.name}.`, true);
      pending = { filename: file.name, rows: result.rows };
      $("csv-title").textContent = `${result.rows.length} AI charges, ${moneyExact(Math.round(result.total * 100))}`;
      $("csv-help").textContent = `Found in ${file.name}.`;
      $("csv-list").innerHTML = result.byVendor.map(([name, dollars]) =>
        `<li><span>${esc(name)}</span><b class="num">${moneyExact(Math.round(dollars * 100))}</b></li>`).join("");
      const kept = result.totalRows - result.rows.length;
      $("csv-private").textContent = `Only these ${result.rows.length} rows are sent: date, description and amount. The other ${kept} rows stay on this computer.`;
      $("csv-error").hidden = true;
      $("csv-dialog").showModal();
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("csv-cancel").addEventListener("click", () => { pending = null; $("csv-dialog").close(); });
  $("csv-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy($("csv-save"), "Adding", async () => {
      try {
        const out = await api("POST", "/api/statement", pending);
        pending = null;
        $("csv-dialog").close();
        await load();
        toast(`Added ${out.imported} AI charges.`);
      } catch (err) {
        $("csv-error").textContent = err.message;
        $("csv-error").hidden = false;
      }
    });
  });

  $("key-cancel").addEventListener("click", () => $("key-dialog").close());
  $("key-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy($("key-save"), "Checking", async () => {
      try {
        await api("POST", `/api/providers/${providerKind}`, { key: $("key-input").value });
        $("key-dialog").close();
        await load();
        toast("Connected.");
      } catch (err) {
        $("key-error").textContent = err.message;
        $("key-error").hidden = false;
      }
    });
  });

  load().catch((err) => toast(err.message, true));
})();
