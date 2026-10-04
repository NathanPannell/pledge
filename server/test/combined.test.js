import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import { createRoundups } from '../src/roundups.js';
import { readConfig, WEB_ROOT } from '../src/config.js';
import { openDb } from '../src/db.js';
import { loadOrCreateKey } from '../src/secrets.js';
import { createService } from '../src/service.js';
import { createPlaid } from '../src/plaid.js';
import { createStripe } from '../src/stripe.js';

test('one listener preserves company UI and independently persists roundups through reset and restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pledge-combined-'));
  let app, roundups, companyDb, origin, cookie, device;
  async function start() {
    const config = readConfig({ DATA_DIR: join(dir, 'company'), ROUNDUPS_DB: join(dir, 'roundups.sqlite'), COMMUNITY_SAMPLE: 'off' });
    companyDb = openDb(config.dataDir);
    const service = createService({ db: companyDb, key: loadOrCreateKey(config.dataDir), plaid: createPlaid(config.plaid), stripe: createStripe(config.stripe), config });
    roundups = createRoundups(config, { TEST_FX: '1.4246' });
    app = createApp({ service, webRoot: WEB_ROOT, roundups });
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${app.address().port}`;
  }
  async function stop() {
    await new Promise(resolve => { app.close(resolve); app.closeIdleConnections(); });
    roundups.close(); companyDb.close();
  }
  async function api(path, data, bearer = false) {
    const response = await fetch(origin + path, {
      method: data ? 'POST' : 'GET',
      headers: { Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}), ...(bearer ? { Authorization: `Bearer ${device}` } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    const result = await response.json();
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, body: result };
  }
  try {
    await start();
    assert.equal(await fetch(origin + '/').then(r => r.text()), readFileSync(join(WEB_ROOT, 'index.html'), 'utf8'));
    assert.equal(await fetch(origin + '/app.html').then(r => r.text()), readFileSync(join(WEB_ROOT, 'app.html'), 'utf8'));
    assert.equal((await api('/api/state')).body.org, null);
    assert.equal((await api('/roundups/api/state')).body.pending_cents, 0);
    assert.equal((await api('/api/org', { name: 'Isolated Company' })).body.org.name, 'Isolated Company');
    assert.equal((await api('/api/state')).body.org.name, 'Isolated Company'); // spare_session cookie cannot hijack company routing.
    const quote = (await api('/roundups/api/quote', { provider: 'OpenRouter', cad_total: '29.99', purchase_key: 'combined-purchase' })).body;
    assert.equal(quote.gift_cents, 101);
    assert.equal((await api('/roundups/api/pledge', { quote_id: quote.id })).body.pending_cents, 101);
    assert.equal((await api('/roundups/api/pledge', { quote_id: quote.id })).body.created, false);
    const code = (await api('/roundups/api/pair/code', {})).body.code;
    device = (await api('/roundups/api/pair/redeem', { code })).body.token;
    assert.equal((await api('/api/state', null, true)).body.pending_cents, 101); // installed 0.1.0 extension compatibility.
    assert.equal((await api('/api/pledge', { quote_id: quote.id }, true)).body.created, false);
    await api('/api/reset', {});
    assert.equal((await api('/api/state')).body.org, null);
    assert.equal((await api('/roundups/api/state')).body.pending_cents, 101);
    for (const path of ['/artifacts/spare-cad/public/index.html', '/roundups/proof/index.html', '/roundups/../.env', '/roundups/.env']) {
      assert.equal((await fetch(origin + path)).status, 404);
    }
    const legacy = await fetch(origin + '/?checkout=old-id', { redirect: 'manual' });
    assert.equal(legacy.status, 302); assert.equal(legacy.headers.get('location'), '/roundups/?checkout=old-id');
    assert.equal((await fetch(origin + '/roundups/extension.zip')).status, 200);
    const forbidden = await fetch(origin + '/roundups/api/pledge', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://wrong.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_id: quote.id }) });
    assert.equal(forbidden.status, 403);
    await stop(); await start();
    assert.equal((await api('/roundups/api/state', null, true)).body.pending_cents, 101);
    assert.equal((await api('/api/state')).body.org, null);
  } finally { if (app?.listening) await stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('Stripe aliases accept shared sandbox keys and reject live credentials', () => {
  const config = readConfig({ STRIPE_SECRET_KEY: 'sk_test_shared' });
  assert.equal(config.roundupKey, 'sk_test_shared');
  assert.equal(readConfig({ STRIPE_API_KEY: 'rk_test_shared' }).stripe.secretKey, 'rk_test_shared');
  const local = readConfig({ STRIPE_API_KEY: 'rk_test_shared', COMPANY_STRIPE_MODE: 'local' });
  assert.equal(local.stripe.secretKey, ''); assert.equal(local.roundupKey, 'rk_test_shared');
  assert.throws(() => readConfig({ STRIPE_SECRET_KEY: 'sk_live_forbidden' }), /sandbox/);
});
