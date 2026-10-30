import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer } from './server.mjs';
import { withSecurityHeaders } from './headers.mjs';
import { PAGES } from '../src/routing.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server?.stop(); });
for (const page of PAGES) {
  test(`HTTP ${page.path}: exact packaged bytes and readable HTML without JS`, async () => {
    const response = await fetch(server.url + page.path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const html = await response.text();
    assert.equal(html, await readFile(`dist${page.path}index.html`, 'utf8'));
    assert.ok(html.includes(`<title>${page.title}</title>`));
    const markup = html.split('<div id="root">')[1].split('<script>')[0];
    assert.match(markup, /<main /);
    assert.doesNotMatch(markup, /Design draft, not for publication/);
    assert.ok(markup.includes(page.id === 'home' ? 'Architecture, delivery and people.' : page.id === 'privacy' ? 'Visiting this website' : 'The application'));
    assert.doesNotMatch(html, /name="robots" content="noindex"/);
  });
}
for (const page of ['privacy', 'terms']) {
  test(`HTTP /${page} redirects to its directory URL`, async () => {
    const response = await fetch(`${server.url}/${page}`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), `/${page}/`);
  });
}
test('unknown path returns Home with an honest 404 status', async () => {
  const response = await fetch(server.url + '/missing/');
  assert.equal(response.status, 404);
  assert.equal(await response.text(), await readFile('dist/index.html', 'utf8'));
});
test('private source paths are not served', async () => {
  for (const name of ['package.json', 'src/content.js', '.git/config', 'Dockerfile']) {
    const response = await fetch(`${server.url}/${name}`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), await readFile('dist/index.html', 'utf8'));
  }
});
test('security headers cross an actual HTTP boundary unchanged', async () => {
  const wrapped = await withSecurityHeaders(await startServer());
  try {
    const config = JSON.parse(await readFile('dist/staticwebapp.config.json', 'utf8'));
    for (const route of ['/', '/privacy/', '/terms/', '/missing/']) {
      const response = await fetch(wrapped.url + route);
      for (const [key, value] of Object.entries(config.globalHeaders)) assert.equal(response.headers.get(key), value);
      assert.equal(response.status, route === '/missing/' ? 404 : 200);
    }
  } finally { await wrapped.stop(); }
});
test('font and bundled runtime licences are served intact', async () => {
  for (const name of ['bricolage-grotesque-OFL', 'jetbrains-mono-OFL', 'react-MIT', 'react-dom-MIT', 'scheduler-MIT']) {
    const response = await fetch(`${server.url}/licenses/${name}.txt`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), await readFile(`dist/licenses/${name}.txt`, 'utf8'));
  }
});
