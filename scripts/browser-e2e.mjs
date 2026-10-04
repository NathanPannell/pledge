import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const origin = process.env.PLEDGE_E2E_ORIGIN || 'http://localhost:5173';
const full = process.env.PLEDGE_E2E_ALLOW_COMPANY_RESET === '1';
if (full && !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Company mutation E2E only runs against isolated localhost data.');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...(process.env.PLEDGE_E2E_EDGE_IP ? [`--host-resolver-rules=MAP ${new URL(origin).hostname} ${process.env.PLEDGE_E2E_EDGE_IP}`] : [])] });
const report = { origin, company_mutations: full, checks: [] };
mkdirSync('test-results', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const landing = await context.newPage(); await landing.goto(origin);
  // Start giving opens into the company flow and Pledge for Chrome.
  await landing.locator('.hero .cta-btn').click();
  const enterprise = landing.locator('.hero').getByRole('menuitem', { name: /For enterprise/ });
  assert.equal(await enterprise.getAttribute('href'), 'app.html');
  await landing.locator('.hero').getByRole('menuitem', { name: /For individuals/ }).click();
  await landing.locator('#individuals').getByRole('heading', { name: /Round up your AI credits/ }).waitFor();
  assert.equal(await landing.locator('#individuals a[href="/roundups/extension.zip"]').count() > 0, true);
  await landing.locator('#individuals').getByRole('button', { name: 'Get a connection code', exact: true }).click();
  await landing.locator('#individuals #pair-code').waitFor({ state: 'visible' });
  assert.match(await landing.locator('#individuals #pair-code').textContent(), /^[a-f0-9]{64}$/);
  await landing.locator('#individuals .ind-close').click();
  report.checks.push('Landing CTA opens enterprise and individual paths; the Chrome screen issues a connection code');
  const page = await context.newPage(); await page.goto(origin + '/app.html');
  if (full) {
    await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
    await page.reload();
    await page.locator('#csv-file').setInputFiles('samples/harbourline-card-statement.csv');
    await page.locator('#step-choose').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#first-month').textContent === '$115.20');
    await page.locator('#first-name').fill('Integration Studio');
    await page.locator('#first-email').fill('integration@example.com');
    await page.locator('#give-first').click();
    await page.locator('#thanks').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#t-done').click();
    await page.locator('#home').waitFor({ state: 'visible' });
    const state = await page.evaluate(() => fetch('/api/state').then(r => r.json()));
    assert.equal(state.invoices[0].amount_cents, 11520);
    const id = state.invoices[0].id;
    const ledger = await landing.evaluate(() => fetch('/api/ledger').then(r => r.json()));
    assert.equal(ledger.entries[0].company, 'Integration Studio');
    report.checks.push('CSV upload, original share dial, Give, thank-you, company home, and landing ledger agree on $115.20');
    const invoice = await context.newPage(); await invoice.goto(origin + '/invoice.html?id=' + id);
    await invoice.waitForFunction(() => document.querySelector('#i-total').textContent === '$115.20');
    await invoice.close();
    await page.locator(`[data-paid="${id}"]`).click();
    await page.waitForFunction(() => document.querySelector('#gifts').textContent.includes('Received'));
    const receipt = await context.newPage(); await receipt.goto(origin + '/receipt.html?id=' + id);
    await receipt.getByText(/sample/i).first().waitFor();
    report.checks.push('Original invoice document, manual Mark received, and sample receipt remain functional');
    await receipt.close();
  } else {
    await page.waitForFunction(() => document.querySelector('#step-find')?.hidden === false || document.querySelector('#home')?.hidden === false);
    report.checks.push('Hosted company frontend and API respond without mutating shared company data');
  }
  await page.screenshot({ path: 'test-results/company-desktop.png', fullPage: true });
  const setup = await context.newPage(); await setup.goto(origin + '/roundups/');
  await setup.getByRole('button', { name: 'Get a connection code', exact: true }).click();
  await setup.locator('#pair-code').waitFor({ state: 'visible' });
  assert.match(await setup.locator('#pair-code').textContent(), /^[a-f0-9]{64}$/);
  report.checks.push('Direct extension installation and one-time pairing work on /roundups/');
  await setup.close();
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = await phoneContext.newPage(); await phone.goto(origin);
  await phone.getByRole('button', { name: /Start giving/ }).first().waitFor();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await phone.screenshot({ path: 'test-results/landing-phone.png', fullPage: true });
  await phone.goto(origin + '/roundups/'); await phone.locator('#pair').waitFor();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await phone.screenshot({ path: 'test-results/setup-phone.png', fullPage: true });
  report.checks.push('Landing and extension setup fit a 390px phone viewport');
  assert.deepEqual(errors, []); report.checks.push('No first-party JavaScript page errors');
  await phoneContext.close(); await context.close();
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await browser.close(); writeFileSync('test-results/browser-e2e.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
