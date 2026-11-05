import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme } from '../webgui.js';

test('built-in themes resolve relative to the public entry point', () => {
  assert.equal(String(resolveTheme('default', 'https://example.test/lib/webgui.js')), 'https://example.test/lib/themes/default.css');
});

test('explicit URLs remain consumer-owned', () => {
  const value = new URL('https://example.test/site/theme.css');
  assert.equal(resolveTheme(value, 'https://example.test/lib/webgui.js'), value);
});
