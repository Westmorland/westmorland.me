// A real HTTP header wrapper, not an Azure routing emulator.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';

export async function withSecurityHeaders(upstream) {
  const { globalHeaders } = JSON.parse(await readFile('dist/staticwebapp.config.json', 'utf8'));
  const proxy = createServer(async (request, response) => {
    try {
      const source = await fetch(upstream.url + request.url, { redirect: 'manual' });
      const headers = Object.fromEntries(source.headers);
      delete headers['transfer-encoding'];
      response.writeHead(source.status, { ...headers, ...globalHeaders });
      response.end(Buffer.from(await source.arrayBuffer()));
    } catch {
      response.writeHead(502); response.end();
    }
  });
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  return {
    url: `http://127.0.0.1:${proxy.address().port}`,
    stop: async () => {
      await new Promise((resolve) => proxy.close(resolve));
      await upstream.stop();
    },
  };
}
