export const PAGES = [
  { id: 'home', name: 'Home', path: '/', title: 'Dan Westmorland' },
  { id: 'cv', name: 'CV', path: '/cv/', title: 'CV · Dan Westmorland' },
  { id: 'privacy', name: 'Privacy', path: '/privacy/', title: 'Privacy · Dan Westmorland' },
  { id: 'terms', name: 'Terms', path: '/terms/', title: 'Terms · Dan Westmorland' },
];

export function readPage({ pathname, hash }) {
  // Old shared #/page links take precedence; ordinary document fragments do not.
  const legacy = hash.startsWith('#/') || /^#(home|privacy|terms)$/.test(hash);
  const id = legacy
    ? hash.replace(/^#\/?/, '').split(/[/?]/)[0]
    : pathname.replace(/^\/|\/$/g, '') || 'home';
  return PAGES.some((page) => page.id === id) ? id : 'home';
}
