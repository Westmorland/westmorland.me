// Browser interaction and screenshot checks through Chrome DevTools Protocol.
// CHROME points to a preinstalled Chrome/Chromium executable. No downloads.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { startServer } from './server.mjs';
import { withSecurityHeaders } from './headers.mjs';

const chrome = process.env.CHROME || process.argv[2];
if (!chrome) throw new Error('Set CHROME to the installed browser executable');
const origin = await startServer();
const server = process.env.SECURITY_HEADERS === '1' ? await withSecurityHeaders(origin) : origin;
const output = process.env.SCREENSHOT_DIR || 'test-results/screenshots';
const file = server.url + '/';
const profile = await mkdtemp(path.resolve('test-results/chrome-'));
const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let spawnError;
proc.on('error', (error) => { spawnError = error; });
let ws;
const watchdog = setTimeout(() => { console.error('E2E timed out'); proc.kill(); server.stop().finally(() => process.exit(1)); }, 120000);
try {
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    if (spawnError) throw spawnError;
    if (proc.exitCode !== null) throw new Error(`Browser exited ${proc.exitCode}`);
    await sleep(200);
    try {
      const port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0];
      wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
  }
  if (!wsUrl) throw new Error('Browser debugger did not become ready');
  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  let id = 0;
  const pending = new Map();
  const consoleMsgs = [];
  const requests = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer);
      if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m);
      pending.delete(m.id);
    }
    if (m.method === 'Runtime.consoleAPICalled') consoleMsgs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    if (m.method === 'Log.entryAdded') consoleMsgs.push(`${m.params.entry.level}: ${m.params.entry.text}`);
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    const timer = setTimeout(() => { pending.delete(i); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(i, { resolve, reject, timer }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expr) => {
    const response = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (response.result.exceptionDetails) throw new Error(JSON.stringify(response.result.exceptionDetails));
    return response.result.result.value;
  };
  const key = async (k, code, vk) => { for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, ...(k === 'Enter' && type === 'rawKeyDown' ? { text: '\r' } : {}) }); };
  const results = [];
  const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
  const state = async () => ev(`({hash: location.hash, pathname: location.pathname, title: document.title, h1: document.querySelector('main h1')?.getAttribute('aria-label') || document.querySelector('main h1')?.textContent, current: document.querySelector('.cc-head [aria-current=page]')?.textContent.trim()})`);
await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
await send('Page.navigate', { url: file }); await sleep(1200);
let s = await state();
check('default route is Home', /software lead/i.test(s.h1) && s.title === 'Dan Westmorland' && /Home/.test(s.current), JSON.stringify(s));
check('draft marker absent', await ev(`document.querySelector('.vw-draft') === null`));

// Real mouse clicks on header nav
for (const p of ['privacy', 'terms', 'home']) {
  const r = await ev(`(() => { const b = document.querySelector('[data-testid=nav-${p}]').getBoundingClientRect(); return {x: b.x + b.width/2, y: b.y + b.height/2}; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(400); s = await state();
  check(`mouse click header nav -> ${p}`, s.pathname === (p === 'home' ? '/' : `/${p}/`) && s.current?.toLowerCase().includes(p), JSON.stringify(s));
}
// Keyboard: Tab from top to Terms link and press Enter
const fresh = async (h) => { await send('Page.navigate', { url: 'about:blank' }); await sleep(300); await send('Page.navigate', { url: h.startsWith('/') ? server.url + h : file + h }); await sleep(1000); };
await fresh('#/home');
const order = [];
for (let i = 0; i < 5; i++) { await key('Tab', 'Tab', 9); order.push(await ev(`document.activeElement.textContent.trim().slice(0, 40)`)); }
check('tab order: skip link, name, Home, Privacy, Terms', order.slice(0, 5).join('|') === 'Skip to content|DAN WESTMORLAND|01 Home|02 Privacy|03 Terms', order.join(' | '));
await fresh('#/home');
for (let i = 0; i < 5; i++) await key('Tab', 'Tab', 9);
await key('Enter', 'Enter', 13); await sleep(400); s = await state();
check('keyboard Enter on Terms navigates', s.pathname === '/terms/' && s.title === 'Terms · Dan Westmorland', JSON.stringify(s));
check('focus moves to main after navigation', (await ev(`document.activeElement.id`)) === 'main');
// Skip link
await fresh('#/home');
await key('Tab', 'Tab', 9);
const skipVisible = await ev(`document.activeElement.getBoundingClientRect().top >= 0`);
await key('Enter', 'Enter', 13); await sleep(200);
check('skip link visible on focus and moves focus to main', skipVisible && (await ev(`document.activeElement.id`)) === 'main');
// Footer links and in-copy privacy link
await ev(`document.querySelector('.cc-foot a[href="/privacy/"]').click()`); await sleep(300); s = await state();
check('footer Privacy link', s.pathname === '/privacy/' && s.title === 'Privacy · Dan Westmorland', s.hash);
await ev(`location.hash = '#/terms'`); await sleep(300);
await ev(`document.querySelector('.cc-psec a[href="/privacy/"]').click()`); await sleep(300); s = await state();
check('Terms in-copy privacy link', s.pathname === '/privacy/', s.hash);
await ev(`location.hash = '#/nonsense'`); await sleep(300); s = await state();
check('unknown route falls back to Home', /Home/.test(s.current), JSON.stringify(s));
check('only three nav pages', (await ev(`document.querySelectorAll('.cc-head nav a').length`)) === 3);

// Direct URLs and refresh use the actual static server, not a history fallback dev server.
for (const [route, title] of [['/', 'Dan Westmorland'], ['/privacy/', 'Privacy · Dan Westmorland'], ['/terms/', 'Terms · Dan Westmorland']]) {
  await fresh(route);
  check(`direct ${route}`, (await state()).title === title && (await state()).pathname === route);
  await send('Page.reload'); await sleep(1000);
  check(`refresh ${route}`, (await state()).title === title && (await state()).pathname === route);
}
for (const p of ['home', 'privacy', 'terms']) {
  await fresh(`/#/${p}`);
  check(`legacy #/${p} compatible`, (await state()).current.toLowerCase().includes(p));
}
await fresh('/');
await ev(`document.querySelector('[data-testid=nav-privacy]').click()`); await sleep(300);
await ev(`document.querySelector('[data-testid=nav-terms]').click()`); await sleep(300);
await ev('history.back()'); await sleep(300);
check('browser Back restores Privacy', (await state()).title === 'Privacy · Dan Westmorland');
await ev('history.forward()'); await sleep(300);
check('browser Forward restores Terms', (await state()).title === 'Terms · Dan Westmorland');
await ev(`document.querySelector('[data-testid=nav-home]').click()`); await sleep(300);
await ev(`document.querySelector('.cc-foot a[href="/terms/"]').click()`); await sleep(300);
check('footer Terms link', (await state()).title === 'Terms · Dan Westmorland');
await ev(`document.querySelector('.cc-name').click()`); await sleep(300);
check('name returns Home', (await state()).title === 'Dan Westmorland');
check('no forms, embeds or stored browser data', await ev(`document.querySelectorAll('form, input, iframe').length === 0 && document.cookie === '' && localStorage.length === 0 && sessionStorage.length === 0`));
check('noindex absent', await ev(`document.querySelector('meta[name=robots]') === null`));

// Static policies must remain useful with script execution disabled.
await send('Emulation.setScriptExecutionDisabled', { value: true });
for (const route of ['/privacy/', '/terms/']) {
  await fresh(route);
  const markup = (await send('DOM.getDocument')).result.root;
  const main = (await send('DOM.querySelector', { nodeId: markup.nodeId, selector: 'main' })).result.nodeId;
  const html = (await send('DOM.getOuterHTML', { nodeId: main })).result.outerHTML;
  check(`no-JavaScript policy ${route}`, html.includes(route === '/privacy/' ? 'Visiting this website' : 'The application'));
}
await send('Emulation.setScriptExecutionDisabled', { value: false });
await fresh('/');
check('local display and label fonts loaded', await ev(`document.fonts.check('800 32px "Bricolage Grotesque"') && document.fonts.check('400 13px "JetBrains Mono"')`));

// Overflow at narrow widths
for (const w of [320, 375, 390]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 2, mobile: true });
  for (const p of ['home', 'privacy', 'terms']) {
    await ev(`location.hash = '#/${p}'`); await sleep(900);
    const ov = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check(`${w}px no horizontal overflow ${p}`, ov <= 0, `overflow=${ov}px`);
  }
}

// Screenshots: full page, desktop 1440 and mobile 390
await mkdir(output, { recursive: true });
for (const [label, w, dsf, mobile] of [['desktop', 1440, 1, false], ['mobile', 390, 2, true]]) {
  for (const p of ['home', 'privacy', 'terms']) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: dsf, mobile });
    await ev(`location.hash = '#/x'`); await sleep(100);
    await ev(`location.hash = '#/${p}'`); await sleep(1300);
    const h = await ev(`document.documentElement.scrollHeight`);
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile });
    await sleep(300);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${output}/${p}-${label}.png`, Buffer.from(shot.result.data, 'base64'));
  }
}

const external = requests.filter((u) => !u.startsWith(server.url + '/') && !/^(data|about):/.test(u));
check('no external network requests', external.length === 0, `${requests.length} requests total; external: ${external.join(', ') || 'none'}`);
check('no console errors/warnings/exceptions', consoleMsgs.length === 0, consoleMsgs.join(' | '));
  console.log(results.join('\n'));
  console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} checks passed`);
  if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  ws?.close();
  if (proc.exitCode === null && proc.signalCode === null && !spawnError) {
    const exited = once(proc, 'exit'); proc.kill(); await exited;
  }
  await server.stop();
  await rm(profile, { recursive: true, force: true });
}
