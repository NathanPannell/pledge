import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the extension carries the same piggy bank as the website', () => {
  assert.equal(read('../extension/piggy.js'), read('../../web/assets/piggy.js'),
    'Copy web/assets/piggy.js to roundups/extension/piggy.js after changing it.');
});

test('the piggy bank loads before the popup and the OpenRouter panel use it', () => {
  const scripts = JSON.parse(read('../extension/manifest.json')).content_scripts[0].js;
  assert.ok(scripts.indexOf('piggy.js') > -1 && scripts.indexOf('piggy.js') < scripts.indexOf('content.js'));
  const popup = read('../extension/popup.html');
  assert.ok(popup.indexOf('piggy.js') > -1 && popup.indexOf('piggy.js') < popup.indexOf('popup.js'));
});

test('the piggy bank sets no style attributes, which /roundups/ blocks', () => {
  assert.doesNotMatch(read('../../web/assets/piggy.js'), /style=|setAttribute\(\s*["']style/);
});
