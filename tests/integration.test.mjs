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
    assert.ok(markup.includes(page.id === 'home' ? 'Software leadership, architecture and agentic AI delivery.' : page.id === 'cv' ? 'Agentic AI delivery' : page.id === 'privacy' ? 'Visiting this website' : 'The application'));
    assert.doesNotMatch(html, /name="robots" content="noindex"/);
  });
}
for (const page of ['cv', 'privacy', 'terms']) {
  test(`HTTP /${page} redirects to its directory URL`, async () => {
    const response = await fetch(`${server.url}/${page}`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), `/${page}/`);
  });
}
test('HTTP CV includes the expanded career entries without JavaScript', async () => {
  const response = await fetch(server.url + '/cv/');
  assert.equal(response.status, 200);
  const html = (await response.text()).split('<div id="root">')[1].split('<script>')[0];
  const experience = html.match(/<section aria-labelledby="b-exp">([\s\S]*?)<\/section>/)[1];
  for (const text of ['Senior Software Consultant and Senior Software Consultant Lead', 'Developer and Lead Software Developer', 'Creating Careers / vision2learn', 'Training Facilitator', 'Responsible for on-site employee training at Tata Steel.', 'client advice and mentoring', 'improve internal communication', 'Worked with ASP.NET']) assert.ok(experience.includes(text), text);
  const tata = [...experience.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].find(m => m[1].includes('Tata Steel'))?.[1];
  assert.ok(tata);
  assert.match(tata, /<h3>Training Facilitator<\/h3>/);
  assert.match(tata, /<p>Responsible for on-site employee training at Tata Steel\.<\/p>/);
  assert.doesNotMatch(tata, /design|develop|software|courses?|manag|400|achievement/i);
  assert.equal((experience.match(/<article /g) || []).length, 4);
  assert.doesNotMatch(experience, /Training Manager|2010|2011|2012|2014|2018|disputed|indexed/);
});
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
    for (const route of ['/', '/cv/', '/privacy/', '/terms/', '/missing/']) {
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
