// Pledge for Chrome: the install steps, one-time connection codes and the
// round-up demo, shared by the landing page and /roundups/. Builds markup
// without style attributes, because /roundups/ is served with a strict
// content security policy; motion values are set through element.style.
(function () {
  const M = window.Motion;
  const ZIP_URL = "/roundups/extension.zip";
  const CREDITS_URL = "https://openrouter.ai/settings/credits";
  const MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#19486a"/><path d="M10 7.5v17" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="13.5" r="6" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M20.6 9.64A6 6 0 0 1 20.6 17.36" fill="none" stroke="#5fd6c4" stroke-width="2.8" stroke-linecap="round"/></svg>';
  const cad = (cents) => "C$" + (cents / 100).toFixed(2);

  // ---- Install steps ------------------------------------------------------------

  const PICS = {
    download: '<svg viewBox="0 0 24 24"><path class="xt-arrow" d="M12 4v10M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17"/></svg>',
    toggle: '<svg viewBox="0 0 24 24"><rect class="xt-toggle-track" x="2" y="7" width="20" height="10" rx="5"/><circle class="xt-toggle-knob" cx="7" cy="12" r="3.2"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><path class="xt-folder-up" d="M12 16.5v-5M9.8 13.5l2.2-2.2 2.2 2.2"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path class="xt-link-a" d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>',
    coin: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18"/><circle class="xt-coin" cx="16.5" cy="5" r="2.5"/></svg>',
  };

  const STEPS = [
    {
      pic: "download",
      title: "Download the extension",
      text: "A small .zip with everything inside. Unzip it anywhere you like.",
      actions: `<a class="btn btn-primary" href="${ZIP_URL}" download>Download Pledge for Chrome</a><span class="xt-meta">Desktop Chrome</span>`,
    },
    {
      pic: "toggle",
      title: "Turn on Developer mode",
      text: "Open <code>chrome://extensions</code> in a new tab, then switch on Developer mode in the top right.",
      actions: '<button class="btn btn-secondary btn-sm" type="button" data-copy="chrome://extensions">Copy chrome://extensions</button>',
    },
    {
      pic: "folder",
      title: "Load it into Chrome",
      text: "Choose <b>Load unpacked</b> and select the unzipped folder. Pin Pledge from the puzzle-piece menu so it's one click away.",
    },
    {
      pic: "link",
      title: "Connect once",
      text: "Get a one-time code, then paste it into the Pledge popup. Codes last five minutes.",
      pair: true,
    },
    {
      pic: "coin",
      title: "Top up credits as usual",
      text: "On OpenRouter's Credits page, choose Add Credits. Pledge offers to round your total up to the next dollar.",
      actions: `<a class="btn btn-secondary btn-sm" href="${CREDITS_URL}" target="_blank" rel="noopener">Open OpenRouter credits</a>`,
    },
  ];

  function mountInstall(root) {
    root.innerHTML = `<ol class="xt-steps" data-reveal-group>${STEPS.map((s, i) => `
      <li class="xt-step">
        <span class="xt-num" aria-hidden="true">${i + 1}</span>
        <div class="xt-body">
          <h4>${s.title}</h4>
          <p>${s.text}</p>
          ${s.actions ? `<div class="xt-actions">${s.actions}</div>` : ""}
          ${s.pair ? `<div class="xt-pair">
            <div><button id="pair" class="btn btn-flow" type="button">Get a connection code</button></div>
            <div class="xt-code-wrap" hidden>
              <output id="pair-code" class="xt-code"></output>
              <div class="xt-code-row">
                <button id="copy-code" class="btn btn-secondary btn-sm" type="button">Copy code</button>
                <span class="xt-timer" aria-live="off"><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="bg" cx="12" cy="12" r="9" pathLength="1"/><circle class="fg" cx="12" cy="12" r="9" pathLength="1"/></svg><span class="xt-left">5:00</span>&nbsp;left</span>
              </div>
            </div>
            <p class="xt-error" role="alert" hidden></p>
          </div>` : ""}
        </div>
        <span class="xt-pic" aria-hidden="true">${PICS[s.pic]}</span>
      </li>`).join("")}</ol>`;

    root.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b, b.dataset.copy)));
    wirePairing(root);
    if (M) M.reveal(root);
    return root;
  }

  async function copy(button, text) {
    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select and copy it";
    }
    M?.pop(button, "xt-copied");
    setTimeout(() => { button.textContent = label; }, 1800);
  }

  // A connection code is issued to this browser's Pledge session; the popup
  // trades it for a device token. GET /state first creates the session.
  async function newCode() {
    const state = await fetch("/roundups/api/state", { credentials: "same-origin" });
    if (!state.ok) throw new Error("Pledge for Chrome isn't available right now. Try again in a moment.");
    const res = await fetch("/roundups/api/pair/code", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't get a code. Try again.");
    return data;
  }

  function wirePairing(root) {
    const button = root.querySelector("#pair");
    if (!button) return;
    const wrap = root.querySelector(".xt-code-wrap");
    const out = root.querySelector("#pair-code");
    const left = root.querySelector(".xt-left");
    const ring = root.querySelector(".xt-timer .fg");
    const error = root.querySelector(".xt-error");
    let ticker;

    button.addEventListener("click", async () => {
      error.hidden = true;
      button.disabled = true;
      try {
        const { code, expires_in: ttl = 300 } = await newCode();
        out.textContent = code;
        wrap.hidden = false;
        M?.pop(out, "fresh");
        root.querySelector(".xt-step:nth-child(4)")?.classList.add("done");
        // The ring empties over the code's lifetime.
        ring.style.setProperty("--ttl", ttl + "s");
        ring.style.animation = "none";
        void ring.getBoundingClientRect();
        ring.style.animation = "";
        const ends = Date.now() + ttl * 1000;
        clearInterval(ticker);
        const tick = () => {
          const s = Math.max(0, Math.round((ends - Date.now()) / 1000));
          left.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
          if (s === 0) {
            clearInterval(ticker);
            wrap.hidden = true;
            error.textContent = "That code expired. Get a new one when you're ready to paste it.";
            error.hidden = false;
          }
        };
        tick();
        ticker = setInterval(tick, 1000);
      } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
      } finally {
        button.disabled = false;
      }
    });
    root.querySelector("#copy-code").addEventListener("click", (e) => copy(e.currentTarget, out.textContent));
  }

  // ---- Round-up demo -------------------------------------------------------------
  // A credits checkout for US$22.40. At 1.4246 CAD per USD plus a 2.5% card fee
  // that's about C$32.71; Pledge offers C$33.00, a C$0.29 round-up, which takes
  // pending round-ups from C$4.71 to C$5.00, ready to give.

  const DEMO = { usd: "US$22.40", was: 3271, now: 3300, gift: 29, before: 471, goal: 500 };

  function mountDemo(root) {
    root.classList.add("xt-demo");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="xt-checkout">
        <h5>Add credits</h5>
        <div class="xt-line"><span>Credits</span><span>US$20.00</span></div>
        <div class="xt-line"><span>Service fee</span><span>US$2.40</span></div>
        <div class="xt-line total"><span>Total due</span><span>${DEMO.usd}</span></div>
        <div class="xt-buy"></div>
      </div>
      <div class="xt-panel">
        <div class="xt-top"><span class="brand">${MARK}Pledge</span><span class="xt-x">&times;</span></div>
        <div class="xt-state xt-offer">
          <span class="xt-eyebrow">Round up for VGH Foundation</span>
          <div class="xt-amounts"><span class="xt-was">${cad(DEMO.was)}</span><span class="xt-now">${cad(DEMO.now)}</span><span class="xt-chip">+${cad(DEMO.gift)}</span></div>
          <p class="xt-note">Nothing is charged now. You give once your round-ups reach C$5.</p>
          <div class="xt-yes">Yes, add ${cad(DEMO.gift)}</div>
          <div class="xt-no">No thanks</div>
        </div>
        <div class="xt-state xt-saved">
          <span class="xt-check"><svg viewBox="0 0 24 24"><path pathLength="1" d="M6 12.5l4 4L18 8"/></svg></span>
          <h5>Saved. Ready to give.</h5>
          <div class="xt-jar">
            <div class="xt-jar-row"><span>Round-ups</span><span><b class="xt-pending">${cad(DEMO.before)}</b> of ${cad(DEMO.goal)}</span></div>
            <div class="xt-bar"><i></i></div>
          </div>
        </div>
      </div>`;

    const now = root.querySelector(".xt-now");
    const pending = root.querySelector(".xt-pending");
    const bar = root.querySelector(".xt-bar");
    const fill = (cents) => bar.style.setProperty("--p", String(cents / DEMO.goal));
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    let running = false;

    function frame(state) {
      root.classList.remove("offer", "press", "saved", "leave");
      if (state) root.classList.add(...state.split(" "));
    }

    function loop() {
      timers.splice(0).forEach(clearTimeout);
      bar.classList.remove("full");
      fill(DEMO.before);
      M.set(pending, DEMO.before, cad);
      M.set(now, DEMO.was, cad);
      frame("");
      at(900, () => {
        frame("offer");
        M.tween(now, DEMO.was, DEMO.now, 900, cad);
      });
      at(3300, () => frame("offer press"));
      at(3800, () => {
        frame("saved");
        requestAnimationFrame(() => fill(DEMO.before + DEMO.gift));
        M.tween(pending, DEMO.before, DEMO.before + DEMO.gift, 1000, cad);
        at(1100, () => {
          bar.classList.add("full");
          const panel = root.querySelector(".xt-panel");
          M.burst(panel, panel.clientWidth - 40, 30, 14);
        });
      });
      at(7600, () => frame("saved leave"));
      at(8400, () => { if (running) loop(); });
    }

    // With reduced motion, show the offer as a still picture.
    if (!M || M.reduce) {
      frame("offer");
      M?.set(now, DEMO.now, cad);
      return { play() {}, stop() {} };
    }
    return {
      play() {
        if (running) return;
        running = true;
        loop();
      },
      stop() {
        running = false;
        timers.splice(0).forEach(clearTimeout);
        frame("");
      },
    };
  }

  window.PledgeExtension = { mountInstall, mountDemo, ZIP_URL, CREDITS_URL, MARK };
})();
