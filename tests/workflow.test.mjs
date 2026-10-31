import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const workflow = async () => parse(await readFile('.github/workflows/website.yml', 'utf8'));
test('workflow provides unprivileged PR and main Website validation', async () => {
  const flow = await workflow();
  assert.deepEqual(flow.on, { pull_request: { branches: ['main'] }, push: { branches: ['main'] }, workflow_dispatch: {} });
  assert.deepEqual(Object.keys(flow.jobs), ['validation', 'production']);
  assert.equal(flow.jobs.validation.name, 'Website validation');
  assert.equal(flow.jobs.validation.if, undefined, 'required validation must not silently skip');
  assert.equal(flow.jobs.validation.environment, undefined);
  assert.equal(flow.concurrency, undefined, 'PR validation must not share the production queue');
  const commands = flow.jobs.validation.steps.filter((s) => s.run).map((s) => s.run).join('\n');
  for (const cmd of ['npm ci --ignore-scripts --no-audit --no-fund', 'npm run typecheck', 'npm run lint', 'npm run build', 'npm test', 'npm run test:integration', 'npm run test:e2e', 'npm run check:payload', 'git diff --exit-code -- dist']) assert.ok(commands.includes(cmd), cmd);
});
test('workflow keeps read-only permissions, pinned actions and secrets only at the production boundary', async () => {
  const flow = await workflow();
  assert.deepEqual(flow.permissions, { contents: 'read' });
  assert.equal(flow.env, undefined);
  for (const job of Object.values(flow.jobs)) {
    assert.equal(job.permissions, undefined);
    assert.equal(job.env, undefined);
    assert.equal(job['continue-on-error'], undefined);
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /^[\w/-]+@[a-f0-9]{40}$/);
      if (step.uses?.startsWith('actions/checkout@')) assert.equal(step.with['persist-credentials'], false);
      assert.equal(step['continue-on-error'], undefined);
    }
  }
  const { production, ...unprivileged } = flow.jobs;
  assert.doesNotMatch(JSON.stringify(unprivileged), /secrets\.|Azure\/static-web-apps-deploy|deploy-guard/);
  assert.equal(production.environment, 'production');
  assert.deepEqual(production.concurrency, { group: 'website-production', 'cancel-in-progress': false });
  const upload = production.steps.at(-1);
  assert.match(upload.uses, /^Azure\/static-web-apps-deploy@/);
  const token = upload.with.azure_static_web_apps_api_token;
  assert.match(token, /^\$\{\{ secrets\.[A-Z_]+ \}\}$/);
  assert.deepEqual(upload.with, { azure_static_web_apps_api_token: token, action: 'upload', app_location: 'dist', api_location: '', output_location: '', skip_app_build: true, skip_api_build: true, production_branch: 'main' });
  assert.equal(production.steps.at(-2).env.DEPLOYMENT_TOKEN, token);
  assert.equal((JSON.stringify(flow).match(/secrets\./g) || []).length, 2);
});
test('workflow binds deployment checkout and payload to the successful exact validation revision', async () => {
  const { validation, production } = (await workflow()).jobs;
  assert.deepEqual(production.needs, ['validation']);
  assert.deepEqual(validation.outputs, { sha: '${{ steps.checked.outputs.sha }}', dist_tree: '${{ steps.checked.outputs.dist_tree }}' });
  assert.equal(validation.steps[0].with.ref, '${{ github.sha }}');
  const checked = validation.steps.at(-1);
  assert.equal(checked.id, 'checked');
  assert.match(checked.run, /git rev-parse HEAD/);
  assert.match(checked.run, /GITHUB_SHA/);
  assert.match(checked.run, /sha=.*GITHUB_OUTPUT/);
  assert.match(checked.run, /dist_tree=.*git rev-parse HEAD:dist.*GITHUB_OUTPUT/);
  assert.match(checked.run, /git status --porcelain --untracked-files=all --ignored -- dist/);
  assert.equal(production.steps[0].with.ref, '${{ needs.validation.outputs.sha }}');
  assert.equal(production.steps.length, 3, 'no rebuild or unrelated payload mutation in production');
  assert.equal(production.steps[1].run, 'bash scripts/deploy-guard.sh');
  assert.deepEqual(production.steps[1].env, {
    VALIDATION_RESULT: '${{ needs.validation.result }}',
    CHECKED_SHA: '${{ needs.validation.outputs.sha }}',
    CHECKED_DIST_TREE: '${{ needs.validation.outputs.dist_tree }}',
    DEPLOYMENT_TOKEN: production.steps[2].with.azure_static_web_apps_api_token,
  });
});
test('workflow predicate rejects failed/skipped validation, PRs, forks, tags and non-main runs', async () => {
  const flow = await workflow();
  // Evaluate this deliberately simple predicate locally, not GitHub's scheduler.
  const predicate = new Function('github', 'needs', `return (${flow.jobs.production.if});`);
  for (const result of ['success', 'failure', 'cancelled', 'skipped', '']) {
    for (const event_name of ['push', 'workflow_dispatch', 'pull_request', 'pull_request_target']) {
      for (const ref of ['refs/heads/main', 'refs/heads/topic', 'refs/tags/main']) {
        for (const repository of ['Westmorland/westmorland.me', 'someone/fork']) {
          const expected = result === 'success' && ['push', 'workflow_dispatch'].includes(event_name) && ref === 'refs/heads/main' && repository === 'Westmorland/westmorland.me';
          assert.equal(predicate({ event_name, ref, repository }, { validation: { result } }), expected, JSON.stringify({ result, event_name, ref, repository }));
        }
      }
    }
  }
});

test('deployment guard crosses real Git boundaries and rejects stale or unchecked payloads', async (t) => {
  await mkdir('test-results', { recursive: true });
  const root = await mkdtemp(path.resolve('test-results/deploy-guard-'));
  const checkout = path.join(root, 'checkout');
  const remote = path.join(root, 'remote.git');
  const guard = path.resolve('scripts/deploy-guard.sh');
  const publicURL = 'https://github.com/Westmorland/westmorland.me.git';
  // No network, credentials or existing Git configuration: rewrite only this URL
  // to a disposable local bare repository and exercise the actual git executable.
  const env = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `url.${remote}.insteadOf`, GIT_CONFIG_VALUE_0: publicURL };
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: checkout, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    await mkdir(path.join(checkout, 'dist'), { recursive: true });
    git('init', '-b', 'main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    await writeFile(path.join(checkout, 'dist/index.html'), 'checked payload');
    git('add', 'dist'); git('commit', '-m', 'First checked revision');
    git('clone', '--bare', checkout, remote);
    const sha = git('rev-parse', 'HEAD');
    const tree = git('rev-parse', 'HEAD:dist');
    const good = { ...env, GITHUB_REPOSITORY: 'Westmorland/westmorland.me', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', GITHUB_SHA: sha, CHECKED_SHA: sha, CHECKED_DIST_TREE: tree, VALIDATION_RESULT: 'success', DEPLOYMENT_TOKEN: 'synthetic-marker-not-a-credential' };
    const run = (overrides = {}, error) => {
      const result = spawnSync('bash', [guard], { cwd: checkout, env: { ...good, ...overrides }, encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, error ? 1 : 0, result.stderr);
      assert.doesNotMatch(result.stdout + result.stderr, /synthetic-marker-not-a-credential/);
      if (error) assert.match(result.stderr, error);
    };
    await t.test('validation output step emits only the exact clean checked revision and payload', async () => {
      const command = (await workflow()).jobs.validation.steps.at(-1).run;
      const output = path.join(root, 'outputs');
      const record = async (GITHUB_SHA, allowed) => {
        await writeFile(output, '');
        const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', command], { cwd: checkout, env: { ...env, GITHUB_SHA, GITHUB_OUTPUT: output }, encoding: 'utf8' });
        assert.equal(result.status === 0, allowed, result.stderr);
        assert.equal(await readFile(output, 'utf8'), allowed ? `sha=${sha}\ndist_tree=${tree}\n` : '');
      };
      await record(sha, true);
      await record('f'.repeat(40), false);
      await writeFile(path.join(checkout, 'dist/unvalidated.html'), 'not committed');
      await record(sha, false);
      await rm(path.join(checkout, 'dist/unvalidated.html'));
    });
    await t.test('current checked push and manual run are allowed', () => { run(); run({ GITHUB_EVENT_NAME: 'workflow_dispatch' }); });
    await t.test('repository, event, ref, token and successful validation are required', () => {
      for (const GITHUB_EVENT_NAME of ['pull_request', 'pull_request_target', '']) run({ GITHUB_EVENT_NAME }, /event/);
      for (const GITHUB_REF of ['refs/heads/topic', 'refs/tags/main', '']) run({ GITHUB_REF }, /main branch/);
      run({ GITHUB_REPOSITORY: 'someone/fork' }, /website repository/);
      run({ DEPLOYMENT_TOKEN: '' }, /secret is missing/);
      for (const VALIDATION_RESULT of ['failure', 'cancelled', 'skipped', '']) run({ VALIDATION_RESULT }, /validation/);
    });
    await t.test('missing, malformed or mismatched checked identities are denied', () => {
      for (const CHECKED_SHA of ['', 'main', 'f'.repeat(40)]) run({ CHECKED_SHA }, /revision/);
      run({ GITHUB_SHA: 'e'.repeat(40) }, /revision/);
      for (const CHECKED_DIST_TREE of ['', 'dist', 'f'.repeat(40)]) run({ CHECKED_DIST_TREE }, /payload/);
    });
    await t.test('tracked and untracked payload changes are denied', async () => {
      await writeFile(path.join(checkout, 'dist/index.html'), 'tampered payload');
      run({}, /payload/);
      git('restore', 'dist/index.html');
      await writeFile(path.join(checkout, 'dist/extra.html'), 'unvalidated file');
      run({}, /payload/);
      await rm(path.join(checkout, 'dist/extra.html'));
      await writeFile(path.join(checkout, '.git/info/exclude'), 'dist/extra.html\n');
      await writeFile(path.join(checkout, 'dist/extra.html'), 'ignored unvalidated file');
      run({}, /payload/);
      await rm(path.join(checkout, 'dist/extra.html'));
      run();
    });
    await t.test('newer main rejects a formerly valid queued or approved revision', () => {
      git('commit', '--allow-empty', '-m', 'New main revision');
      const newer = git('rev-parse', 'HEAD');
      git('push', remote, 'main');
      git('checkout', '--detach', sha);
      run({}, /stale/);
      git('checkout', '--detach', newer);
      run({ GITHUB_SHA: newer, CHECKED_SHA: newer });
      git('checkout', '--detach', sha);
      run({}, /stale/);
    });
    await t.test('missing main and unavailable remote fail closed', () => {
      git('--git-dir=' + remote, 'update-ref', '-d', 'refs/heads/main');
      run({}, /current main/);
      run({ GIT_CONFIG_KEY_0: `url.${root}/missing.git.insteadOf` }, /current main/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
