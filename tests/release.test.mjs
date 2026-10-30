import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
test('public pages have no draft marker or noindex', async () => {
  for (const file of ['index.html', 'privacy/index.html', 'terms/index.html']) {
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
    for (const page of ['privacy', 'terms']) {
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
  for (const file of ['index.html', 'privacy/index.html', 'terms/index.html']) {
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
test('workflow is website-only, pinned, least privilege and serial main-only', async () => {
  const flow = parse(await readFile('.github/workflows/website.yml', 'utf8'));
  assert.deepEqual(flow.on, { push: { branches: ['main'] }, workflow_dispatch: {} });
  assert.deepEqual(flow.permissions, { contents: 'read' });
  assert.deepEqual(flow.concurrency, { group: 'website-production', 'cancel-in-progress': false });
  assert.equal(Object.keys(flow.jobs).length, 1);
  const job = flow.jobs.website;
  assert.equal(job.if, "github.repository == 'Westmorland/westmorland.me' && github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')");
  const steps = job.steps;
  for (const step of steps.filter((s) => s.uses)) assert.match(step.uses, /^[\w/-]+@[a-f0-9]{40}$/);
  assert.equal(steps[0].with['persist-credentials'], false);
  const upload = steps.at(-1);
  assert.match(upload.uses, /^Azure\/static-web-apps-deploy@/);
  assert.deepEqual(upload.with, { azure_static_web_apps_api_token: '${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}', action: 'upload', app_location: 'dist', api_location: '', output_location: '', skip_app_build: true, skip_api_build: true, production_branch: 'main' });
  const commands = steps.filter((s) => s.run).map((s) => s.run).join('\n');
  for (const cmd of ['npm ci --ignore-scripts --no-audit --no-fund', 'npm run build', 'npm test', 'npm run test:integration', 'npm run test:e2e', 'npm run check:payload', 'git diff --exit-code -- dist', 'bash scripts/deploy-guard.sh']) assert.ok(commands.includes(cmd), cmd);
  assert.equal(steps.at(-2).run, 'bash scripts/deploy-guard.sh');
  assert.deepEqual(steps.at(-2).env, { AZURE_STATIC_WEB_APPS_API_TOKEN: '${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}' });
  assert.equal(job.env, undefined, 'no job-wide secrets');
});
test('actual workflow predicate and shell guard reject PR/fork/non-main/missing-token events', async () => {
  const flow = parse(await readFile('.github/workflows/website.yml', 'utf8'));
  const predicate = new Function('github', `return (${flow.jobs.website.if});`);
  const cases = [
    ['push', 'refs/heads/main', 'Westmorland/westmorland.me', 'test-token', true],
    ['workflow_dispatch', 'refs/heads/main', 'Westmorland/westmorland.me', 'test-token', true],
    ['pull_request', 'refs/heads/main', 'Westmorland/westmorland.me', 'test-token', false],
    ['pull_request_target', 'refs/heads/main', 'Westmorland/westmorland.me', 'test-token', false],
    ['push', 'refs/heads/topic', 'Westmorland/westmorland.me', 'test-token', false],
    ['workflow_dispatch', 'refs/heads/topic', 'Westmorland/westmorland.me', 'test-token', false],
    ['push', 'refs/heads/main', 'someone/fork', 'test-token', false],
    ['push', 'refs/tags/main', 'Westmorland/westmorland.me', 'test-token', false],
    ['push', 'refs/heads/main', 'Westmorland/westmorland.me', '', false],
  ];
  for (const [event, ref, repository, token, allowed] of cases) {
    const result = spawnSync('bash', ['scripts/deploy-guard.sh'], { encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_NAME: event, GITHUB_REF: ref, GITHUB_REPOSITORY: repository, AZURE_STATIC_WEB_APPS_API_TOKEN: token } });
    assert.equal(result.status === 0, allowed, `${event} ${ref} ${repository} token=${Boolean(token)}: ${result.stderr}`);
    assert.ok(!result.stdout.includes('test-token') && !result.stderr.includes('test-token'));
    assert.equal(Boolean(predicate({ event_name: event, ref, repository })) && result.status === 0, allowed);
  }
});
