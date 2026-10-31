export const PAGES = [
  { id: 'home', name: 'Home', path: '/', title: 'Dan Westmorland' },
  { id: 'cv', name: 'CV', path: '/cv/', title: 'CV · Dan Westmorland' },
  { id: 'privacy', name: 'Privacy', path: '/privacy/', title: 'Privacy · Dan Westmorland' },
  { id: 'terms', name: 'Terms', path: '/terms/', title: 'Terms · Dan Westmorland' },
] as const;

export type PageId = (typeof PAGES)[number]['id'];

export function pageTitle(id: PageId): string {
  return (PAGES.find(page => page.id === id) ?? PAGES[0]).title;
}

export function readPage({ pathname, hash }: Pick<Location, 'pathname' | 'hash'>): PageId {
  // Old shared #/page links take precedence; ordinary document fragments do not.
  const legacy = hash.startsWith('#/') || /^#(home|privacy|terms)$/.test(hash);
  const id = legacy
    ? hash.replace(/^#\/?/, '').split(/[/?]/)[0]
    : pathname.replace(/^\/|\/$/g, '') || 'home';
  return PAGES.find((page) => page.id === id)?.id ?? 'home';
}
