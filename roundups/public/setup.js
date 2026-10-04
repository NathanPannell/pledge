const $ = selector => document.querySelector(selector);
const money = cents => `C$${(cents / 100).toFixed(2)}`;
let checkoutId;
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
function balance(state) {
  $('#balance').textContent = money(state.pending_cents);
  $('#pay').hidden = state.pending_cents < 500;
}
function payment(result) {
  balance(result);
  $('#payment').hidden = false;
  $('#check').hidden = result.status !== 'open' && result.status !== 'creating';
  if (result.status === 'paid') {
    $('#payment-title').textContent = 'A little extra. A little good.';
    $('#payment-description').textContent = `Your ${money(result.amount_cents)} test payment is confirmed. Only those paid round-ups were cleared. No real donation was made.`;
    history.replaceState(null, '', '/roundups/');
  } else if (result.status === 'expired') {
    $('#payment-title').textContent = 'Your round-ups are still saved.';
    $('#payment-description').textContent = 'Nothing charged. You can continue to Stripe whenever you’re ready.';
    history.replaceState(null, '', '/roundups/');
  }
}
$('#pair').onclick = event => run(event.currentTarget, async () => {
  const result = await api('/pair/code', {});
  $('#pair-code').textContent = result.code;
  $('#pair-code').hidden = false;
  $('#copy-code').hidden = false;
});
$('#copy-code').onclick = event => run(event.currentTarget, async () => {
  await navigator.clipboard.writeText($('#pair-code').textContent);
  $('#copy-code').textContent = 'Copied';
});
$('#pay').onclick = event => run(event.currentTarget, async () => {
  const result = await api('/checkout', {});
  if (result.url) location.assign(result.url);
  else payment({ ...await api('/state'), status: 'paid', amount_cents: result.amount_cents });
});
$('#check').onclick = event => run(event.currentTarget, async () => payment(await api('/checkout/status?id=' + encodeURIComponent(checkoutId))));
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
