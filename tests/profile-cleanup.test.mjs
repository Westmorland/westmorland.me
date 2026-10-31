// Exercise the actual E2E finally block in isolated processes. Filesystem races
// are controlled at rmdir, not by timing a background writer or retrying a suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.argv[2] === '--cleanup-control') {
  const mode = process.argv[3];
  const source = fs.readFileSync(process.env.CLEANUP_SOURCE || new URL('./e2e.mjs', import.meta.url), 'utf8');
  const marker = '} finally {\n  clearTimeout(watchdog);';
  assert.equal(source.split(marker).length, 2, 'locate exactly the harness finalizer');
  const finalizer = source.slice(source.indexOf(marker));
  fs.mkdirSync('test-results', { recursive: true });
  const profile = fs.mkdtempSync('test-results/cleanup-control-');
  const outside = fs.mkdtempSync('test-results/cleanup-neighbour-');
  fs.writeFileSync(`${profile}/seed`, 'owned fixture');
  fs.writeFileSync(`${outside}/keep`, 'must survive');
  // A symlink must be unlinked, never followed outside the owned profile.
  fs.symlinkSync(fs.realpathSync(outside), `${profile}/outside`);
  const originalRmdir = fs.rmdir;
  let calls = 0;
  const errors = [];
  // Install before the first rm loads Node's recursive remover in this process.
  fs.rmdir = function (target, ...args) {
    const callback = args.pop();
    if (String(target) === profile) {
      calls++;
      if (mode === 'denied') {
        const error = Object.assign(new Error('controlled EACCES'), { code: 'EACCES' });
        errors.push(error.code);
        queueMicrotask(() => callback(error));
        return;
      }
      // The second rmdir follows enumeration/unlink. A new directory entry at
      // that exact boundary produces a REAL kernel ENOTEMPTY, deterministically.
      if (mode === 'exhausted' || calls === 2) fs.writeFileSync(`${profile}/late-${calls}`, 'late entry');
    }
    originalRmdir.call(fs, target, ...args, (error) => {
      if (String(target) === profile && error) errors.push(error.code);
      callback(error);
    });
  };
  const { rm } = await import('node:fs/promises');
  const { once, EventEmitter } = await import('node:events');
  const proc = new EventEmitter();
  Object.assign(proc, { exitCode: null, signalCode: null, kill() {
    queueMicrotask(() => { proc.signalCode = 'SIGTERM'; proc.emit('exit', null, 'SIGTERM'); });
  } });
  let stopped = false;
  const server = { async stop() { assert.equal(proc.signalCode, 'SIGTERM'); stopped = true; } };
  const remove = async (target, options) => {
    assert.equal(stopped, true, 'server stops after browser exit, before removal');
    assert.equal(target, profile, 'only the owned profile is removed');
    return rm(target, options);
  };
  const body = async () => {
    if (mode === 'test-failure') process.exitCode = 17;
    if (mode === 'browser-failure') throw new Error('controlled browser failure');
  };
  const run = new Function('body', 'watchdog', 'ws', 'proc', 'spawnError', 'once', 'server', 'rm', 'profile',
    `return (async () => { try { await body(); ${finalizer} })();`);
  const started = performance.now();
  let failure;
  try {
    await run(body, undefined, undefined, proc, undefined, once, server, remove, profile);
  } catch (error) {
    failure = { code: error.code, message: error.message };
    process.exitCode = 1;
  } finally {
    const removed = !fs.existsSync(profile);
    assert.equal(fs.readFileSync(`${outside}/keep`, 'utf8'), 'must survive');
    console.log(JSON.stringify({ mode, calls, errors, removed, stopped, failure, elapsedMs: performance.now() - started }));
    // Exact disposable fixtures only. Synchronous cleanup does not use the hook.
    fs.rmdir = originalRmdir;
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
} else {
  const { test } = await import('node:test');
  const control = (mode) => {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--cleanup-control', mode], { encoding: 'utf8', timeout: 10000 });
    assert.ifError(child.error);
    assert.equal(child.signal, null, child.stderr);
    const result = JSON.parse(child.stdout.trim());
    console.log(JSON.stringify({ status: child.status, ...result }));
    return { status: child.status, ...result };
  };
  test('profile cleanup retries a real late-entry ENOTEMPTY and removes only its profile', () => {
    const result = control('transient');
    assert.equal(result.status, 0, JSON.stringify(result));
    assert.equal(result.removed, true);
    assert.ok(result.errors.includes('ENOTEMPTY'));
    assert.equal(result.calls, 4);
  });
  test('profile cleanup exhausts its three retries and propagates ENOTEMPTY', () => {
    const result = control('exhausted');
    assert.equal(result.status, 1);
    assert.equal(result.failure.code, 'ENOTEMPTY');
    assert.equal(result.removed, false);
    assert.equal(result.calls, 8, 'initial attempt plus three retries, two rmdir calls each');
  });
  test('profile cleanup propagates a non-retryable permission error immediately', () => {
    const result = control('denied');
    assert.equal(result.status, 1);
    assert.equal(result.failure.code, 'EACCES');
    assert.equal(result.removed, false);
    assert.equal(result.calls, 1);
  });
  test('successful cleanup cannot turn a failed browser assertion exit code green', () => {
    const result = control('test-failure');
    assert.equal(result.status, 17);
    assert.equal(result.removed, true);
    assert.equal(result.failure, undefined);
  });
  test('successful cleanup preserves a thrown browser failure', () => {
    const result = control('browser-failure');
    assert.equal(result.status, 1);
    assert.equal(result.removed, true);
    assert.equal(result.failure.message, 'controlled browser failure');
  });
}
