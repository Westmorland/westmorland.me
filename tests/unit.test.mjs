import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPage } from '../src/routing.js';
import './content.test.mjs';

for (const [pathname, expected] of [['/', 'home'], ['/cv/', 'cv'], ['/cv', 'cv'], ['/cv/extra', 'home'], ['/privacy/', 'privacy'], ['/terms/', 'terms'], ['/privacy', 'privacy'], ['/terms', 'terms'], ['/missing/', 'home'], ['/privacy/extra', 'home']]) {
  test(`path ${pathname} resolves to ${expected}`, () => {
    assert.equal(readPage({ pathname, hash: '' }), expected);
  });
}
for (const page of ['home', 'privacy', 'terms']) {
  test(`legacy hash overrides path: ${page}`, () => {
    assert.equal(readPage({ pathname: '/terms/', hash: `#/${page}` }), page);
  });
}
test('unknown legacy route falls back to Home', () => {
  assert.equal(readPage({ pathname: '/privacy/', hash: '#/nonsense' }), 'home');
});
test('document fragments preserve the current policy', () => {
  assert.equal(readPage({ pathname: '/privacy/', hash: '#main' }), 'privacy');
  assert.equal(readPage({ pathname: '/privacy/', hash: '#p-google' }), 'privacy');
});
