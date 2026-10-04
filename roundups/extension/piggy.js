// Pledge's piggy bank: coins drop in whenever money is added to your
// round-ups, and it fills toward C$5. Shared by the website and the extension;
// roundups/extension/piggy.js must stay an identical copy (a test checks).
// Styling uses SVG attributes and element.style only, so it works under
// /roundups/'s content security policy and inside the extension's shadow DOM.
(function (root) {
  let next = 0; // unique ids for each piggy's clip path and gradient

  const reduced = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const OUTLINE = "#0e7f72";
  const BODY = "#eaf6f3";
  const COIN_MS = 640; // one coin's fall
  const GAP_MS = 210; // between coins

  function markup(id) {
    return `<svg viewBox="0 0 100 84" overflow="visible" aria-hidden="true">
      <defs>
        <clipPath id="pg-clip-${id}"><ellipse cx="48" cy="50" rx="34" ry="25"/></clipPath>
        <linearGradient id="pg-grad-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fd6c4"/><stop offset="1" stop-color="#1fa392"/></linearGradient>
      </defs>
      <g data-coins></g>
      <g data-pig>
        <rect x="25" y="64" width="8.5" height="16" rx="3" fill="${BODY}" stroke="${OUTLINE}" stroke-width="2.2"/>
        <rect x="36" y="66" width="8.5" height="14" rx="3" fill="${BODY}" stroke="${OUTLINE}" stroke-width="2.2"/>
        <rect x="54" y="66" width="8.5" height="14" rx="3" fill="${BODY}" stroke="${OUTLINE}" stroke-width="2.2"/>
        <rect x="65" y="64" width="8.5" height="16" rx="3" fill="${BODY}" stroke="${OUTLINE}" stroke-width="2.2"/>
        <path d="M14.5 48c-6 0-8-6-4-8c3-1.5 4.5 2 1.2 3.2" fill="none" stroke="${OUTLINE}" stroke-width="2.2" stroke-linecap="round"/>
        <ellipse cx="48" cy="50" rx="34" ry="25" fill="${BODY}"/>
        <g clip-path="url(#pg-clip-${id})"><rect data-fill x="12" y="25" width="76" height="52" fill="url(#pg-grad-${id})" opacity="0.85"/></g>
        <ellipse cx="48" cy="50" rx="34" ry="25" fill="none" stroke="${OUTLINE}" stroke-width="2.4"/>
        <path d="M27 40q5-8 15-10" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
        <path d="M58.5 30Q60 19 66.5 17.5Q71.5 22 72.5 31.5" fill="${BODY}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>
        <ellipse cx="84" cy="52" rx="7" ry="9" fill="${BODY}" stroke="${OUTLINE}" stroke-width="2.2"/>
        <ellipse cx="82" cy="52" rx="1.2" ry="1.8" fill="${OUTLINE}"/>
        <ellipse cx="86.4" cy="52" rx="1.2" ry="1.8" fill="${OUTLINE}"/>
        <circle cx="70" cy="41" r="2.4" fill="#19486a"/>
        <rect x="40" y="23" width="16" height="4.6" rx="2.3" fill="#19486a"/>
      </g>
      <g data-spark opacity="0"><path d="M48 9l1.6 4.4 4.4 1.6-4.4 1.6L48 21l-1.6-4.4L42 15l4.4-1.6z" fill="#f2b84b"/></g>
    </svg>`;
  }

  function coin() {
    const ns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(ns, "g");
    g.innerHTML = '<circle r="8" fill="#f2b84b" stroke="#c98a1c" stroke-width="1.8"/><circle r="4.6" fill="none" stroke="#c98a1c" stroke-width="1.2" opacity="0.75"/><path d="M-4-3.2q2-2 4.4-2.2" fill="none" stroke="#fff6dc" stroke-width="1.4" stroke-linecap="round"/>';
    g.style.setProperty("transform-box", "fill-box");
    g.style.setProperty("transform-origin", "center");
    return g;
  }

  // A piggy bank `size` pixels wide. fill(f) sets how full it is (0 to 1);
  // add(f, n) drops n coins in and fills it to f.
  function create(size = 72) {
    const id = ++next;
    const el = document.createElement("span");
    el.className = "piggy";
    el.setAttribute("aria-hidden", "true");
    el.style.setProperty("display", "inline-block");
    el.style.setProperty("flex", "none");
    el.style.setProperty("width", size + "px");
    el.style.setProperty("height", Math.round(size * 0.84) + "px");
    el.innerHTML = markup(id);
    const svg = el.firstElementChild;
    svg.style.setProperty("display", "block");
    svg.style.setProperty("width", "100%");
    svg.style.setProperty("height", "100%");
    svg.style.setProperty("overflow", "visible");
    const coins = svg.querySelector("[data-coins]");
    const pig = svg.querySelector("[data-pig]");
    const level = svg.querySelector("[data-fill]");
    const spark = svg.querySelector("[data-spark]");
    for (const part of [pig, spark]) {
      part.style.setProperty("transform-box", "fill-box");
      part.style.setProperty("transform-origin", "50% 100%");
    }
    let current = 0;

    // The coloured fill rises inside the body as round-ups add up.
    function fill(f, ms = 900) {
      current = Math.max(0, Math.min(1, f));
      const still = reduced() || !ms;
      level.style.setProperty("transition", still ? "none" : `transform ${ms}ms cubic-bezier(.2,.8,.2,1)`);
      // Commit the old level first, so a piggy that was just put on the page
      // still rises from it.
      if (!still) void level.getBoundingClientRect();
      level.style.setProperty("transform", `translateY(${(1 - current) * 52}px)`);
      return api;
    }

    function bump() {
      if (reduced()) return;
      pig.animate([
        { transform: "scale(1, 1)" },
        { transform: "scale(1.06, 0.92)", offset: 0.35 },
        { transform: "scale(0.98, 1.04)", offset: 0.7 },
        { transform: "scale(1, 1)" },
      ], { duration: 420, easing: "ease-out" });
      spark.animate([
        { opacity: 0, transform: "scale(0.3) rotate(0deg)" },
        { opacity: 1, transform: "scale(1.15) rotate(25deg)", offset: 0.4 },
        { opacity: 0, transform: "scale(0.6) rotate(45deg)" },
      ], { duration: 520, easing: "ease-out" });
    }

    // Coins tumble in from above, one after another, and vanish into the slot.
    // onLand(i) runs as each one goes in.
    function drop(n = 3, onLand) {
      if (reduced() || n < 1) return Promise.resolve();
      return new Promise((resolve) => {
        let landed = 0;
        for (let i = 0; i < n; i++) {
          const c = coin();
          coins.appendChild(c);
          const dx = (i - (n - 1) / 2) * 13 + (i % 2 ? 4 : -4);
          const a = c.animate([
            { transform: `translate(${48 + dx}px, -26px) scaleX(1)`, opacity: 0 },
            { transform: `translate(${48 + dx * 0.4}px, -4px) scaleX(0.25)`, opacity: 1, offset: 0.45 },
            { transform: "translate(48px, 14px) scaleX(1)", opacity: 1, offset: 0.78 },
            { transform: "translate(48px, 34px) scaleX(0.7)", opacity: 1 },
          ], { duration: COIN_MS, delay: i * GAP_MS, easing: "cubic-bezier(.45,0,.7,1)", fill: "backwards" });
          let finished = false;
          const land = () => {
            if (finished) return;
            finished = true;
            c.remove();
            bump();
            onLand?.(i);
            if (++landed === n) resolve();
          };
          a.onfinish = land;
          // Animations pause in background tabs; the coins always land.
          setTimeout(land, COIN_MS + i * GAP_MS + 300);
        }
      });
    }

    // Money added: coins drop in and the fill rises to `to` (0 to 1) as they
    // land, with a wiggle if that fills it. Resolves when the first coin is
    // in, so a total can count up alongside the rest.
    function add(to, n = 3) {
      if (reduced() || n < 1) { fill(to); return Promise.resolve(); }
      return new Promise((first) => {
        drop(n, (i) => {
          if (i === 0) { fill(to, (n - 1) * GAP_MS + 700); first(); }
        }).then(() => { if (to >= 1) wiggle(); });
      });
    }

    // A happy wiggle once the piggy is full.
    function wiggle() {
      if (reduced()) return;
      pig.animate([
        { transform: "rotate(0deg)" },
        { transform: "rotate(-6deg)", offset: 0.25 },
        { transform: "rotate(5deg)", offset: 0.5 },
        { transform: "rotate(-3deg)", offset: 0.75 },
        { transform: "rotate(0deg)" },
      ], { duration: 700, easing: "ease-in-out" });
    }

    const api = { el, fill, drop, add, wiggle, get level() { return current; } };
    fill(0, 0);
    return api;
  }

  root.PledgePiggy = { create };
})(typeof window !== "undefined" ? window : globalThis);
