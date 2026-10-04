import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assets from '../roundups/worker/assets.generated.js';
import worker from '../roundups/worker/index.js';
assert.equal(typeof worker.fetch, 'function');
assert.ok(assets['/index.html'] && assets['/extension.zip']);
assert.ok(!Object.keys(assets).some(path => path.includes('proof') || path.includes('artifacts') || path.includes('.env')));
const manifest = JSON.parse(readFileSync('roundups/extension/manifest.json'));
assert.deepEqual(manifest.content_scripts[0].matches, ['https://openrouter.ai/*']);
assert.deepEqual(manifest.permissions, ['storage']);
if (process.env.PLEDGE_REQUIRE_UNCHANGED_WEB === '1') {
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main', '--', 'web/'], { encoding: 'utf8' });
  assert.equal(changed.trim(), '', 'Nathan’s frontend must remain unchanged in this integration.');
}
console.log('Validated mount assets and extension permissions.');
