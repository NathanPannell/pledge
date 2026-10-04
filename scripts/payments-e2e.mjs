import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const origin = process.env.PLEDGE_E2E_ORIGIN || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...(process.env.PLEDGE_E2E_EDGE_IP ? [`--host-resolver-rules=MAP ${new URL(origin).hostname} ${process.env.PLEDGE_E2E_EDGE_IP}`] : [])] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); const report = { origin, sandbox_only: true, checks: [] };
mkdirSync('test-results', { recursive: true });
async function api(path, data) {
  const response = await page.evaluate(async ({ path, data }) => {
    const result = await fetch('/roundups/api' + path, { method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
    return { status: result.status, data: await result.json() };
  }, { path, data });
  assert.equal(response.status, 200, response.data.error || 'Unexpected API status'); return response.data;
}
try {
  await page.goto(origin + '/roundups/'); await page.locator('#pair').waitFor();
  assert.equal((await api('/state')).pending_cents, 0);
  await api('/demo/near-threshold', { run_id: crypto.randomUUID() });
  const quote = await api('/quote', { provider: 'Demo', cad_total: '32.33', purchase_key: crypto.randomUUID() });
  const repeated = await Promise.all(Array.from({ length: 5 }, () => api('/pledge', { quote_id: quote.id })));
  assert.ok(repeated.every(result => result.pending_cents === 536));
  report.checks.push('Concurrent Yes saves one unfunded pledge and reaches CAD5.36');
  await page.reload(); await page.locator('#pay').waitFor({ state: 'visible' });
  await page.locator('#pay').click(); await page.waitForURL('https://checkout.stripe.com/**');
  await page.locator('#email').waitFor();
  // Return through the provider's cancellation URL with the same account cookie.
  const back = page.locator('a[href*="?cancel="]:visible');
  assert.equal(await back.count(), 1); await back.click();
  await page.getByText('Your round-ups are still saved.', { exact: true }).waitFor();
  await page.locator('#pay').waitFor({ state: 'visible' });
  const cancelled = await api('/state'); assert.equal(cancelled.pending_cents, 536); assert.equal(cancelled.active, null);
  report.checks.push('Stripe cancellation preserves all pending pledges and releases the reservation');
  await page.locator('#pay').click(); await page.waitForURL('https://checkout.stripe.com/**');
  await page.locator('#email').fill('pledge-roundups-e2e@example.com');
  await page.locator('#cardNumber').fill('4242424242424242'); await page.locator('#cardExpiry').fill('12/30'); await page.locator('#cardCvc').fill('123');
  if (await page.locator('#billingName:visible').count()) await page.locator('#billingName').fill('Pledge Sandbox QA');
  if (await page.locator('#billingCountry:visible').count()) await page.locator('#billingCountry').selectOption('CA');
  if (await page.locator('#billingPostalCode:visible').count()) await page.locator('#billingPostalCode').fill('V6B 1A1');
  await page.locator('button[type="submit"]:visible').click();
  await page.waitForURL(origin + '/roundups/**', { timeout: 60000 });
  await page.getByText('A little extra. A little good.', { exact: true }).waitFor({ timeout: 20000 });
  const paid = await api('/state'); assert.equal(paid.pending_cents, 0); assert.equal(paid.paid_cents, 536); assert.equal(paid.active, null);
  await page.reload(); assert.equal((await api('/state')).paid_cents, 536);
  report.checks.push('Stripe sandbox verifies CAD5.36 at the new return route; reload does not settle twice');
  report.payment = { currency: 'CAD', amount_cents: 536, pending_after: 0, verified: true };
  await page.screenshot({ path: 'test-results/roundups-paid-phone.png', fullPage: true });
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await browser.close(); writeFileSync('test-results/payments-e2e.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
