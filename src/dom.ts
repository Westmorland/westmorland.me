export function requireRoot(document: Pick<Document, 'getElementById'>): HTMLElement {
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root mount element');
  return root;
}
