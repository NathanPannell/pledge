// Landing page: live giving numbers, the gift stream, and the scale steps.
(function () {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const money = (cents) => "$" + Math.round(cents / 100).toLocaleString("en-US");
  const moneyExact = (cents) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const monthYear = (d) => new Date(d.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

  let data = null;
  let lastTotal = null;
  const seen = new Set();

  // ---- Live counter: monthly giving accrues as companies spend on AI ----------

  function monthFraction(now) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return (now - start) / (end - start);
  }

  function tick() {
    const monthly = data ? data.community.monthlyCents : 2450000;
    $("h-live").textContent = moneyExact(Math.round(monthly * monthFraction(new Date())));
  }

  function bump() {
    const el = $("h-live");
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  // ---- Gift stream over the hero photo ------------------------------------------

  let toastIndex = 0;
  let holdUntil = 0;
  let hideTimer;

  function showToast(html, fresh) {
    const el = $("gift-toast");
    el.innerHTML = HEART + `<span>${html}</span>`;
    el.classList.toggle("fresh", Boolean(fresh));
    el.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.remove("show"), fresh ? 5200 : 3400);
  }

  function cycleToast() {
    if (!data || !data.entries.length || Date.now() < holdUntil) return;
    const e = data.entries[toastIndex % data.entries.length];
    toastIndex++;
    showToast(`<b>${esc(e.company)}</b>&nbsp;gave&nbsp;<b>${moneyExact(e.amount_cents)}</b>`, false);
  }

  // ---- Ledger -------------------------------------------------------------------

  function renderCharities() {
    const [now, ...next] = data.rotation;
    document.querySelectorAll(".charity-now").forEach((el) => { el.textContent = now.name; });
    $("c-now-month").textContent = `This month · ${monthYear(now.month)}`;
    $("c-now-name").textContent = now.name;
    $("c-now-focus").textContent = now.focus;
    $("c-now-target").textContent = now.target;
    $("c-upcoming").innerHTML = next.map((c) => `
      <div class="up"><span class="m">${esc(monthYear(c.month))}</span><h4>${esc(c.name)}</h4><p>${esc(c.focus)}</p><span class="tgt">${esc(c.target)}</span></div>`).join("");
  }

  function renderGifts(markNew) {
    $("gift-list").innerHTML = data.entries.slice(0, 8).map((e) => {
      const isNew = markNew && !seen.has(e.number);
      return `
      <div class="gift${isNew ? " new" : ""}">
        <span class="mark">${HEART}</span>
        <div><div class="who">${esc(e.company)}</div><div class="when">Gift for ${esc(monthYear(e.period_end))} &middot; ${esc(e.number)}</div></div>
        <div class="amt"><b>${moneyExact(e.amount_cents)}</b>${e.status === "paid"
          ? '<span class="pill ok"><span class="dot"></span>Received</span>'
          : '<span class="pill warn"><span class="dot"></span>On its way</span>'}</div>
      </div>`;
    }).join("");
    data.entries.forEach((e) => seen.add(e.number));
  }

  async function loadLedger(markNew) {
    let next;
    try {
      const res = await fetch("/api/ledger", { cache: "no-store" });
      if (!res.ok) return;
      next = await res.json();
    } catch {
      return;
    }
    data = next;
    const c = data.community;
    $("h-monthly").textContent = money(c.monthlyCents);
    $("h-companies").textContent = c.companies.toLocaleString("en-US");
    $("h-total").textContent = money(c.totalCents);
    if (lastTotal !== null && c.totalCents > lastTotal) bump();
    lastTotal = c.totalCents;
    renderCharities();
    renderGifts(markNew);
    if (currentLevel === "today") setLevel("today", true);
    tick();
  }

  // A gift made in the giving page, in this browser, shows up here at once.
  if ("BroadcastChannel" in window) {
    new BroadcastChannel("tributary").addEventListener("message", (e) => {
      const msg = e.data || {};
      if (msg.type === "gift") {
        holdUntil = Date.now() + 6000;
        showToast(`<b>${esc(msg.company)}</b>&nbsp;just gave&nbsp;<b>${moneyExact(msg.amountCents)}</b>`, true);
      }
      loadLedger(true);
    });
  }

  // ---- Scale: one team, Tributary today, every company ------------------------

  let currentLevel = "world";
  const autoplay = [];

  function levels() {
    const c = data ? data.community : { companies: 45, monthlyCents: 2450000, totalCents: 14680000 };
    const yearly = c.monthlyCents * 12;
    return {
      team: {
        k: "1% of one team’s AI spend",
        big: "$188",
        unit: "a month",
        text: "A team spending $18,822 a month on AI gives $188 a month at 1%. Their AI bill barely moves.",
        a: ["AI spend, one month", "$18,822", 100],
        b: ["Their gift at 1%", "$188", 1],
      },
      today: {
        k: `1% of AI spend at ${c.companies} companies`,
        big: money(c.monthlyCents),
        unit: "a month",
        text: `${c.companies} companies give 1% of their AI spend through Tributary. At this pace that’s ${money(yearly)} in the next year.`,
        a: ["Given so far", money(c.totalCents), Math.min(100, (c.totalCents / Math.max(c.totalCents, yearly)) * 100)],
        b: ["Next 12 months at this pace", money(yearly), Math.min(100, (yearly / Math.max(c.totalCents, yearly)) * 100)],
      },
      world: {
        k: "1% of the world’s AI spend",
        big: "$26.7 billion",
        unit: "a year",
        text: 'The world will spend $2.67 trillion on AI in 2026.<sup><a href="#note-1">1</a></sup> One percent of that is about 15% of all foreign aid given in 2025, the year aid fell a record 23%.<sup><a href="#note-2">2</a></sup>',
        a: ["All foreign aid, 2025", "$174.3B", 100],
        b: ["1% of AI spend, 2026", "$26.7B", 15.3],
      },
    };
  }

  function setLevel(level, quiet) {
    currentLevel = level;
    const L = levels()[level];
    document.querySelectorAll(".scale-tabs button").forEach((b) => {
      const on = b.dataset.level === level;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $("scale-panel").setAttribute("aria-labelledby", "tab-" + level);
    $("scale-k").textContent = L.k;
    $("scale-big").textContent = L.big;
    $("scale-unit").textContent = L.unit;
    $("scale-text").innerHTML = L.text;
    $("cmp-a-label").textContent = L.a[0];
    $("cmp-a-val").textContent = L.a[1];
    $("cmp-b-label").textContent = L.b[0];
    $("cmp-b-val").textContent = L.b[1];
    // Restart the bars from zero so each step reads as a fresh comparison.
    const bars = [[$("cmp-a"), L.a[2]], [$("cmp-b"), L.b[2]]];
    if (quiet || reduceMotion) {
      bars.forEach(([el, w]) => { el.style.width = Math.max(1, w) + "%"; });
      return;
    }
    bars.forEach(([el]) => { el.style.transition = "none"; el.style.width = "0%"; });
    void $("cmp-a").offsetWidth;
    bars.forEach(([el, w]) => { el.style.transition = ""; el.style.width = Math.max(1, w) + "%"; });
  }

  function stopAutoplay() {
    autoplay.forEach(clearTimeout);
    autoplay.length = 0;
  }

  document.querySelectorAll(".scale-tabs button").forEach((b, i, all) => {
    b.addEventListener("click", () => { stopAutoplay(); setLevel(b.dataset.level); });
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
      next.focus();
      next.click();
    });
  });

  // The first time the section scrolls into view, walk from one team to the world.
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      setLevel("team");
      autoplay.push(setTimeout(() => setLevel("today"), 2400));
      autoplay.push(setTimeout(() => setLevel("world"), 4800));
    }, { threshold: 0.5 });
    io.observe($("scale-panel"));
  }

  tick();
  setInterval(tick, 250);
  loadLedger(false).then(() => {
    cycleToast();
    setInterval(cycleToast, 4600);
  });
  // Other browsers and devices: check for new gifts every few seconds.
  setInterval(() => loadLedger(true), 5000);
})();
