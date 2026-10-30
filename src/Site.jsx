import React, { useEffect, useRef, useState } from 'react';
import { site, home, privacy, terms } from './content.js';
import { PAGES, readPage } from './routing.js';

const pad = (n) => String(n).padStart(2, '0');
export function Site({ initialPage }) {
  const [page, setPage] = useState(initialPage);
  const mainRef = useRef(null);
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
    document.title = PAGES.find((p) => p.id === page).title;
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [page]);

  const navigate = (event) => {
    const anchor = event.target.closest('a');
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
          {PAGES.map((p, i) => (
            <a key={p.id} href={p.path} aria-current={page === p.id ? 'page' : undefined} data-testid={`nav-${p.id}`}>
              <span>{pad(i + 1)}</span> {p.name}
            </a>
          ))}
        </nav>
      </header>
      <div className="cc-rail" aria-hidden="true">
        {site.domain} / {site.role}
      </div>
      <main id="main" ref={mainRef} tabIndex={-1} key={page}>
        {page === 'home' && <Home />}
        {page === 'privacy' && <Policy doc={privacy} prefix="p" />}
        {page === 'terms' && <Policy doc={terms} prefix="t" />}
      </main>
      <footer className="cc-foot">
        <span>© {site.name}</span>
        <nav aria-label="Legal">
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
        </nav>
      </footer>
    </div>
  );
}

function Home() {
  return (
    <div className="cc-home">
      <h1 className="cc-giant" aria-label={`${site.name}. ${site.role}.`}>
        {home.giant.map((w, i) => (
          <span key={w}>
            {w}
            {i === home.giant.length - 1 && <b>.</b>}
          </span>
        ))}
      </h1>
      <div className="cc-introwrap">
        <p className="cc-who">{site.name}</p>
        <p className="cc-strap">{home.strap}</p>
        <p className="cc-intro">{home.intro}</p>
      </div>
      <section className="cc-focus" aria-labelledby="cc-focus-h">
        <h2 id="cc-focus-h">Focus</h2>
        <ol>
          {home.focus.map((f, i) => (
            <li key={f.title}>
              <span className="cc-focus-num" aria-hidden="true">{pad(i + 1)}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Policy({ doc, prefix }) {
  return (
    <div className="cc-policy">
      <h1 className="cc-giant cc-giant-sm">
        <span>
          {doc.title.toLowerCase()}
          <b>.</b>
        </span>
      </h1>
      <p className="cc-intro cc-intro-policy">{doc.intro}</p>
      {doc.sections.map((s, i) => (
        <section key={s.id} id={`${prefix}-${s.id}`} className="cc-psec" aria-labelledby={`${prefix}-${s.id}-h`}>
          <div className="cc-psec-num" aria-hidden="true">{pad(i + 1)}</div>
          <div className="cc-psec-body">
            <h2 id={`${prefix}-${s.id}-h`}>{s.title}</h2>
            {s.body.map((b) => (
              <p key={b}>
                {s.link ? <>How information is used is described in the <a href="/privacy/">privacy notice</a>.</> : b}
              </p>
            ))}
            {s.list && (
              <dl>
                {s.list.map((l) => (
                  <div key={l.term}>
                    <dt>{l.term}</dt>
                    <dd>{l.text}</dd>
                  </div>
                ))}
              </dl>
            )}
            {s.after && s.after.map((b) => <p key={b} className="cc-after">{b}</p>)}
          </div>
        </section>
      ))}
    </div>
  );
}
