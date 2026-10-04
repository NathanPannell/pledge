// Tributary giving page: a guided Find, Choose, Give flow for a new company,
// then a home view for a giving company. Secrets never reach the browser.
(function () {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SAMPLE = { name: "Northgate Freight", email: "ap@northgate.example", file: "northgate-visa-statement.csv" };
  // Tells an open landing page that a gift was just made, so it updates at once.
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("tributary") : null;

  let state = null;
  let found = null; // the statement being turned into a first gift
  let statementSent = false; // so a retried first gift doesn't upload twice
  let holdFlow = false; // keep the flow on screen behind the thank-you
  let saveTimer = null;
  let vendorCache = null;

  // ---- Formatting ------------------------------------------------------------

  const money = (cents) => "$" + Math.round(cents / 100).toLocaleString("en-US");
  const moneyExact = (cents) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const iso = (d) => d.toISOString().slice(0, 10);
  const monthLong = (m) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const monthYear = (m) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const shortDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const pctText = (rate) => {
    const p = Math.round(rate * 10000) / 100;
    return (Number.isInteger(p) ? p : p.toFixed(2)) + "%";
  };
  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  const HEART_SMALL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0e7f72" stroke-width="2" style="flex:none" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

  function monthBounds(month) {
    const [y, m] = month.split("-").map(Number);
    return { start: iso(new Date(Date.UTC(y, m - 1, 1))), end: iso(new Date(Date.UTC(y, m, 0))) };
  }

  function thisMonth() {
    return iso(new Date()).slice(0, 7);
  }

  // Six months back is enough for history and a three-month average.
  function range() {
    const now = new Date();
    return { start: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1))), end: iso(now) };
  }

  // ---- Plumbing ---------------------------------------------------------------

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

  // Animates a number from one value to another. Instant when motion is reduced.
  function countUp(el, from, to, ms, format) {
    if (reduceMotion || ms <= 0) {
      el.textContent = format(to);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.textContent = format(to);
        resolve();
      };
      const start = performance.now();
      function frame(now) {
        if (done) return;
        const p = Math.min(1, (now - start) / ms);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(frame);
        else finish();
      }
      requestAnimationFrame(frame);
      // Animation frames pause in background tabs; the final value always lands.
      setTimeout(finish, ms + 150);
    });
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));

  async function vendors() {
    if (!vendorCache) vendorCache = (await api("GET", "/api/vendors")).vendors;
    return vendorCache;
  }

  async function load() {
    const r = range();
    state = await api("GET", `/api/state?start=${r.start}&end=${r.end}`);
    render();
  }

  // ---- Top-level view -----------------------------------------------------------

  function render() {
    const now = state.rotation[0];
    document.querySelectorAll(".charity-now").forEach((el) => { el.textContent = now.name; });
    if (holdFlow) return;
    if (!state.org) {
      if ($("flow").hidden) showFlow("find");
      return;
    }
    showHome();
  }

  function setStepper(active) {
    const order = ["find", "choose", "give"];
    const at = order.indexOf(active);
    document.querySelectorAll(".stepper li").forEach((li) => {
      const i = order.indexOf(li.dataset.step);
      li.dataset.state = i < at ? "done" : i === at ? "current" : "";
      if (i === at) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
  }

  function showFlow(step) {
    $("flow").hidden = false;
    $("home").hidden = true;
    for (const s of ["find", "scan", "choose"]) $("step-" + s).hidden = s !== step;
    setStepper(step === "scan" ? "find" : step === "give" ? "give" : step);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function showHome() {
    $("flow").hidden = true;
    $("home").hidden = false;
    renderHome();
  }

  // ---- 1. Find -------------------------------------------------------------------

  async function readFile(name, text) {
    const result = window.Statement.readStatement(text, await vendors());
    if (result.error) throw new Error(result.error);
    if (!result.rows.length) throw new Error(`No AI charges found among ${result.totalRows} rows in ${name}.`);
    return result;
  }

  async function handleFile(file) {
    if (!file) return;
    try {
      const result = await readFile(file.name, await file.text());
      if (state.org) previewUpload(file.name, result);
      else scan({ filename: file.name, result, sample: false });
    } catch (err) {
      toast(err.message, true);
    }
  }

  $("csv-file").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; handleFile(f); });
  $("csv-file-home").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; handleFile(f); });

  const drop = $("drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    handleFile(e.dataTransfer.files[0]);
  });

  $("try-sample").addEventListener("click", (e) => busy(e.currentTarget, "Loading", async () => {
    try {
      const text = await (await fetch("/api/sample-statement.csv")).text();
      scan({ filename: SAMPLE.file, result: await readFile(SAMPLE.file, text), sample: true });
    } catch (err) {
      toast(err.message, true);
    }
  }));

  $("show-skip").addEventListener("click", () => {
    $("skip-form").hidden = false;
    $("skip-name").focus();
  });
  $("skip-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("POST", "/api/org", { name: $("skip-name").value, billingEmail: $("skip-email").value });
      await load();
    } catch (err) {
      toast(err.message, true);
    }
  });

  // ---- 1b. The scan: replay the statement and catch each AI charge ----------------

  function tallyVendors(rows) {
    const totals = {};
    for (const r of rows) if (r.vendor) totals[r.vendor] = (totals[r.vendor] || 0) + r.amount;
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }

  function toolBars(entries, limit = 7) {
    const top = entries.slice(0, limit);
    const max = Math.max(1, ...top.map(([, v]) => v));
    return top.map(([name, dollars]) => `
      <div class="tool"><span>${esc(name)}</span><span class="track"><i style="width:${Math.max(3, (dollars / max) * 100)}%"></i></span><span>${money(dollars * 100)}</span></div>`).join("");
  }

  function tapeRow(r) {
    const el = document.createElement("div");
    el.className = "row " + (r.vendor ? "ai" : "skip");
    el.innerHTML = `<span class="d">${shortDate(r.date)}</span><span class="t">${esc(r.description)}${r.vendor ? `<span class="chip">${esc(r.vendor)}</span>` : ""}</span><span class="a">${moneyExact(Math.round(r.amount * 100))}</span>`;
    return el;
  }

  async function scan(f) {
    found = { ...f, summary: window.Statement.summarize(f.result.rows, new Date()) };
    statementSent = false;
    showFlow("scan");
    $("scan-file").textContent = f.filename;
    const tape = $("tape");
    tape.innerHTML = "";
    const rows = [...f.result.all].sort((a, b) => a.date.localeCompare(b.date));
    const seen = [];
    let total = 0;
    let aiCount = 0;
    // About four seconds end to end, however long the statement is.
    const step = reduceMotion ? 0 : Math.max(16, Math.min(70, 4200 / rows.length));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      seen.push(r);
      if (r.vendor) {
        total += r.amount;
        aiCount++;
      }
      if (!reduceMotion || i === rows.length - 1) {
        tape.prepend(tapeRow(r));
        while (tape.children.length > 14) tape.lastChild.remove();
        $("found-total").textContent = money(total * 100);
        $("found-count").textContent = `${aiCount} AI charges · ${i + 1} of ${rows.length} transactions read`;
        if (r.vendor || i === rows.length - 1) $("found-tools").innerHTML = toolBars(tallyVendors(seen));
      }
      if (step) await new Promise((res) => setTimeout(res, step));
    }
    $("found-count").textContent = `${aiCount} AI charges in ${rows.length} transactions. ${rows.length - aiCount} others stay on this device.`;
    await wait(1100);
    showChoose();
  }

  // ---- 2. Choose -----------------------------------------------------------------

  function firstGiftBasisCents() {
    const last = found.summary.lastFull;
    return last ? Math.round(last.total * 100) : 0;
  }

  function showChoose() {
    showFlow("choose");
    const { summary, result, sample } = found;
    const last = summary.lastFull;
    const who = sample ? SAMPLE.name : "Your team";
    const monthRows = last ? result.all.filter((r) => r.vendor && r.date.startsWith(last.month)) : result.all.filter((r) => r.vendor);
    const tools = tallyVendors(monthRows);
    $("reveal-title").textContent = last
      ? `${who} spent ${money(last.total * 100)} on AI in ${monthLong(last.month)}`
      : `${who} has spent ${money(result.total * 100)} on AI so far this month`;
    const growth = summary.growth;
    $("reveal-growth").hidden = !(growth && growth > 0.05);
    if (growth && growth > 0.05) $("reveal-growth").textContent = `Up ${Math.round(growth * 100)}% since ${monthLong(summary.growthFrom)}`;
    $("reveal-sub").textContent = `${tools.length} AI tools, found among ${result.totalRows} card transactions.`;
    $("reveal-tools").innerHTML = toolBars(tools);
    $("first-name").value = sample ? SAMPLE.name : "";
    $("first-email").value = sample ? SAMPLE.email : "";
    $("first-rate").value = "1";
    updateChoose();
  }

  function updateChoose() {
    const rate = Number($("first-rate").value) / 100;
    const last = found.summary.lastFull;
    const basis = last ? firstGiftBasisCents() : Math.round(found.result.total * 100);
    const monthly = Math.round(basis * rate);
    $("first-rate-out").textContent = pctText(rate);
    $("first-month").textContent = moneyExact(monthly);
    $("first-year").textContent = money(monthly * 12);
    const charity = state.rotation[0].name;
    const giftNow = last && monthly >= 100;
    $("give-first").textContent = giftNow ? `Give ${moneyExact(monthly)} for ${monthLong(last.month)}` : "Start monthly giving";
    $("give-first-note").textContent = `Goes to the ${charity}. Then one gift a month, and you can change or pause it any time.`;
  }

  $("first-rate").addEventListener("input", updateChoose);

  $("give-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy($("give-first"), "Giving", async () => {
      const before = { ...state.community };
      const rate = Number($("first-rate").value) / 100;
      const last = found.summary.lastFull;
      const name = $("first-name").value.trim();
      try {
        await api("POST", "/api/org", { name, billingEmail: $("first-email").value });
        if (!statementSent) {
          await api("POST", "/api/statement", { filename: found.filename, rows: found.result.rows });
          statementSent = true;
        }
        await api("POST", "/api/pledge", { rate, basis: "card" });
        let invoice = null;
        if (last && Math.round(firstGiftBasisCents() * rate) >= 100) {
          const { start, end } = monthBounds(last.month);
          invoice = (await api("POST", "/api/invoices", { start, end })).invoice;
        }
        holdFlow = Boolean(invoice);
        await load();
        found = null;
        if (invoice) {
          setStepper("give");
          celebrate(invoice, before);
        } else {
          toast("Monthly giving is set up.");
        }
      } catch (err) {
        holdFlow = false;
        toast(err.message, true);
      }
    });
  });

  // ---- 3. Give: the thank-you, and the community growing by one -------------------

  async function celebrate(invoice, before) {
    const after = state.community;
    channel?.postMessage({ type: "gift", company: state.org.name, amountCents: invoice.amount_cents, charity: invoice.charity });
    $("t-text").textContent = `is on its way to the ${invoice.charity}.`;
    $("t-invoice").href = `invoice.html?id=${invoice.id}`;
    $("t-invoice").hidden = false;
    $("t-companies").textContent = String(before.companies);
    $("t-monthly").textContent = money(before.monthlyCents);
    $("t-companies").classList.remove("bump");
    $("t-monthly").classList.remove("bump");
    $("t-amt").textContent = "$0.00";
    $("thanks").showModal();
    await countUp($("t-amt"), 0, invoice.amount_cents, 900, moneyExact);
    await wait(450);
    $("t-companies").classList.add("bump");
    $("t-monthly").classList.add("bump");
    countUp($("t-companies"), before.companies, after.companies, 700, (v) => String(Math.round(v)));
    countUp($("t-monthly"), before.monthlyCents, after.monthlyCents, 900, money);
  }

  // Leaving the thank-you shows home. Runs from the button at once, and from
  // the dialog's close event when it's dismissed with Escape.
  function afterThanks() {
    if (!holdFlow) return;
    holdFlow = false;
    render();
  }
  $("t-done").addEventListener("click", () => {
    $("thanks").close();
    afterThanks();
  });
  $("thanks").addEventListener("close", afterThanks);

  // ---- Home ----------------------------------------------------------------------

  function rate() {
    return Number($("rate").value) / 100;
  }

  function hasProviders() {
    return state.connections.some((c) => c.kind === "anthropic" || c.kind === "openai");
  }

  function basisOf(m) {
    const basis = hasProviders() ? $("basis").value : "card";
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

  // The latest finished month that hasn't been given for yet.
  function readyMonth() {
    const after = lastGiftEnd();
    const ready = fullMonths().filter((m) => monthBounds(m.month).end > after && basisOf(m) > 0);
    return ready.length ? ready[ready.length - 1] : null;
  }

  // Last full month's spend, the same figure the first gift was based on, so
  // "each month" reads the same before and after giving. With no full month
  // yet, this month so far is stretched to a whole month.
  function monthlyBasis() {
    const full = fullMonths();
    if (full.length) return basisOf(full[full.length - 1]);
    const current = state.spend.months.find((m) => m.month === thisMonth());
    return current ? (basisOf(current) / new Date().getUTCDate()) * 30 : 0;
  }

  function givenCents() {
    return state.invoices.reduce((s, i) => s + i.amount_cents, 0);
  }

  function renderHome() {
    $("org-name-out").textContent = state.org.name;
    $("rate").value = String(Math.round(state.org.pledgeRate * 10000) / 100);
    $("basis").value = state.org.basis;
    $("basis-line").hidden = !hasProviders();
    $("s-rate").textContent = pctText(state.org.pledgeRate);
    $("org-email-out").textContent = state.org.billingEmail ? `Invoices go to ${state.org.billingEmail}` : "";
    renderReady();
    renderImpact();
    renderDial();
    renderSpend();
    renderNotes();
  }

  function renderReady() {
    const m = readyMonth();
    $("ready").hidden = !m;
    $("next").hidden = Boolean(m);
    const r = rate();
    if (m) {
      const basis = basisOf(m);
      const amount = Math.round(basis * r);
      $("ready-title").textContent = `${monthLong(m.month)}’s gift is ready`;
      $("ready-basis").textContent = money(basis);
      $("ready-rate").textContent = pctText(r);
      $("ready-amt").textContent = moneyExact(amount);
      $("give").textContent = `Give ${moneyExact(amount)}`;
      $("give").disabled = amount < 100;
      $("give").dataset.month = m.month;
      return;
    }
    const now = new Date();
    const nextFirst = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    $("next-title").textContent = nextFirst.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
    const current = state.spend.months.find((x) => x.month === thisMonth());
    const soFar = current ? basisOf(current) : 0;
    $("next-text").textContent = soFar
      ? `${monthLong(thisMonth())} so far: ${money(soFar)} of AI spend, so ${moneyExact(Math.round(soFar * r))} at ${pctText(r)}.`
      : "Add spending data to see this month’s AI spend.";
    const nextCharity = state.rotation[1];
    $("next-charity").textContent = nextCharity.name;
    $("next-target").textContent = nextCharity.target;
  }

  function renderImpact() {
    const given = givenCents();
    const gifts = state.invoices.length;
    const first = state.invoices.reduce((min, i) => (!min || i.period_start < min ? i.period_start : min), "");
    $("given-amt").textContent = moneyExact(given);
    $("given-text").textContent = gifts
      ? `given across ${gifts} monthly gift${gifts === 1 ? "" : "s"} since ${monthLong(first.slice(0, 7))}.`
      : "given so far. Your first gift will appear here.";
    const c = state.community;
    $("community").innerHTML = gifts
      ? `${HEART_SMALL}<span>You&rsquo;re one of <b>${c.companies}</b> companies giving <b>${money(c.monthlyCents)}</b> every month.</span>`
      : `${HEART_SMALL}<span><b>${c.companies}</b> companies already give <b>${money(c.monthlyCents)}</b> every month.</span>`;
    $("gifts").innerHTML = state.invoices.map((i) => `
      <div class="g">
        <span class="mark">${HEART}</span>
        <div><div class="t">${esc(monthYear(i.period_end.slice(0, 7)))}</div>
          <div class="s">${pctText(i.rate)} of ${money(i.basis_cents)} AI spend, to the ${esc(i.charity)}</div></div>
        <div class="r"><b class="num">${moneyExact(i.amount_cents)}</b>
          ${i.status === "paid" ? '<span class="pill ok"><span class="dot"></span>Received</span>' : '<span class="pill warn"><span class="dot"></span>On its way</span>'}
          <span class="small"><a href="invoice.html?id=${i.id}">Invoice</a>${i.status === "paid"
            ? ` &middot; <a href="receipt.html?id=${i.id}">Tax receipt</a>`
            : ` &middot; <button class="linkish small" type="button" data-paid="${i.id}">Mark received</button>`}</span>
        </div>
      </div>`).join("");
  }

  function renderDial() {
    const r = rate();
    // Round to whole cents first so month, year and the first gift agree.
    const monthly = Math.round(monthlyBasis() * r);
    $("rate-out").textContent = pctText(r);
    $("o-month").textContent = moneyExact(monthly);
    $("o-year").textContent = money(monthly * 12);
    $("o-ten").textContent = money(monthly * 120);
  }

  function renderSpend() {
    const s = state.spend;
    const rows = [...s.vendors.map((v) => [v.vendor, v.cents / 100]), ...s.providers.map((v) => [`${v.vendor} usage`, v.cents / 100])]
      .sort((a, b) => b[1] - a[1]);
    $("tools").innerHTML = rows.length ? toolBars(rows, 8) : '<p class="muted">No AI spend yet. Add a statement or connect a card below.</p>';
    $("spend-period").textContent = s.months.length ? `Since ${monthYear(s.months[0].month)}` : "";
    $("sources").innerHTML = state.connections.map((c) => `
      <span class="source ${c.status === "error" ? "err" : ""}" title="${esc(c.error || "")}">
        ${esc(c.kind === "anthropic" || c.kind === "openai" ? c.label + " usage" : c.label)}
        <button class="x" type="button" data-remove="${c.id}" aria-label="Remove ${esc(c.label)}">&times;</button>
      </span>`).join("");
    document.querySelector("details.more").open = state.connections.length === 0;
    $("connect-plaid").disabled = !state.plaid.configured;
    $("connect-sandbox").hidden = !(state.plaid.configured && state.plaid.env === "sandbox");
    const ai = state.transactions.filter((t) => t.vendor);
    $("txns").innerHTML = ai.map((t) => `
      <tr><td class="num">${shortDate(t.date)}</td><td>${esc(t.description)}</td>
      <td><span class="pill ai">${esc(t.vendor)}</span></td><td class="r num">${moneyExact(t.amount_cents)}</td></tr>`).join("")
      || '<tr><td colspan="4" class="muted">No AI charges yet.</td></tr>';
  }

  // Every caveat lives here, at the bottom of the page, never beside the controls.
  function renderNotes() {
    const notes = [];
    if (state.stripe.configured && state.stripe.testMode) notes.push("Invoices are created in Stripe test mode. No real payments are taken.");
    if (!state.stripe.configured) notes.push("Gifts are recorded in Tributary. Add a Stripe key to send invoices through Stripe.");
    if (!state.plaid.configured) notes.push("Connecting a card through Plaid needs <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code> in <code>server/.env</code>.");
    notes.push("Provider cost reports need an organization admin key. Anthropic doesn't offer admin keys on individual accounts, so most companies use their card instead.");
    notes.push("Each month's charity comes from a proposed rotation. Charities must agree before they receive gifts through Tributary.");
    notes.push("Photos from Unsplash illustrate areas of care. They weren't taken at the foundation's sites.");
    $("notes").innerHTML = notes.map((n) => `<li>${n}</li>`).join("");
  }

  // ---- Home actions ----------------------------------------------------------------

  function savePledgeSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      api("POST", "/api/pledge", { rate: rate(), basis: hasProviders() ? $("basis").value : "card" })
        .then((out) => {
          state.org.pledgeRate = out.org.pledge_rate;
          state.org.basis = out.org.basis;
          $("s-rate").textContent = pctText(state.org.pledgeRate);
        })
        .catch((err) => toast(err.message, true));
    }, 350);
  }

  $("rate").addEventListener("input", () => { renderDial(); renderReady(); savePledgeSoon(); });
  $("basis").addEventListener("change", () => { renderDial(); renderReady(); savePledgeSoon(); });

  $("give").addEventListener("click", () => busy($("give"), "Giving", async () => {
    clearTimeout(saveTimer);
    const month = $("give").dataset.month;
    const before = { ...state.community };
    try {
      await api("POST", "/api/pledge", { rate: rate(), basis: hasProviders() ? $("basis").value : "card" });
      const { start, end } = monthBounds(month);
      const { invoice } = await api("POST", "/api/invoices", { start, end });
      await load();
      celebrate(invoice, before);
    } catch (err) {
      toast(err.message, true);
    }
  }));

  let pending = null; // a statement uploaded from home, waiting for confirmation

  function previewUpload(filename, result) {
    pending = { filename, rows: result.rows };
    $("csv-title").textContent = `${result.rows.length} AI charges, ${moneyExact(Math.round(result.total * 100))}`;
    $("csv-help").textContent = `Found in ${filename}.`;
    $("csv-list").innerHTML = result.byVendor.map(([name, dollars]) =>
      `<li><span>${esc(name)}</span><b class="num">${moneyExact(Math.round(dollars * 100))}</b></li>`).join("");
    $("csv-private").textContent = `Only these ${result.rows.length} rows are sent: date, description and amount. The other ${result.totalRows - result.rows.length} rows stay on this device.`;
    $("csv-error").hidden = true;
    $("csv-dialog").showModal();
  }

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

  // Start over wipes every company, connection and gift, so it asks once more in place.
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
      found = null;
      $("skip-form").hidden = true;
      $("flow").hidden = true;
      await load();
      channel?.postMessage({ type: "reset" });
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
    anthropic: { title: "Add Anthropic admin key", help: "Create an admin key in your organization's console settings. Tributary only reads the cost report." },
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
        channel?.postMessage({ type: "paid" });
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
        toast("Connected.");
      } catch (err) {
        $("key-error").textContent = err.message;
        $("key-error").hidden = false;
      }
    });
  });

  load().catch((err) => toast(err.message, true));
})();
