// Real-browser controls for the exact fresh-navigation/media/font block in e2e.mjs.
// Usage: node tests/font-readiness.mjs delayed|broken|stalled|missing [e2e-source]
// Negative modes must exit 1 at the font assertion, not at harness setup.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export async function startFontFixture(mode) {
  const fonts = [];
  const pending = [];
  let released = false;
  const original = await readFile('dist/index.html', 'utf8');
  // Only transport changes: valid controls use the exact embedded WOFF2 bytes.
  // No FontFace/FontFaceSet API, status, check or browser state is fabricated.
  const html = mode === 'missing'
    ? original.replace(/@font-face\{[^}]+\}/g, '')
    : original.replace(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g, (_, data) => {
      fonts.push(Buffer.from(data, 'base64'));
      return `/__font-control/${fonts.length - 1}.woff2`;
    });
  assert.ok(mode === 'missing' || fonts.length > 0, 'fixture discovered embedded fonts');
  const deliver = ({ response, index }) => {
    response.writeHead(200, { 'Content-Type': 'font/woff2', 'Cache-Control': 'no-store' });
    response.end(mode === 'broken' ? Buffer.from('not a WOFF2 font') : fonts[index]);
  };
  const server = createServer((request, response) => {
    const match = request.url.match(/^\/__font-control\/(\d+)\.woff2$/);
    if (match) {
      const entry = { response, index: Number(match[1]) };
      if (released) deliver(entry); else pending.push(entry);
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      response.end(html);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    pending: () => pending.length,
    release: () => { released = true; for (const entry of pending.splice(0)) deliver(entry); },
    stop: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  assert.ok(['delayed', 'broken', 'stalled', 'missing'].includes(mode), 'choose a control mode');
  const source = await readFile(process.argv[3] || 'tests/e2e.mjs', 'utf8');
  const start = source.indexOf("await send('Emulation.setScriptExecutionDisabled', { value: false });");
  const end = source.indexOf('// Overflow at narrow widths', start);
  const prefixEnd = source.indexOf("await send('Page.navigate', { url: file });");
  const fresh = source.match(/^const fresh = .*;$/m)?.[0];
  const footer = source.slice(source.indexOf('  console.log(results.join('));
  assert.ok(start > 0 && end > start && prefixEnd > 0 && fresh && footer.includes('} finally {'), 'known E2E harness boundaries');
  let prefix = source.slice(0, prefixEnd)
    .replace("const origin = await startServer();", `const origin = await startFontFixture('${mode}');`)
    .replace("process.env.SECURITY_HEADERS === '1'", 'false');
  // The browser profile path must stay short enough for Chromium Unix sockets.
  prefix = prefix.replace("mkdtemp(path.resolve('test-results/chrome-'))", "mkdtemp(path.join(process.env.TMPDIR, 'chrome-'))");
  prefix = prefix.replaceAll("from './server.mjs'", `from '${new URL('./server.mjs', import.meta.url)}'`)
    .replaceAll("from './headers.mjs'", `from '${new URL('./headers.mjs', import.meta.url)}'`);
  const gate = `
const targetEv = async (expr) => {
  if (!expr.includes('document.fonts')) return ev(expr);
  const started = performance.now();
  const evaluation = ev(expr);
  // CDP executes this after the assertion has started. The old synchronous check
  // has already returned; the repaired check is awaiting real browser loading.
  const beforeRelease = await ev(\`({status: document.fonts.status, faces: Array.from(document.fonts, f => ({family:f.family,weight:f.weight,status:f.status})), display:document.fonts.check('800 32px "Bricolage Grotesque"'), label:document.fonts.check('400 13px "JetBrains Mono"')})\`);
  console.log('CONTROL before release', JSON.stringify({mode: '${mode}', pending: origin.pending(), ...beforeRelease}));
  if ('${mode}' !== 'missing' && (origin.pending() === 0 || beforeRelease.status !== 'loading' || (beforeRelease.display && beforeRelease.label))) throw new Error('Control did not hold a required real font load');
  if ('${mode}' !== 'stalled') origin.release();
  const result = await evaluation;
  console.log('CONTROL assertion elapsed_ms', Math.round(performance.now() - started));
  return result;
};
`;
  // Execute the actual production-test block, not a duplicate font assertion.
  const section = source.slice(start, end).replaceAll('await ev(', 'await targetEv(');
  const script = `import { startFontFixture } from '${import.meta.url}';\n${prefix}\n${fresh}\n${gate}\n${section}\n${footer}`;
  const child = spawn(process.execPath, ['--input-type=module'], { stdio: ['pipe', 'inherit', 'inherit'], env: process.env });
  child.stdin.end(script);
  child.on('error', error => { throw error; });
  child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code; });
}
