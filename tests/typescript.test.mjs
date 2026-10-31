import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { inlineContent } from '../scripts/build-html.ts';
import { requireRoot } from '../src/dom.ts';
import { PAGES, pageTitle, readPage } from '../src/routing.ts';

test('inline CSP extraction uses exact escaped bytes, permits empty and rejects absent blocks', () => {
  for (const tag of ['script', 'style']) {
    const bytes = 'line one\n\\</' + tag + '> & unicode: é';
    // Literal closing tags terminate HTML; escaped closing tags remain content.
    const escaped = bytes.replaceAll('</', '<\\/');
    assert.equal(inlineContent(`<${tag}>${escaped}</${tag}>`, tag), escaped);
    assert.equal(inlineContent(`<${tag}></${tag}>`, tag), '');
    for (const html of ['', `<${tag}>unterminated`, '<main>text</main>']) {
      assert.throws(() => inlineContent(html, tag), { message: `Missing inline ${tag} in generated HTML` });
    }
  }
});

test('mount lookup fails clearly when absent and returns the same root when present', () => {
  assert.throws(() => requireRoot({ getElementById: () => null }), { message: 'Missing #root mount element' });
  // A unit seam, not a simulated browser integration claim.
  const root = { id: 'root' };
  assert.equal(requireRoot({ getElementById: id => { assert.equal(id, 'root'); return root; } }), root);
});

test('route titles are total and legacy/unknown inputs remain bounded', () => {
  for (const page of PAGES) assert.equal(pageTitle(page.id), page.title);
  assert.equal(pageTitle('invalid-runtime-value'), PAGES[0].title);
  for (const hash of ['#/', '#/missing', '#/cv/extra', '#/cv?print']) {
    assert.equal(readPage({ pathname: '/terms/', hash }), hash.startsWith('#/cv') ? 'cv' : 'home');
  }
});

test('real compiler and type-aware lint gates reject invalid application and build contracts', async () => {
  // Unique temporary source directories are included by the real project config.
  // Never edit production sources or suppress a diagnostic to test the gates.
  const appDir = await mkdtemp('src/type-contract-');
  const buildDir = await mkdtemp('scripts/type-contract-');
  try {
    await writeFile(`${appDir}/invalid.tsx`, `
import type { PageId } from '../routing.ts';
import type { PolicyDocument } from '../content.ts';
import { Site } from '../Site.tsx';
export const route: PageId = 'missing';
export const component = <Site initialPage="missing" />;
export const policy: PolicyDocument = { title: 'Incomplete' };
export const root: HTMLElement = document.getElementById('root');
export function implicit(value) { return value; }
export const unchecked: string = ['one'][2];
export const unsafe: any = JSON.parse('{}');
export const member = unsafe.value;
export const assertion = {} as { required: string };
Promise.resolve('unhandled');
`);
    await writeFile(`${buildDir}/invalid.ts`, `import { inlineContent } from '../build-html.ts';
export const content = inlineContent(123, 'iframe');
`);
    const compiler = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(compiler.status, 2, compiler.stdout + compiler.stderr);
    for (const marker of ['invalid.tsx', 'invalid.ts', 'TS2322', 'TS2739', 'TS7006', 'TS2345']) assert.ok(compiler.stdout.includes(marker), compiler.stdout);
    const lint = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', appDir, buildDir, '--format', 'json'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(lint.status, 1, lint.stdout + lint.stderr);
    const rules = JSON.parse(lint.stdout).flatMap(file => file.messages.map(message => message.ruleId));
    for (const rule of ['no-explicit-any', 'no-unsafe-assignment', 'no-unsafe-member-access', 'no-unsafe-type-assertion', 'no-floating-promises']) {
      assert.ok(rules.includes(`@typescript-eslint/${rule}`), JSON.stringify(rules));
    }
  } finally {
    await rm(appDir, { recursive: true, force: true });
    await rm(buildDir, { recursive: true, force: true });
  }
});

test('strict configuration covers application and build without skip/suppression switches', async () => {
  const config = JSON.parse(await readFile('tsconfig.json', 'utf8'));
  for (const key of ['strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes', 'noEmit']) assert.equal(config.compilerOptions[key], true);
  for (const key of ['skipLibCheck', 'noCheck', 'allowJs']) assert.notEqual(config.compilerOptions[key], true);
  assert.ok(config.include.includes('build.ts') && config.include.includes('scripts/**/*.ts') && config.include.includes('src/**/*.tsx'));
});
