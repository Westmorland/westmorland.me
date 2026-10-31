import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
test('public pages have no draft marker or noindex', async () => {
  for (const file of ['index.html', 'cv/index.html', 'privacy/index.html', 'terms/index.html']) {
    const html = await readFile(`dist/${file}`, 'utf8');
    assert.doesNotMatch(html, /Design draft, not for publication|name="robots" content="noindex"/);
  }
});
for (const file of ['staticwebapp.config.json', 'dist/staticwebapp.config.json']) {
  test(`SWA has no slash-normalised duplicate routes in ${file}`, async () => {
    const config = await json(file);
    // Azure treats /privacy and /privacy/ as the same route. This site uses
    // unconditional rules; this guard is not a general Azure route validator.
    const routes = config.routes.map(({ route }) => route.replace(/\/+$/, '') || '/');
    assert.equal(new Set(routes).size, routes.length, 'slash variants must not define separate rules');
  });
  test(`SWA delegates policy redirects to trailingSlash and preserves 404 Home in ${file}`, async () => {
    const config = await json(file);
    // Microsoft documents always: /page and /page/index.html -> 301 /page/,
    // then /page/ -> 200 from /page/index.html. No per-page rules are needed.
    assert.equal(config.trailingSlash, 'always');
    assert.deepEqual(config.routes.map(({ route }) => route), ['/.auth/login/aad', '/.auth/login/github']);
    for (const page of ['cv', 'privacy', 'terms']) {
      assert.match(await readFile(`dist/${page}/index.html`, 'utf8'), /^<!doctype html>/);
    }
    assert.deepEqual(config.responseOverrides, { '404': { rewrite: '/index.html', statusCode: 404 } });
    assert.equal(config.navigationFallback, undefined);
  });
}
for (const [index, provider] of ['aad', 'github'].entries()) {
  test(`SWA blocks built-in ${provider} sign-in in source and emitted configuration`, async () => {
    for (const file of ['staticwebapp.config.json', 'dist/staticwebapp.config.json']) {
      const config = await json(file);
      const route = `/.auth/login/${provider}`;
      assert.deepEqual(config.routes[index], { route, statusCode: 404 }, `${file}: unconditional block precedes other routes`);
      assert.equal(config.routes.filter((rule) => rule.route === route).length, 1);
    }
  });
}
test('SWA headers authorise exactly the bundled inline script/style, no unsafe inline/eval', async () => {
  const { globalHeaders: headers } = await json('dist/staticwebapp.config.json');
  const csp = headers['Content-Security-Policy'];
  for (const file of ['index.html', 'cv/index.html', 'privacy/index.html', 'terms/index.html']) {
    const html = await readFile(`dist/${file}`, 'utf8');
    for (const tag of ['script', 'style']) {
      const bytes = html.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))[1];
      const hash = createHash('sha256').update(bytes).digest('base64');
      assert.ok(csp.includes(`${tag}-src 'sha256-${hash}'`));
    }
    assert.doesNotMatch(html.split('<script>')[0], / style=| on\w+=/);
  }
  for (const directive of ["default-src 'none'", "font-src data:", "img-src data:", "connect-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(directive));
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.equal(headers['X-Frame-Options'], 'DENY');
});
// Kept in the existing npm test entry point; workflow tests have no credentials.
import './workflow.test.mjs';
