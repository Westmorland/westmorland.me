// Inspect the escaped HTML bytes that will actually be delivered to browsers.
export function inlineContent(html: string, tag: 'script' | 'style'): string {
  const match = html.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (match?.[1] === undefined) throw new Error(`Missing inline ${tag} in generated HTML`);
  return match[1];
}
