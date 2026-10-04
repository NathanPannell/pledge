// The scale chart: what OpenAI and Anthropic take in each year against all
// foreign aid, and the quarter the two lines cross. Drawn as SVG at the
// container's pixel size so text stays crisp. It plays every time it scrolls
// into view: both lines draw through time together, the crossing lands with
// a pulse and a callout, then a crosshair shows the figures for any month.
(function () {
  const root = document.getElementById("cross-chart");
  if (!root) return;
  const M = window.Motion;
  const NS = "http://www.w3.org/2000/svg";
  const plot = root.querySelector(".cc-plot");

  // ---- Data. Sources are notes 3 to 5 at the bottom of the page. ----------------

  // OpenAI + Anthropic annualized revenue in $B at quarter ends: each company's
  // reported run rate (Epoch AI) interpolated between its own reports, then summed.
  // September 2026 holds Anthropic at its latest report, $65B in July.
  const AI = [
    ["2024-12-31", 6.5], ["2025-03-31", 9.7], ["2025-06-30", 14.7], ["2025-09-30", 21.7],
    ["2025-12-31", 30.4], ["2026-03-31", 55.0], ["2026-06-30", 92.4], ["2026-09-30", 135.0],
  ];
  // Pledge's own scenarios for Q3 2027, not a published forecast.
  const SCENARIOS = { low: 257, central: 330, high: 423 };
  // Net ODA from OECD DAC members in $B, each year plotted at mid-year.
  // 2026 and 2027 apply the OECD and Devpolicy forecast falls to the 2025 figure.
  const AID = [
    { at: "2024-07-01", year: 2024, value: 212.1 },
    { at: "2025-07-01", year: 2025, value: 174.3 },
    { at: "2026-07-01", year: 2026, value: 162.3, projected: true },
    { at: "2027-07-01", year: 2027, value: 150.4, projected: true },
  ];
  const START = "2024-07-01";
  const END = "2027-09-30";
  const Y_MAX = 450;
  const DRAW_MS = 3600;

  const T = (d) => Date.parse(d + "T00:00:00Z");
  const T0 = T(START);
  const T1 = T(END);
  const PROJ = T(AI[AI.length - 1][0]);
  const AI_START = T(AI[0][0]);
  const MONTH = 30.44 * 86400000;

  // Monotone cubic interpolation (Fritsch-Carlson): smooth, passes through every
  // point, never overshoots between them.
  function monotone(xs, ys) {
    const n = xs.length;
    const d = [];
    const m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const k = 3 / Math.sqrt(s);
        m[i] = k * a * d[i];
        m[i + 1] = k * b * d[i];
      }
    }
    return (x) => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0;
      while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i];
      const t = (x - xs[i]) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  // Growth is exponential, so the AI history is interpolated in log space.
  const aiHistory = monotone(AI.map(([d]) => T(d) / MONTH), AI.map(([, v]) => Math.log(v)));
  const aidCurve = monotone(AID.map((a) => T(a.at) / MONTH), AID.map((a) => a.value));
  const AI_NOW = AI[AI.length - 1][1];

  function aiAt(t, scenario = "central") {
    if (t < AI_START) return null;
    if (t <= PROJ) return Math.exp(aiHistory(t / MONTH));
    // Scenarios grow at a steady monthly rate from the latest figure to Q3 2027.
    const f = Math.min(1, (t - PROJ) / (T1 - PROJ));
    return AI_NOW * Math.pow(SCENARIOS[scenario] / AI_NOW, f);
  }
  const aidAt = (t) => aidCurve(t / MONTH);

  // The first day the central scenario passes total aid.
  const CROSS = (() => {
    for (let t = PROJ; t <= T1; t += 86400000) if (aiAt(t) >= aidAt(t)) return t;
    return null;
  })();

  // ---- Formatting -------------------------------------------------------------------

  const billions = (v) => "$" + (v < 10 ? v.toFixed(1) : Math.round(v)) + "B";
  const monthName = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const quarter = (t) => {
    const d = new Date(t);
    return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  };
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const el = (name, attrs, parent) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  };
  const div = (cls, html, parent) => {
    const node = document.createElement("div");
    node.className = cls;
    if (html) node.innerHTML = html;
    parent.appendChild(node);
    return node;
  };

  // ---- Drawing ----------------------------------------------------------------------

  let g = null; // geometry and live nodes of the current drawing
  let progress = M.reduce ? 1 : 0;

  function draw() {
    const w = plot.clientWidth;
    if (!w) return;
    const small = w < 560;
    const h = small ? 320 : 430;
    const m = { top: 32, right: small ? 84 : 186, bottom: 34, left: small ? 46 : 60 };
    const x = (t) => m.left + ((t - T0) / (T1 - T0)) * (w - m.left - m.right);
    const y = (v) => m.top + (1 - v / Y_MAX) * (h - m.top - m.bottom);
    const path = (from, to, fn) => {
      let d = "";
      for (let t = from; t <= to; t += 5 * 86400000) d += (d ? "L" : "M") + x(t).toFixed(1) + "," + y(fn(t)).toFixed(1);
      return d + "L" + x(to).toFixed(1) + "," + y(fn(to)).toFixed(1);
    };

    plot.innerHTML = "";
    const svg = el("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, "aria-hidden": "true" }, plot);

    // Grid and axes.
    const grid = el("g", { class: "cc-grid" }, svg);
    for (let v = 0; v <= 400; v += 100) {
      el("line", { x1: m.left, x2: w - m.right, y1: y(v), y2: y(v) }, grid);
      el("text", { x: m.left - 8, y: y(v) + 4, "text-anchor": "end" }, grid).textContent = v ? `$${v}B` : "$0";
    }
    for (const yr of [2025, 2026, 2027]) {
      const tx = x(T(`${yr}-01-01`));
      el("line", { class: "tick", x1: tx, x2: tx, y1: h - m.bottom, y2: h - m.bottom + 5 }, grid);
      el("text", { x: tx, y: h - 9, "text-anchor": "middle" }, grid).textContent = yr;
    }

    // Everything after the latest reports is a projection.
    const proj = el("g", { class: "cc-proj" }, svg);
    el("rect", { x: x(PROJ), y: m.top - 6, width: w - m.right - x(PROJ), height: h - m.top - m.bottom + 6 }, proj);
    el("line", { x1: x(PROJ), x2: x(PROJ), y1: m.top - 6, y2: h - m.bottom }, proj);
    el("text", { x: x(PROJ) + 8, y: m.top + 10 }, proj).textContent = "Projection";

    // The lines, revealed left to right through time.
    const defs = el("defs", {}, svg);
    const clip = el("clipPath", { id: "cc-reveal" }, defs);
    const reveal = el("rect", { x: 0, y: 0, width: 0, height: h }, clip);
    const lines = el("g", { "clip-path": "url(#cc-reveal)" }, svg);
    let band = "";
    for (let t = PROJ; t <= T1; t += 5 * 86400000) band += (band ? "L" : "M") + x(t).toFixed(1) + "," + y(aiAt(t, "high")).toFixed(1);
    band += "L" + x(T1) + "," + y(SCENARIOS.high);
    for (let t = T1; t >= PROJ; t -= 5 * 86400000) band += "L" + x(t).toFixed(1) + "," + y(aiAt(t, "low")).toFixed(1);
    band += "L" + x(PROJ) + "," + y(AI_NOW) + "Z";
    el("path", { class: "cc-band", d: band }, lines);
    el("path", { class: "cc-line aid", d: path(T0, PROJ, aidAt) }, lines);
    el("path", { class: "cc-line aid dash", d: path(PROJ, T1, aidAt) }, lines);
    el("path", { class: "cc-line ai", d: path(AI_START, PROJ, (t) => aiAt(t)) }, lines);
    el("path", { class: "cc-line ai dash", d: path(PROJ, T1, (t) => aiAt(t)) }, lines);

    // The crossing: a guide up from the axis, rings, a dot and a callout.
    const cx = x(CROSS);
    const cy = y(aidAt(CROSS));
    const cross = el("g", { class: "cc-cross" }, svg);
    el("line", { class: "guide", x1: cx, x2: cx, y1: h - m.bottom, y2: cy }, cross);
    el("circle", { class: "ring", cx, cy, r: 9 }, cross);
    el("circle", { class: "ring two", cx, cy, r: 9 }, cross);
    el("circle", { class: "dot", cx, cy, r: 7 }, cross);
    const callout = div("cc-callout", `<b>${quarter(CROSS)}</b><span>OpenAI and Anthropic take in more than all foreign aid</span>`, plot);
    // Up and to the left of the crossing, but never past the chart's left edge.
    callout.style.left = Math.max(cx - 16, callout.offsetWidth + 4) + "px";
    callout.style.top = cy - 22 + "px";

    // Moving tips while the lines draw, then labels at the end of each line.
    const tipAid = el("circle", { class: "cc-tip aid", r: 5 }, svg);
    const tipAi = el("circle", { class: "cc-tip ai", r: 5 }, svg);
    const readAid = div("cc-read aid", "", plot);
    const readAi = div("cc-read ai", "", plot);
    const range = small ? "" : `<span class="range">${billions(SCENARIOS.low)} to ${billions(SCENARIOS.high)}</span>`;
    const endAi = div("cc-end ai", `<b>${billions(SCENARIOS.central)}</b><span>${small ? "AI labs" : "OpenAI + Anthropic"}</span>${range}`, plot);
    endAi.style.left = x(T1) + 12 + "px";
    endAi.style.top = y(SCENARIOS.central) + "px";
    const endAid = div("cc-end aid", `<b>${billions(AID[AID.length - 1].value)}</b><span>${small ? "Aid" : "All foreign aid"}</span>`, plot);
    endAid.style.left = x(T1) + 12 + "px";
    endAid.style.top = y(AID[AID.length - 1].value) + "px";

    // Hover and keyboard readout.
    const hover = el("g", { class: "cc-hover" }, svg);
    const hLine = el("line", { y1: m.top - 6, y2: h - m.bottom }, hover);
    const hAid = el("circle", { class: "aid", r: 5 }, hover);
    const hAi = el("circle", { class: "ai", r: 5 }, hover);
    const tooltip = div("cc-tooltip", "", plot);
    const overlay = el("rect", { class: "cc-overlay", x: m.left, y: 0, width: w - m.left - m.right, height: h }, svg);

    g = { w, h, m, x, y, reveal, tipAid, tipAi, readAid, readAi, hover, hLine, hAid, hAi, tooltip, overlay, small };
    overlay.addEventListener("pointermove", (e) => showAt(timeAt(e.clientX - svg.getBoundingClientRect().left)));
    overlay.addEventListener("pointerleave", hideHover);
    apply(progress);
  }

  // Puts the drawing at `p` (0 to 1) of the way through time.
  function apply(p) {
    if (!g) return;
    const { x, y, m, w } = g;
    const xr = m.left + p * (w - m.left - m.right);
    const t = T0 + p * (T1 - T0);
    g.reveal.setAttribute("width", Math.max(0, xr + 1));
    const aid = aidAt(t);
    const ai = aiAt(t);
    place(g.tipAid, g.readAid, xr, aid, y);
    g.tipAi.style.display = g.readAi.style.display = ai === null ? "none" : "";
    if (ai !== null) place(g.tipAi, g.readAi, xr, ai, y);
    // Each readout sits on the outside of its line, so the two never collide.
    const aiOnTop = ai !== null && ai > aid;
    g.readAi.classList.toggle("above", aiOnTop);
    g.readAid.classList.toggle("above", !aiOnTop);
    root.classList.toggle("in-projection", t >= PROJ);
    root.classList.toggle("crossed", t >= CROSS);
    root.classList.toggle("done", p >= 1);
  }

  function place(tip, read, px, value, y) {
    tip.setAttribute("cx", px);
    tip.setAttribute("cy", y(value));
    read.style.left = px + "px";
    read.style.top = y(value) + "px";
    read.textContent = billions(value);
  }

  // ---- Playing ---------------------------------------------------------------------

  let playing = false;
  let run = 0; // each play gets a number; a newer play or a reset ends older ones

  function play() {
    if (M.reduce) return apply((progress = 1));
    const id = ++run;
    playing = true;
    hideHover();
    root.classList.remove("crossed", "done", "in-projection");
    root.classList.add("playing");
    const start = performance.now();
    const finish = () => {
      if (id !== run) return;
      run++;
      playing = false;
      root.classList.remove("playing");
      apply((progress = 1));
    };
    const frame = (now) => {
      if (id !== run) return;
      const f = Math.min(1, (now - start) / DRAW_MS);
      apply((progress = ease(f)));
      if (f < 1) requestAnimationFrame(frame);
      else finish();
    };
    requestAnimationFrame(frame);
    // Frames pause in background tabs; the finished chart always lands.
    setTimeout(finish, DRAW_MS + 300);
  }

  // Back to an empty chart, ready to draw again.
  function reset() {
    run++;
    playing = false;
    hideHover();
    root.classList.remove("playing");
    apply((progress = 0));
  }

  // ---- Crosshair ----------------------------------------------------------------------

  let hoverT = null;
  // Readings snap to month ends, where the quarterly figures sit.
  const monthEnd = (year, month) => Date.UTC(year, month + 1, 0);
  function timeAt(px) {
    const { m, w } = g;
    const f = Math.min(1, Math.max(0, (px - m.left) / (w - m.left - m.right)));
    const d = new Date(T0 + f * (T1 - T0));
    return monthEnd(d.getUTCFullYear(), d.getUTCMonth());
  }

  function showAt(t) {
    if (!g || playing || progress < 1) return;
    hoverT = Math.min(T1, Math.max(T0, t));
    const { x, y } = g;
    const px = x(hoverT);
    const aid = aidAt(hoverT);
    const ai = aiAt(hoverT);
    g.hLine.setAttribute("x1", px);
    g.hLine.setAttribute("x2", px);
    g.hAid.setAttribute("cx", px);
    g.hAid.setAttribute("cy", y(aid));
    g.hAi.style.display = ai === null ? "none" : "";
    if (ai !== null) {
      g.hAi.setAttribute("cx", px);
      g.hAi.setAttribute("cy", y(ai));
    }
    root.classList.add("hovering");
    const year = new Date(hoverT).getUTCFullYear();
    const total = AID.find((a) => a.year === year);
    const projected = hoverT > PROJ;
    const aiText = ai === null ? "Not yet reported" : `about ${billions(ai)}`;
    const range = projected ? `<div class="sub">Scenarios ${billions(aiAt(hoverT, "low"))} to ${billions(aiAt(hoverT, "high"))}</div>` : "";
    g.tooltip.innerHTML = `
      <div class="when">${monthName(hoverT)}${projected ? " · projection" : ""}</div>
      <div class="row"><i class="ai"></i><span>OpenAI + Anthropic</span><b>${aiText}</b>${range}</div>
      <div class="row"><i class="aid"></i><span>Foreign aid, ${year}</span><b>${billions(total.value)}</b>${total.projected ? '<div class="sub">Projected</div>' : ""}</div>`;
    // Above the higher of the two points, flipped to the left near the right edge.
    const left = px > g.w * 0.6;
    g.tooltip.style.left = px + (left ? -14 : 14) + "px";
    g.tooltip.style.top = Math.max(96, y(ai === null ? aid : Math.max(ai, aid)) - 12) + "px";
    g.tooltip.classList.toggle("left", left);
  }

  function hideHover() {
    hoverT = null;
    root.classList.remove("hovering");
  }

  plot.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const d = new Date(hoverT ?? PROJ);
    showAt(monthEnd(d.getUTCFullYear(), d.getUTCMonth() + (e.key === "ArrowRight" ? 1 : -1)));
  });
  plot.addEventListener("blur", hideHover);

  // ---- Data table for screen readers ------------------------------------------------

  const table = root.querySelector(".cc-table");
  if (table) {
    const aidFor = (d) => AID.find((a) => a.year === Number(d.slice(0, 4)));
    table.innerHTML = `
      <caption>OpenAI and Anthropic annualized revenue and all foreign aid, billions of US dollars</caption>
      <thead><tr><th scope="col">Period</th><th scope="col">OpenAI + Anthropic, annualized</th><th scope="col">Foreign aid that year</th></tr></thead>
      <tbody>${AI.map(([d, v]) => `<tr><th scope="row">${quarter(T(d))}</th><td>${billions(v)}</td><td>${billions(aidFor(d).value)}</td></tr>`).join("")}
        <tr><th scope="row">Q3 2027, projected</th><td>${billions(SCENARIOS.low)} to ${billions(SCENARIOS.high)}, central ${billions(SCENARIOS.central)}</td><td>${billions(AID[AID.length - 1].value)}</td></tr>
      </tbody>`;
  }

  // ---- Start ----------------------------------------------------------------------------

  let width = 0;
  new ResizeObserver(() => {
    if (plot.clientWidth === width) return;
    width = plot.clientWidth;
    draw();
  }).observe(plot);

  // The chart draws each time it comes back into view: it resets once it has
  // left the screen entirely, and plays when most of it is visible again.
  if (!M.reduce && "IntersectionObserver" in window) {
    let armed = true;
    let startTimer;
    new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.intersectionRatio >= 0.45 && armed) {
          armed = false;
          clearTimeout(startTimer);
          // Let the card finish rising before the lines start.
          startTimer = setTimeout(play, 300);
        } else if (!e.isIntersecting) {
          armed = true;
          clearTimeout(startTimer);
          reset();
        }
      }
    }, { threshold: [0, 0.45] }).observe(plot);
  } else {
    progress = 1;
  }
})();
