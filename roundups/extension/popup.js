// Pledge popup: connect this browser once, see pending round-ups, enter a CAD
// total by hand, and continue to Stripe at C$5. It only talks to background.js.
const main = document.querySelector('#content');
const error = document.querySelector('#error');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GOAL = 500; // round-ups are given once they reach C$5
const money = (c) => `C$${(c / 100).toFixed(2)}`;
const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

async function send(message) {
  const r = await chrome.runtime.sendMessage(message);
  if (!r?.ok) throw new Error(r?.error || 'Please try again.');
  return r.data;
}
const showError = (e) => { error.textContent = e.message; error.hidden = false; };
const clearError = () => { error.hidden = true; };

// Swaps in a view; each part rises in a beat after the last.
function view(html) {
  main.innerHTML = `<section class="view">${html}</section>`;
  const v = main.firstElementChild;
  [...v.children].forEach((el, i) => el.style.setProperty('--i', i));
  return v;
}

// Rolls a money figure from one value to another.
function tween(el, from, to, ms, delay = 0) {
  el.textContent = money(from);
  if (reduce || from === to) { el.textContent = money(to); return; }
  setTimeout(() => {
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      el.textContent = money(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = money(to); }, ms + 150);
  }, delay);
}

function fill(bar, from, to) {
  bar.style.setProperty('--p', String(Math.min(1, from / GOAL)));
  requestAnimationFrame(() => requestAnimationFrame(() => bar.style.setProperty('--p', String(Math.min(1, to / GOAL)))));
  bar.classList.toggle('full', to >= GOAL);
}

// Hearts and dots thrown out from an element when a round-up is saved.
function burst(from) {
  if (reduce) return;
  const box = from.getBoundingClientRect();
  const colors = ['#0e7f72', '#1fa392', '#5fd6c4', '#19486a', '#e3a43a'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('span');
    const heart = i % 3 === 0;
    const size = heart ? 12 + Math.random() * 6 : 5 + Math.random() * 4;
    p.className = 'particle';
    p.style.left = box.left + box.width / 2 + 'px';
    p.style.top = box.top + box.height / 2 + 'px';
    p.style.width = p.style.height = size + 'px';
    p.style.color = colors[i % colors.length];
    if (heart) p.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
    else p.style.background = 'currentColor';
    document.body.append(p);
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.5;
    const d = 40 + Math.random() * 50;
    p.animate([
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 0.7}px), calc(-50% + ${Math.sin(a) * d * 0.7 - 20}px)) scale(1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 30}px)) scale(0.8)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(.15,.7,.35,1)' }).onfinish = () => p.remove();
  }
}

// ---- Connected: pending round-ups, manual total, Stripe at C$5 ------------------

async function connected() {
  const s = await send({ action: 'state' });
  const ready = s.pending_cents >= GOAL;
  const v = view(`
    <span class="eyebrow">Your round-ups</span>
    <div class="big" id="pending">C$0.00</div>
    <div class="bar"><i></i></div>
    <p class="note">${ready ? '<strong>Ready to give.</strong> Confirm one payment in Stripe.' : `${money(GOAL - s.pending_cents)} to go. Nothing charged yet.`}</p>
    ${ready ? '<button id="pay" class="primary breathe">Continue to Stripe</button>' : ''}
    <details>
      <summary>Enter a CAD total</summary>
      <form id="manual">
        <p class="hint">Use this when the checkout&rsquo;s final amount isn&rsquo;t readable.</p>
        <div><label for="cad">Final CAD total</label><input id="cad" inputmode="decimal" placeholder="32.33" required></div>
        <button class="secondary">Find my round-up</button>
      </form>
    </details>
    <div class="row"><button id="open" class="ghost">Open Pledge</button><button id="disconnect" class="ghost">Disconnect</button></div>
    <p class="foot">Works at OpenRouter credit checkout.<br>Sandbox prototype · no real donations.</p>`);
  tween(v.querySelector('#pending'), 0, s.pending_cents, 900, 150);
  fill(v.querySelector('.bar'), 0, s.pending_cents);
  v.querySelector('#open').onclick = () => send({ action: 'open' }).catch(showError);
  v.querySelector('#disconnect').onclick = async () => {
    try { await send({ action: 'disconnect' }); setup(); } catch (e) { showError(e); }
  };
  const pay = v.querySelector('#pay');
  if (pay) pay.onclick = async () => {
    pay.disabled = true;
    clearError();
    try { await send({ action: 'checkout' }); } catch (e) { showError(e); } finally { pay.disabled = false; }
  };
  v.querySelector('#manual').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.target.querySelector('button');
    b.disabled = true;
    clearError();
    try {
      offer(await send({ action: 'quote', newPurchase: true, purchase: { provider: 'Demo', cad_total: v.querySelector('#cad').value } }));
    } catch (err) {
      showError(err);
    } finally {
      b.disabled = false;
    }
  };
}

// ---- A round-up offer for a total entered by hand ----------------------------------

function offer(q) {
  if (!q.gift_cents) {
    const v = view('<h1>Already a whole number.</h1><p>No round-up needed this time.</p><button id="done" class="secondary">Done</button>');
    v.querySelector('#done').onclick = () => connected().catch(showError);
    return;
  }
  const v = view(`
    <span class="eyebrow">Round up for VGH Foundation</span>
    <div class="amounts"><span class="was">${money(q.cad_cents)}</span><span class="now">${money(q.cad_cents)}</span><span class="chip">+${money(q.gift_cents)}</span></div>
    <p>Make it ${money(q.total_cents)}? Add <strong>${money(q.gift_cents)}</strong> to your pending round-ups. Nothing is charged now.</p>
    <button id="yes" class="primary">Yes, add ${money(q.gift_cents)}</button>
    <button id="no" class="ghost">No thanks</button>
    <p class="foot">Sandbox only.</p>`);
  tween(v.querySelector('.now'), q.cad_cents, q.total_cents, 800, 250);
  v.querySelector('#no').onclick = () => connected().catch(showError);
  const yes = v.querySelector('#yes');
  yes.onclick = async () => {
    yes.disabled = true;
    clearError();
    try {
      const r = await send({ action: 'pledge', quoteId: q.id });
      await saved(q.gift_cents, r.pending_cents);
      await connected();
    } catch (e) {
      showError(e);
      yes.disabled = false;
    }
  };
}

// A moment to see the round-up land before the totals come back.
async function saved(gift, pending) {
  const v = view(`
    <span class="check"><svg viewBox="0 0 24 24"><path pathLength="1" d="M6 12.5l4 4L18 8"/></svg></span>
    <h1>A little good, saved.</h1>
    <p><strong>+${money(gift)}</strong> added. Nothing taken yet.</p>
    <div class="bar"><i></i></div>`);
  fill(v.querySelector('.bar'), pending - gift, pending);
  setTimeout(() => burst(v.querySelector('.check')), 250);
  await wait(1700);
}

// ---- Connect this browser once -------------------------------------------------------

function setup() {
  const v = view(`
    <h1>Connect once.</h1>
    <p>Pledge offers a small round-up for charity when you buy OpenRouter credits.</p>
    <ol class="steps">
      <li><b>1</b><span>Get a one-time code from Pledge. <button id="open" class="link" type="button">Open Pledge</button></span></li>
      <li><b>2</b><span>Paste it here and connect.</span></li>
    </ol>
    <form><div><label for="code">Connection code</label><input id="code" autocomplete="off" spellcheck="false" required></div><button class="primary">Connect Pledge</button></form>
    <p class="foot">No bank connection. No card details.<br>Sandbox only.</p>`);
  v.querySelectorAll('.steps b').forEach((b, i) => b.style.setProperty('--n', i));
  v.querySelector('#open').onclick = () => send({ action: 'open' }).catch(showError);
  v.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.target.querySelector('button');
    b.disabled = true;
    clearError();
    try {
      await send({ action: 'connect', code: v.querySelector('#code').value.trim() });
      await connected();
    } catch (err) {
      showError(err);
    } finally {
      b.disabled = false;
    }
  };
}

(async () => {
  const s = await chrome.storage.local.get('spareToken');
  if (!s.spareToken) setup();
  else try { await connected(); } catch (e) { showError(e); setup(); }
})();
