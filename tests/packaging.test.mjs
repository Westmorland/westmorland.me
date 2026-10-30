import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('image definition: pinned offline base, revision label, non-root baked root', async () => {
  const docker = await readFile('Dockerfile', 'utf8');
  assert.match(docker, /^FROM busybox@sha256:[a-f0-9]{64}\n/);
  assert.match(docker, /ARG SOURCE_REVISION\nLABEL org.opencontainers.image.revision=\$SOURCE_REVISION/);
  assert.match(docker, /COPY dist\/ \/site\//);
  assert.match(docker, /USER 1000:1000/);
  assert.match(docker, /EXPOSE 8080/);
  assert.ok(!/^RUN /m.test(docker), 'no build-time installers or downloads');
  assert.ok(!docker.includes('/www'), 'runtime tmpfs must not hide the content');
  assert.match(docker, /CMD \["httpd", "-f", "-p", "8080", "-h", "\/site", "-c", "\/etc\/site-httpd.conf"\]/);
});
test('image context has only explicit packaging inputs', async () => {
  assert.equal(await readFile('.dockerignore', 'utf8'), '*\n!Dockerfile\n!httpd.conf\n!dist/\n!dist/**\n');
});
test('server missing-path response uses the baked Home page', async () => {
  assert.equal(await readFile('httpd.conf', 'utf8'), 'E404:/site/index.html\n');
});
