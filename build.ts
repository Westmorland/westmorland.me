import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { render } from './src/render.tsx';
import { inlineContent } from './scripts/build-html.ts';
import sourceConfig from './staticwebapp.config.json';
import { PAGES } from './src/routing.ts';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/licenses', { recursive: true });
const common = { bundle: true, minify: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info' } satisfies esbuild.BuildOptions;
await esbuild.build({ ...common, entryPoints: ['src/main.tsx'], format: 'iife', target: ['es2020'], legalComments: 'none', loader: { '.woff2': 'dataurl', '.woff': 'empty' }, outdir: '.build/client' });
const js = await readFile('.build/client/main.js', 'utf8');
const css = await readFile('.build/client/main.css', 'utf8');
for (const page of PAGES) {
  const dir = `dist${page.path}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}index.html`, `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Dan Westmorland. Software lead.">
<link rel="icon" href="data:,">
<title>${page.title}</title>
<style>${css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
<div id="root">${render(page.id)}</div>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`);
  console.log(`Built ${dir}index.html`);
}
for (const name of ['bricolage-grotesque', 'jetbrains-mono']) {
  await copyFile(`node_modules/@fontsource/${name}/LICENSE`, `dist/licenses/${name}-OFL.txt`);
}
for (const name of ['react', 'react-dom', 'scheduler']) {
  await copyFile(`node_modules/${name}/LICENSE`, `dist/licenses/${name}-MIT.txt`);
}
// Hash the escaped bytes actually emitted, not the unescaped bundler input.
const hash = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const html = await readFile('dist/index.html', 'utf8');
const script = inlineContent(html, 'script');
const style = inlineContent(html, 'style');
const policy = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(style)}; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
const config = { ...sourceConfig, globalHeaders: { ...sourceConfig.globalHeaders, 'Content-Security-Policy': policy } };
await writeFile('dist/staticwebapp.config.json', JSON.stringify(config, null, 2) + '\n');
await rm('.build', { recursive: true, force: true });
