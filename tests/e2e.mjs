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
check('draft marker absent', await ev(`document.querySelector('.vw-draft, .draft') === null`));

// Focus is a native list, not selectable controls. Exercise real browser input,
// including Chromium's existing sticky :hover after touch, without DOM .click().
const focusState = () => ev(`Array.from(document.querySelectorAll('.cc-focus li'), li => {
  const title = getComputedStyle(li.querySelector('h3'));
  return { hover: li.matches(':hover'), colour: getComputedStyle(li.querySelector('.cc-focus-num')).color,
    title: [title.color, title.fontSize, title.lineHeight, title.fontWeight],
    native: li.tagName === 'LI' && li.parentElement.tagName === 'OL' && !li.hasAttribute('role') && !li.hasAttribute('tabindex') &&
      !li.hasAttribute('aria-selected') && !li.hasAttribute('aria-pressed') && !li.querySelector('button, a, [role], [tabindex]') };
})`);
const idleColours = ['rgb(52, 53, 46)', 'rgb(52, 53, 46)', 'rgb(52, 53, 46)', 'rgb(75, 90, 20)'];
const signalColour = 'rgb(212, 255, 58)';
const focusPoint = async (index) => ev(`(() => {
  const li = document.querySelectorAll('.cc-focus li')[${index}];
  li.scrollIntoView({block: 'center'});
  const b = li.getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2};
})()`);
const mouse = async (type, point) => send('Input.dispatchMouseEvent', { type, ...point,
  ...(type === 'mouseMoved' ? {} : {button: 'left', clickCount: 1}) });
const tap = async (point) => {
  await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...point, id: 1}]});
  await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
};
for (const mode of ['pointer', 'touch']) {
  await send('Emulation.setDeviceMetricsOverride', {width: mode === 'touch' ? 390 : 1440, height: 900, deviceScaleFactor: 1, mobile: mode === 'touch'});
  await send('Emulation.setTouchEmulationEnabled', {enabled: mode === 'touch'});
  await mouse('mouseMoved', {x: 0, y: 0});
  await send('Page.navigate', {url: file}); await sleep(1000);
  await ev(`document.fonts.ready`);
  const idle = await focusState();
  check(`${mode} Focus initial idle colours and native list`, idle.length === 4 && idle.every((r, i) => !r.hover && r.colour === idleColours[i] && r.native), JSON.stringify(idle));
  check(`${mode} Focus AI heading retains distinct styling`, idle[3].title[0] === signalColour && idle[3].title[3] === '800' && parseFloat(idle[3].title[1]) < parseFloat(idle[0].title[1]), JSON.stringify(idle[3].title));
  await ev(`window.focusInput = []; for (const type of ['pointermove', 'click', 'touchstart', 'touchend']) document.querySelector('.cc-focus').addEventListener(type, e => window.focusInput.push({type, trusted: e.isTrusted, pointerType: e.pointerType, row: [...document.querySelectorAll('.cc-focus li')].indexOf(e.target.closest('li'))}));`);
  for (let i = 0; i < 4; i++) {
    const point = await focusPoint(i);
    if (mode === 'pointer') {
      await mouse('mouseMoved', point); await sleep(300); // Beyond the real 200ms colour transition.
      const hovered = await focusState();
      check(`pointer Focus 0${i + 1} movement highlights`, hovered[i].hover && hovered[i].colour === signalColour, JSON.stringify(hovered[i]));
      await mouse('mousePressed', point); await mouse('mouseReleased', point);
    } else await tap(point);
    await sleep(300);
    const active = await focusState();
    check(`${mode} Focus 0${i + 1} ${mode === 'touch' ? 'tap' : 'click'} highlights only hovered row`, active.every((r, j) => r.hover === (j === i) && r.colour === (j === i ? signalColour : idleColours[j]) && r.native && JSON.stringify(r.title) === JSON.stringify(idle[j].title)), JSON.stringify(active));
    check(`${mode} Focus 0${i + 1} input leaves route and list semantics unchanged`, await ev(`location.pathname === '/' && document.querySelectorAll('.cc-focus li').length === 4 && document.querySelectorAll('.cc-focus [aria-selected], .cc-focus [aria-pressed], .cc-focus [tabindex], .cc-focus [role], .cc-focus button').length === 0`));
    if (mode === 'pointer') await mouse('mouseMoved', {x: 0, y: 0});
    else await tap({x: 2, y: 2}); // Outside the inset list: clear native sticky hover.
    await sleep(300);
    const restored = await focusState();
    check(`${mode} Focus 0${i + 1} departure restores idle colours`, restored.every((r, j) => !r.hover && r.colour === idleColours[j] && JSON.stringify(r.title) === JSON.stringify(idle[j].title)), JSON.stringify(restored));
  }
  const events = await ev('window.focusInput');
  check(`${mode} Focus trusted input reached all four rows`, [0, 1, 2, 3].every(row => (mode === 'touch' ? ['touchstart', 'touchend', 'click'] : ['pointermove', 'click']).every(type => events.some(e => e.row === row && e.type === type && e.trusted && (type !== 'pointermove' || e.pointerType === 'mouse')))), JSON.stringify(events));
}
await send('Emulation.setTouchEmulationEnabled', {enabled: false});
await send('Emulation.clearDeviceMetricsOverride');
await mouse('mouseMoved', {x: 0, y: 0});
await send('Page.navigate', {url: file}); await sleep(1000);

// Real mouse navigation across header and footer.
for (const p of ['cv', 'privacy', 'terms', 'home']) {
  const selector = ['home', 'cv'].includes(p) ? `[data-testid=nav-${p}]` : `.cc-foot a[href="/${p}/"]`;
  await ev(`document.querySelector('${selector}').scrollIntoView({block: 'center'})`);
  const r = await ev(`(() => { const b = document.querySelector('${selector}').getBoundingClientRect(); return {x: b.x + b.width/2, y: b.y + b.height/2}; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(400); s = await state();
  check(`mouse click navigation -> ${p}`, s.pathname === (p === 'home' ? '/' : `/${p}/`) && s.title === (p === 'home' ? 'Dan Westmorland' : `${p === 'cv' ? 'CV' : p[0].toUpperCase() + p.slice(1)} · Dan Westmorland`), JSON.stringify(s));
}
// Keyboard: header CV and Home call to action remain in logical order.
const fresh = async (h) => { await send('Page.navigate', { url: 'about:blank' }); await sleep(300); await send('Page.navigate', { url: h.startsWith('/') ? server.url + h : file + h }); await sleep(1000); };
await fresh('#/home');
const order = [];
for (let i = 0; i < 5; i++) { await key('Tab', 'Tab', 9); order.push(await ev(`document.activeElement.textContent.trim().slice(0, 40)`)); }
check('tab order: skip link, name, Home, CV, Read the CV', order.slice(0, 5).join('|') === 'Skip to content|DAN WESTMORLAND|01 Home|02 CV|Read the CV →', order.join(' | '));
await fresh('#/home');
for (let i = 0; i < 4; i++) await key('Tab', 'Tab', 9);
check('keyboard focus has a visible outline', await ev(`getComputedStyle(document.activeElement).outlineStyle === 'solid' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2`));
await key('Enter', 'Enter', 13); await sleep(400); s = await state();
check('keyboard Enter on CV navigates', s.pathname === '/cv/' && s.title === 'CV · Dan Westmorland', JSON.stringify(s));
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
check('only Home and CV in header', (await ev(`Array.from(document.querySelectorAll('.cc-head nav a'), a => a.getAttribute('href')).join('|')`)) === '/|/cv/');

// Direct URLs and refresh use the actual static server, not a history fallback dev server.
for (const [route, title] of [['/', 'Dan Westmorland'], ['/cv/', 'CV · Dan Westmorland'], ['/privacy/', 'Privacy · Dan Westmorland'], ['/terms/', 'Terms · Dan Westmorland']]) {
  await fresh(route);
  check(`direct ${route}`, (await state()).title === title && (await state()).pathname === route);
  await send('Page.reload'); await sleep(1000);
  check(`refresh ${route}`, (await state()).title === title && (await state()).pathname === route);
}
for (const p of ['home', 'cv', 'privacy', 'terms']) {
  await fresh(`/#/${p}`);
  check(`legacy #/${p} compatible`, (await state()).title === (p === 'home' ? 'Dan Westmorland' : `${p === 'cv' ? 'CV' : p[0].toUpperCase() + p.slice(1)} · Dan Westmorland`));
}
await fresh('/');
await ev(`document.querySelector('.cc-foot a[href="/privacy/"]').click()`); await sleep(300);
await ev(`document.querySelector('.cc-foot a[href="/terms/"]').click()`); await sleep(300);
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

// Accepted Home -> CV -> legal journey and browser history.
await fresh('/');
await ev(`document.querySelector('.home-cv').click()`); await sleep(300);
check('Read the CV opens the native CV', (await state()).pathname === '/cv/');
await ev(`document.querySelector('.cc-foot a[href="/privacy/"]').click()`); await sleep(300);
await ev('history.back()'); await sleep(300);
check('Back from legal restores CV and focus', (await state()).title === 'CV · Dan Westmorland' && await ev(`document.activeElement.id === 'main'`));
await ev('history.forward()'); await sleep(300);
check('Forward from CV restores legal', (await state()).title === 'Privacy · Dan Westmorland');
for (const route of ['/', '/cv/', '/privacy/', '/terms/']) {
  await fresh(route);
  const expectedProfiles = ['https://uk.linkedin.com/in/danwestmorland', 'https://github.com/Westmorland', 'https://medium.com/@westmorland'];
  const links = await ev(`Array.from(document.querySelectorAll('a[href^="https:"]'), a => a.href)`);
  const expected = ['/', '/cv/'].includes(route) ? [...expectedProfiles, ...expectedProfiles] : expectedProfiles;
  check(`exact social navigation links ${route}`, JSON.stringify(links) === JSON.stringify(expected));
  check(`no forms or stored data ${route}`, await ev(`document.querySelectorAll('form, input, iframe').length === 0 && document.cookie === '' && localStorage.length === 0 && sessionStorage.length === 0`));
}
// Every direct page remains useful with script execution disabled.
await send('Emulation.setScriptExecutionDisabled', { value: true });
for (const route of ['/', '/cv/', '/privacy/', '/terms/']) {
  await fresh(route);
  const markup = (await send('DOM.getDocument')).result.root;
  const main = (await send('DOM.querySelector', { nodeId: markup.nodeId, selector: 'main' })).result.nodeId;
  const html = (await send('DOM.getOuterHTML', { nodeId: main })).result.outerHTML;
  if (route === '/cv/') check('no-JavaScript expanded career', ['Training Facilitator', 'Creating Careers / vision2learn', 'Senior Software Consultant Lead', 'Responsible for on-site employee training at Tata Steel.'].every(t => html.includes(t)) && !html.includes('Training Manager'));
  check(`no-JavaScript page ${route}`, html.includes(route === '/' ? 'Agentic AI software delivery' : route === '/cv/' ? 'Software lead and architect' : route === '/privacy/' ? 'Visiting this website' : 'The application'));
}
await fresh('/');
for (const [selector, route, expectedText] of [['.home-cv', '/cv/', 'Software lead and architect'], ['.cc-foot a[href="/privacy/"]', '/privacy/', 'Visiting this website'], ['.cc-foot a[href="/terms/"]', '/terms/', 'The application'], ['.cc-head a[href="/"]', '/', 'Agentic AI software delivery']]) {
  const rootNode = (await send('DOM.getDocument')).result.root.nodeId;
  const nodeId = (await send('DOM.querySelector', { nodeId: rootNode, selector })).result.nodeId;
  await send('DOM.scrollIntoViewIfNeeded', { nodeId });
  const box = (await send('DOM.getBoxModel', { nodeId })).result.model.content;
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: (box[0] + box[2]) / 2, y: (box[1] + box[5]) / 2, button: 'left', clickCount: 1 });
  await sleep(500);
  const history = (await send('Page.getNavigationHistory')).result;
  const currentRoot = (await send('DOM.getDocument')).result.root.nodeId;
  const mainId = (await send('DOM.querySelector', { nodeId: currentRoot, selector: 'main' })).result.nodeId;
  const markup = (await send('DOM.getOuterHTML', { nodeId: mainId })).result.outerHTML;
  check(`no-JavaScript mouse navigation ${route}`, history.entries[history.currentIndex].url === server.url + route && markup.includes(expectedText));
}
await send('Emulation.setScriptExecutionDisabled', { value: false });
await fresh('/');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
check('reduced motion leaves heading visible without animation', await ev(`Array.from(document.querySelectorAll('.cc-giant span')).every(e => getComputedStyle(e).animationName === 'none' && getComputedStyle(e).opacity === '1')`));
await send('Emulation.setEmulatedMedia', { features: [] });
// Fresh navigation/media changes can leave font decoding in flight. Explicitly
// load both required faces; fonts.ready alone also resolves after load failures.
const fonts = await ev(`(async () => {
  const required = ['800 32px "Bricolage Grotesque"', '400 13px "JetBrains Mono"'];
  const started = performance.now();
  let timer, loaded = [], error = null;
  try {
    // Keep this deadline below the harness's 10-second CDP command timeout.
    await Promise.race([
      Promise.all(required.map(font => document.fonts.load(font))).then(async faces => {
        loaded = faces;
        await document.fonts.ready;
      }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Font readiness deadline exceeded (5000ms)')), 5000); }),
    ]);
  } catch (failure) { error = String(failure); }
  finally { clearTimeout(timer); }
  const checks = required.map(font => document.fonts.check(font));
  return {
    ok: !error && loaded.length === required.length && loaded.every(faces => faces.length > 0 && faces.every(face => face.status === 'loaded')) && checks.every(Boolean),
    error, elapsedMs: Math.round(performance.now() - started), status: document.fonts.status,
    checks, faces: Array.from(document.fonts, face => ({family: face.family, weight: face.weight, status: face.status})),
  };
})()`);
check('local display and label fonts loaded', fonts.ok, JSON.stringify(fonts));

// Overflow at narrow widths
for (const w of [320, 375, 390, 768, 1440]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 2, mobile: true });
  for (const p of ['home', 'cv', 'privacy', 'terms']) {
    await ev(`location.hash = '#/${p}'`); await sleep(900);
    const ov = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check(`${w}px no horizontal overflow ${p}`, ov <= 0, `overflow=${ov}px`);
    if (w <= 768) check(`${w}px practical navigation targets ${p}`, await ev(`Array.from(document.querySelectorAll('.cc-head nav a, .pl a, .home-cv, .cc-foot nav a')).every(a => a.getBoundingClientRect().height >= 44)`));
    if (p === 'cv') {
      const career = await ev(`(() => {
        const rows = [...document.querySelectorAll('[aria-labelledby="b-exp"] article')];
        return { text: rows.map(r => r.innerText).join('\\n'), titles: rows.map(r => r.querySelector('h3').textContent), readable: rows.every((r, i) => {
          const box = r.getBoundingClientRect();
          return box.width > 0 && (i === 0 || box.top >= rows[i - 1].getBoundingClientRect().bottom) &&
            [...r.querySelectorAll('h3, p, li')].every(e => {
              const b = e.getBoundingClientRect(), s = getComputedStyle(e);
              return b.width > 0 && b.height > 0 && b.left >= 0 && b.right <= innerWidth && e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1 && s.visibility === 'visible' && s.opacity === '1';
            });
        }) };
      })()`);
      const tata = await ev(`(() => {
        const row = [...document.querySelectorAll('[aria-labelledby="b-exp"] article')].find(r => r.querySelector('.b-org')?.textContent === 'Tata Steel');
        return row && {title: row.querySelector('h3').textContent, description: row.querySelector('div > p:last-child').textContent, text: row.innerText};
      })()`);
      check(`${w}px Tata Steel exact training-only copy`, tata?.title === 'Training Facilitator' && tata.description === 'Responsible for on-site employee training at Tata Steel.' && !/design|develop|software|courses?|manag|400|achievement/i.test(tata.text), JSON.stringify(tata));
      check(`${w}px all expanded career entries readable`, career.readable && JSON.stringify(career.titles) === JSON.stringify(['Software Team Lead', 'Developer and Lead Software Developer', 'Developer', 'Training Facilitator']));
      check(`${w}px career details and date exclusions`, ['Senior Software Consultant and Senior Software Consultant Lead', 'Creating Careers / vision2learn', 'Responsible for on-site employee training at Tata Steel.', 'client advice and mentoring', 'improve internal communication', 'Worked with ASP.NET', '2022 to now', 'since 2019'].every(t => career.text.includes(t)) && !/Training Manager|2010|2011|2012|2014|2018|disputed|indexed/.test(career.text));
      check(`${w}px CV reading/layout order`, await ev(`(() => { const main = document.querySelector('.b-main'), side = document.querySelector('.b-side'); return !!(main.compareDocumentPosition(side) & Node.DOCUMENT_POSITION_FOLLOWING) && (${w} <= 860 ? side.getBoundingClientRect().top >= main.getBoundingClientRect().bottom : side.getBoundingClientRect().left < main.getBoundingClientRect().left); })()`));
    }
  }
}

// Screenshots: full page, desktop 1440 and mobile 390
await mkdir(output, { recursive: true });
for (const [label, w, dsf, mobile] of [['desktop', 1440, 1, false], ['mobile', 390, 2, true]]) {
  for (const p of ['home', 'cv', 'privacy', 'terms']) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: dsf, mobile });
    await ev(`location.hash = '#/x'`); await sleep(100);
    await ev(`location.hash = '#/${p}'`); await sleep(1300);
    // Capture the document without enlarging the viewport: vh-based spacing must
    // not change between measuring height and taking the screenshot.
    const metrics = (await send('Page.getLayoutMetrics')).result.cssContentSize;
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: metrics.width, height: metrics.height, scale: 1 } });
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
