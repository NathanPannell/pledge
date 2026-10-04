// /roundups/: install and connect Pledge for Chrome, show pending round-ups,
// and confirm payments returning from Stripe. Install steps and connection
// codes come from /assets/extension.js; motion from /assets/motion.js.
const $ = (selector) => document.querySelector(selector);
const M = window.Motion;
const money = (cents) => `C$${(cents / 100).toFixed(2)}`;
const GOAL = 500; // round-ups are given once they reach C$5
let checkoutId;
let shown = null; // the balance on screen, so changes roll from it

async function api(path, data) {
  const response = await fetch('/roundups/api' + path, {
    method: data ? 'POST' : 'GET',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Please try again.');
  return result;
}

async function run(button, work) {
  $('#error').hidden = true;
  if (button) button.disabled = true;
  try { await work(); }
  catch (error) { $('#error').textContent = error.message; $('#error').hidden = false; }
  finally { if (button) button.disabled = false; }
}

// The pending total rolls to its new value and the bar fills toward C$5.
function balance(state) {
  const cents = state.pending_cents;
  if (shown === null) M.tween($('#balance'), 0, cents, 1200, money);
  else M.to($('#balance'), cents, 900, money);
  shown = cents;
  const bar = $('#balance-bar');
  requestAnimationFrame(() => bar.style.setProperty('--p', String(Math.min(1, cents / GOAL))));
  bar.classList.toggle('full', cents >= GOAL);
  $('#balance-note').textContent = cents >= GOAL
    ? 'Ready to give. Continue to Stripe to confirm one payment.'
    : `${money(GOAL - cents)} to go. Nothing is charged until you confirm.`;
  $('#pay').hidden = cents < GOAL;
}

function payment(result) {
  balance(result);
  const box = $('#payment');
  box.hidden = false;
  $('#check').hidden = result.status !== 'open' && result.status !== 'creating';
  box.classList.remove('checking', 'paid', 'expired');
  if (result.status === 'paid') {
    box.classList.add('paid');
    $('#payment-title').textContent = 'A little extra. A little good.';
    $('#payment-description').textContent = `Your ${money(result.amount_cents)} test payment is confirmed. Only those paid round-ups were cleared. No real donation was made.`;
    history.replaceState(null, '', '/roundups/');
    const icon = box.querySelector('.su-pay-ic');
    setTimeout(() => M.burst(box, icon.offsetLeft + icon.offsetWidth / 2, icon.offsetTop + icon.offsetHeight / 2, 18), 350);
  } else if (result.status === 'expired') {
    box.classList.add('expired');
    $('#payment-title').textContent = 'Your round-ups are still saved.';
    $('#payment-description').textContent = 'Nothing charged. You can continue to Stripe whenever you’re ready.';
    history.replaceState(null, '', '/roundups/');
  } else {
    box.classList.add('checking');
  }
}

window.PledgeExtension.mountInstall($('#steps'));

$('#pay').onclick = (event) => run(event.currentTarget, async () => {
  const result = await api('/checkout', {});
  if (result.url) location.assign(result.url);
  else payment({ ...await api('/state'), status: 'paid', amount_cents: result.amount_cents });
});
$('#check').onclick = (event) => run(event.currentTarget, async () => payment(await api('/checkout/status?id=' + encodeURIComponent(checkoutId))));

run($('#pay'), async () => {
  balance(await api('/state'));
  const params = new URL(location.href).searchParams;
  checkoutId = params.get('checkout') || params.get('cancel');
  if (checkoutId) {
    $('#payment').hidden = false;
    payment(params.has('cancel') ? await api('/checkout/cancel', { id: checkoutId }) : await api('/checkout/status?id=' + encodeURIComponent(checkoutId)));
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) run(null, async () => balance(await api('/state')));
});
