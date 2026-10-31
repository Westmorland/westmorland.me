import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { site, profiles, privacy, terms } from './content.ts';
import { Home } from './Home.tsx';
import { CV } from './CV.tsx';
import { Policy } from './Policy.tsx';
import { ProfileLink } from './ProfileLinks.tsx';
import { pad } from './format.ts';
import { PAGES, readPage, pageTitle } from './routing.ts';
import type { PageId } from './routing.ts';

export function Site({ initialPage }: { initialPage: PageId }) {
  const [page, setPage] = useState(initialPage);
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const on = () => setPage(readPage(window.location));
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);

  useEffect(() => {
    document.title = pageTitle(page);
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [page]);

  const navigate = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = event.target instanceof Element ? event.target.closest('a') : null;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !anchor || anchor.target || anchor.hasAttribute('download')) return;
    const route = PAGES.find((p) => p.path === anchor.getAttribute('href'));
    if (!route) return;
    event.preventDefault();
    window.history.pushState(null, '', route.path);
    setPage(route.id);
  };

  return (
    <div className="cc" onClick={navigate}>
      <a className="cc-skip" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
        Skip to content
      </a>
      <header className="cc-head">
        <a href="/" className="cc-name">{site.name.toUpperCase()}</a>
        <nav aria-label="Site">
          {PAGES.filter((p) => ['home', 'cv'].includes(p.id)).map((p, i) => (
            <a key={p.id} href={p.path} aria-current={page === p.id ? 'page' : undefined} data-testid={`nav-${p.id}`}>
              <span>{pad(i + 1)}</span> {p.name}
            </a>
          ))}
        </nav>
      </header>
      <div className="cc-rail" aria-hidden="true">
        {site.domain} / {page === 'cv' ? 'cv' : site.role}
      </div>
      <main id="main" ref={mainRef} tabIndex={-1} key={page}>
        {page === 'home' && <Home />}
        {page === 'cv' && <CV />}
        {page === 'privacy' && <Policy doc={privacy} prefix="p" />}
        {page === 'terms' && <Policy doc={terms} prefix="t" />}
      </main>
      <footer className="cc-foot">
        <span>© {site.name}</span>
        <nav aria-label="Profiles" className="foot-profiles">
          {profiles.map((profile) => <ProfileLink key={profile.id} profile={profile} context="foot" />)}
        </nav>
        <nav aria-label="Legal" className="foot-legal">
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
        </nav>
      </footer>
    </div>
  );
}
