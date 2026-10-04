// Landing page: live giving numbers, the gift stream, and the scale steps.
(function () {
  const $ = (id) => document.getElementById(id);
  const M = window.Motion;

  const money = (cents) => "$" + Math.round(cents / 100).toLocaleString("en-US");
  const moneyExact = (cents) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const count = (n) => Math.round(n).toLocaleString("en-US");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const monthYear = (d) => new Date(d.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

  // Shown until the ledger loads, and if it can't.
  const SAMPLE = { companies: 45, monthlyCents: 2450000, totalCents: 14680000 };
  const TOAST_EVERY = 13800; // a gift passes over the photo every 13.8 seconds
  const TOAST_SHOW = 6500;
  const COUNT_MS = 1000; // the total rolls up to each new gift over one second

  let data = null;
  let signature = "";
  const seen = new Set();
  // Numbers restart after "Start over", so the creation time keeps keys unique.
  const keyOf = (e) => `${e.number}|${e.created_at}`;

  // ---- Live counter: still between gifts, rolls up as each one lands -----------

  function monthFraction(now) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return (now - start) / (end - start);
  }

  const live = $("h-live");
  const pledgedSoFar = (monthlyCents) => Math.round(monthlyCents * monthFraction(new Date()));
  let liveCents = pledgedSoFar(SAMPLE.monthlyCents);
  M.set(live, liveCents, moneyExact);

  function addToLive(cents) {
    liveCents += cents;
    M.to(live, liveCents, COUNT_MS, moneyExact);
    M.pop(live, "bump");
    M.floatDelta(live, "+" + moneyExact(cents));
  }

  function showCommunity(c, ms) {
    M.to($("h-monthly"), c.monthlyCents, ms, money);
    M.to($("h-companies"), c.companies, ms, count);
    M.to($("h-total"), c.totalCents, ms, money);
  }

  // The mini stats roll up from zero as the card arrives.
  M.set($("h-monthly"), 0, money);
  M.set($("h-companies"), 0, count);
  M.set($("h-total"), 0, money);

  // ---- Gift stream over the hero photo ------------------------------------------

  let toastIndex = 0;
  let holdUntil = 0;
  let hideTimer;

  function showToast(html, fresh) {
    const el = $("gift-toast");
    el.classList.remove("show");
    void el.offsetWidth;
    el.innerHTML = HEART + `<span>${html}</span>`;
    el.classList.toggle("fresh", Boolean(fresh));
    el.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.remove("show"), fresh ? 8000 : TOAST_SHOW);
  }

  function cycleToast() {
    if (!data || !data.entries.length || Date.now() < holdUntil) return;
    const e = data.entries[toastIndex % data.entries.length];
    toastIndex++;
    showToast(`<b>${esc(e.company)}</b>&nbsp;gave&nbsp;<b>${moneyExact(e.amount_cents)}</b>`, false);
    addToLive(e.amount_cents);
  }

  // ---- Ledger -------------------------------------------------------------------

  let charitySignature = "";
  function renderCharities() {
    const s = JSON.stringify(data.rotation);
    if (s === charitySignature) return;
    charitySignature = s;
    const [now, ...next] = data.rotation;
    document.querySelectorAll(".charity-now").forEach((el) => { el.textContent = now.name; });
    $("c-now-month").textContent = `This month · ${monthYear(now.month)}`;
    $("c-now-name").textContent = now.name;
    $("c-now-focus").textContent = now.focus;
    $("c-now-target").textContent = now.target;
    $("c-upcoming").innerHTML = next.map((c) => `
      <div class="up"><span class="m">${esc(monthYear(c.month))}</span><h4>${esc(c.name)}</h4><p>${esc(c.focus)}</p><span class="tgt">${esc(c.target)}</span></div>`).join("");
  }

  function renderGifts(fresh) {
    $("gift-list").innerHTML = data.entries.slice(0, 8).map((e) => `
      <div class="gift${fresh.has(keyOf(e)) ? " new" : ""}">
        <span class="mark">${HEART}</span>
        <div><div class="who">${esc(e.company)}</div><div class="when">Gift for ${esc(monthYear(e.period_end))} &middot; ${esc(e.number)}</div></div>
        <div class="amt"><b>${moneyExact(e.amount_cents)}</b>${e.status === "paid"
          ? '<span class="pill ok"><span class="dot"></span>Received</span>'
          : '<span class="pill warn"><span class="dot"></span>On its way</span>'}</div>
      </div>`).join("");
  }

  async function loadLedger() {
    let next;
    try {
      const res = await fetch("/api/ledger", { cache: "no-store" });
      if (!res.ok) return false;
      next = await res.json();
    } catch {
      return false;
    }
    const first = data === null;
    const fresh = first ? [] : next.entries.filter((e) => !seen.has(keyOf(e)));
    const wentDown = !first && next.community.totalCents < data.community.totalCents;
    data = next;
    next.entries.forEach((e) => seen.add(keyOf(e)));

    const s = JSON.stringify([next.community, next.entries.map(keyOf), next.entries.map((e) => e.status)]);
    if (s === signature) return true;
    signature = s;

    if (first || wentDown) {
      // First load, or everything was reset in the giving page: start from this month's pace.
      liveCents = pledgedSoFar(next.community.monthlyCents);
      M.set(live, liveCents, moneyExact);
    }
    if (first) setTimeout(() => showCommunity(next.community, 1400), 480);
    else showCommunity(next.community, COUNT_MS);

    if (fresh.length) {
      // A gift made just now, in the giving page or anywhere else.
      holdUntil = Date.now() + 9000;
      const e = fresh[0];
      showToast(`<b>${esc(e.company)}</b>&nbsp;just gave&nbsp;<b>${moneyExact(e.amount_cents)}</b>`, true);
      addToLive(fresh.reduce((sum, x) => sum + x.amount_cents, 0));
    }
    renderCharities();
    renderGifts(new Set(fresh.map(keyOf)));
    if (!first && currentLevel === "today") fill("today", false);
    return true;
  }

  // A gift made in the giving page, in this browser, shows up here at once.
  if ("BroadcastChannel" in window) {
    new BroadcastChannel("pledge").addEventListener("message", () => loadLedger());
  }

  // ---- Scale: one team, companies on Pledge, every company ----------------------

  const ORDER = ["team", "today", "world"];
  const DWELL = 7200; // each step stays up for 7.2 seconds
  const tabs = document.querySelector(".scale-tabs");
  const indicator = tabs.querySelector(".tab-ind");
  const panel = $("scale-panel");
  let currentLevel = "world";

  function levels() {
    const c = data ? data.community : SAMPLE;
    const yearly = c.monthlyCents * 12;
    return {
      team: {
        k: "1% of one team’s AI spend",
        big: [18800, money],
        unit: "a month",
        text: "A team spending $18,822 a month on AI gives $188 a month at 1%. Their AI bill barely moves.",
        a: ["AI spend, one month", "$18,822", 100],
        b: ["Their gift at 1%", "$188", 1],
      },
      today: {
        k: `1% of AI spend at ${c.companies} companies`,
        big: [c.monthlyCents, money],
        unit: "a month",
        text: `${c.companies} companies give 1% of their AI spend through Pledge. At this pace that’s ${money(yearly)} in the next year.`,
        a: ["Given so far", money(c.totalCents), Math.min(100, (c.totalCents / Math.max(c.totalCents, yearly)) * 100)],
        b: ["Next 12 months at this pace", money(yearly), Math.min(100, (yearly / Math.max(c.totalCents, yearly)) * 100)],
      },
      world: {
        k: "1% of the world’s AI spend",
        big: [26.7, (v) => `$${v.toFixed(1)} billion`],
        unit: "a year",
        text: 'The world will spend $2.67 trillion on AI in 2026.<sup><a href="#note-1">1</a></sup> One percent of that is about 15% of all foreign aid given in 2025, the year aid fell a record 23%.<sup><a href="#note-2">2</a></sup>',
        a: ["All foreign aid, 2025", "$174.3B", 100],
        b: ["1% of AI spend, 2026", "$26.7B", 15.3],
      },
    };
  }

  // Writes a step into the panel. `fresh` rolls the big number up from zero and
  // grows the bars from nothing; otherwise the figures move to their new values.
  function fill(level, fresh) {
    const L = levels()[level];
    const [value, format] = L.big;
    $("scale-k").textContent = L.k;
    if (fresh) M.tween($("scale-big"), 0, value, 1200, format);
    else M.to($("scale-big"), value, COUNT_MS, format);
    $("scale-unit").textContent = L.unit;
    $("scale-text").innerHTML = L.text;
    $("cmp-a-label").textContent = L.a[0];
    $("cmp-a-val").textContent = L.a[1];
    $("cmp-b-label").textContent = L.b[0];
    $("cmp-b-val").textContent = L.b[1];
    const bars = [[$("cmp-a"), L.a[2]], [$("cmp-b"), L.b[2]]];
    if (fresh && !M.reduce) {
      bars.forEach(([el]) => { el.style.transition = "none"; el.style.width = "0%"; });
      void panel.offsetWidth;
      bars.forEach(([el]) => { el.style.transition = ""; });
    }
    bars.forEach(([el, w]) => { el.style.width = Math.max(1, w) + "%"; });
  }

  function placeIndicator() {
    const b = tabs.querySelector('[aria-selected="true"]');
    indicator.style.width = b.offsetWidth + "px";
    indicator.style.height = b.offsetHeight + "px";
    indicator.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`;
  }

  let swapTimer;
  function setLevel(level) {
    currentLevel = level;
    tabs.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.level === level;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    placeIndicator();
    panel.setAttribute("aria-labelledby", "tab-" + level);
    panel.dataset.level = level;
    clearTimeout(swapTimer);
    if (M.reduce) return fill(level, false);
    // The old figures blur away, then the new ones rise in.
    panel.classList.remove("entering");
    panel.classList.add("leaving");
    swapTimer = setTimeout(() => {
      fill(level, true);
      panel.classList.remove("leaving");
      void panel.offsetWidth;
      panel.classList.add("entering");
    }, 280);
  }

  // The steps play on their own while the panel is on screen, until a visitor
  // picks one. Each tab's teal line shows how long until the next step.
  let autoplay = false;
  let inView = false;
  let autoTimer;

  function schedule() {
    clearTimeout(autoTimer);
    tabs.classList.remove("playing");
    if (!autoplay || !inView) return;
    void indicator.offsetWidth;
    tabs.classList.add("playing");
    autoTimer = setTimeout(() => {
      setLevel(ORDER[(ORDER.indexOf(currentLevel) + 1) % ORDER.length]);
      schedule();
    }, DWELL);
  }

  function stopAutoplay() {
    autoplay = false;
    schedule();
    panel.setAttribute("aria-live", "polite");
  }

  tabs.style.setProperty("--dwell", DWELL + "ms");
  tabs.classList.add("has-ind");
  placeIndicator();
  requestAnimationFrame(() => tabs.classList.add("ready"));
  window.addEventListener("resize", placeIndicator);
  if (document.fonts) document.fonts.ready.then(placeIndicator);
  M.set($("scale-big"), 26.7, levels().world.big[1]);

  tabs.querySelectorAll("button").forEach((b, i, all) => {
    b.addEventListener("click", () => {
      stopAutoplay();
      if (b.dataset.level !== currentLevel) setLevel(b.dataset.level);
    });
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
      next.focus();
      next.click();
    });
  });

  if (!M.reduce && "IntersectionObserver" in window) {
    let started = false;
    new IntersectionObserver((entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView && !started) {
        // The first time it scrolls into view, start the walk from one team.
        started = true;
        autoplay = true;
        setLevel("team");
      }
      schedule();
    }, { threshold: 0.4 }).observe(panel);
  }

  // ---- Start ----------------------------------------------------------------------

  loadLedger().then((ok) => {
    if (!ok) setTimeout(() => showCommunity(SAMPLE, 1400), 480);
    setTimeout(() => {
      cycleToast();
      setInterval(cycleToast, TOAST_EVERY);
    }, 2600);
  });
  // Other browsers and devices: check for new gifts every few seconds.
  setInterval(loadLedger, 5000);
})();
