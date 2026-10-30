import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export async function startServer() {
  await mkdir('test-results', { recursive: true });
  const temp = await mkdtemp(path.resolve('test-results/server-'));
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  // Same packaged configuration, with only the local document-root substitution.
  const config = (await readFile('httpd.conf', 'utf8')).replaceAll('/site/', `${path.resolve('dist')}/`);
  await writeFile(`${temp}/httpd.conf`, config);
  const proc = spawn(process.env.BUSYBOX || 'busybox', ['httpd', '-f', '-p', `127.0.0.1:${port}`, '-h', path.resolve('dist'), '-c', `${temp}/httpd.conf`], { stdio: ['ignore', 'ignore', 'pipe'] });
  let failure;
  proc.on('error', (error) => { failure = error; });
  proc.stderr.on('data', (data) => { failure = new Error(data.toString()); });
  const stop = async () => {
    if (proc.pid && proc.exitCode === null && proc.signalCode === null) {
      const exited = once(proc, 'exit');
      proc.kill();
      await exited;
    }
    await rm(temp, { recursive: true, force: true });
  };
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (failure || proc.exitCode !== null) { await stop(); throw failure || new Error('Static server exited'); }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.status === 200 && !failure) return { url, stop };
    } catch {}
    await sleep(100);
  }
  await stop();
  throw new Error('Static server did not become ready');
}
