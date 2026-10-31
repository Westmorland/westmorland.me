import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { checkResourceAttributes } from './resource-policy.mjs';
import { createHash } from 'node:crypto';

const files = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async (entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
const expected = ['staticwebapp.config.json', 'index.html', 'cv/index.html', 'privacy/index.html', 'terms/index.html', 'licenses/bricolage-grotesque-OFL.txt', 'licenses/jetbrains-mono-OFL.txt', 'licenses/react-MIT.txt', 'licenses/react-dom-MIT.txt', 'licenses/scheduler-MIT.txt'].sort();
assert.deepEqual((await files('dist')).map((file) => file.slice(5)).sort(), expected);
const deny = process.env.PAYLOAD_DENY_FILE ? JSON.parse(await readFile(process.env.PAYLOAD_DENY_FILE, 'utf8')) : [];
assert.ok(Array.isArray(deny) && deny.every((value) => typeof value === 'string' && value.length > 0));
for (const file of [...await files('src'), ...expected.filter((file) => file.endsWith('.html')).map((file) => `dist/${file}`)]) {
  const raw = await readFile(file, 'utf8');
  // Binary font encodings can coincidentally contain short words. Verify every
  // embedded font byte-for-byte against pinned packages before scanning text.
  const fonts = [...raw.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g)];
  const expectedFonts = await Promise.all([
    ['bricolage-grotesque', 400], ['bricolage-grotesque', 800],
    ['jetbrains-mono', 400], ['jetbrains-mono', 700],
  ].map(([family, weight]) => readFile(`node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff2`)));
  if (file.endsWith('.html')) {
    assert.equal(fonts.length, expectedFonts.length);
    fonts.forEach((font, index) => assert.deepEqual(Buffer.from(font[1], 'base64'), expectedFonts[index]));
  }
  const text = raw.replace(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/g, 'VERIFIED_LOCAL_FONT');
  for (const [index, term] of deny.entries()) {
    assert.ok(!text.toLowerCase().includes(term.toLowerCase()), `${file}: denied term index ${index}`);
  }
  assert.ok(!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text), `${file}: email address`);
  assert.ok(!/(?:https?:\/\/[^\s"'<>]*\.home\.|\/var\/lib\/|\b10\.0\.\d+\.\d+\b)/i.test(text), `${file}: internal host or path`);
  console.log(`PASS payload ${file} sha256=${createHash('sha256').update(raw).digest('hex')}`);
}
for (const file of expected.filter((file) => file.endsWith('.html'))) {
  const text = await readFile(`dist/${file}`, 'utf8');
  assert.doesNotMatch(text, /name="robots" content="noindex"/);
  assert.doesNotMatch(text, /Design draft, not for publication/);
  assert.ok(!/<(?:form|iframe|input|script[^>]*src=)\b/i.test(text));
  assert.equal((text.match(/data:font\/woff2;base64,/g) || []).length, 4);
  checkResourceAttributes(text);
}
for (const font of ['bricolage-grotesque', 'jetbrains-mono']) {
  assert.equal(await readFile(`dist/licenses/${font}-OFL.txt`, 'utf8'), await readFile(`node_modules/@fontsource/${font}/LICENSE`, 'utf8'));
}
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
for (const entry of Object.values(lock.packages)) {
  if (entry.resolved) assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/'));
}
console.log(`PASS exact distribution allowlist, four local fonts per page, licences, resource attributes, registry origins; ${deny.length} scoped deny terms`);
console.log('Licence copyright attribution and dependency namespace/error-documentation strings are retained, not external runtime requests.');
