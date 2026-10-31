import React, { useEffect, useRef, useState } from 'react';
import { site, home, focus, profiles, ai, cv, privacy, terms } from './content.js';
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
        <div className="home-links">
          <a className="home-cv" href="/cv/" data-testid="home-cv">Read the CV<span aria-hidden="true"> →</span></a>
          <ProfileLinks context="home" />
        </div>
      </div>
      <section className="cc-focus" aria-labelledby="cc-focus-h">
        <h2 id="cc-focus-h">Focus</h2>
        <ol>
          {focus.map((f, i) => (
            <li key={f.title} className={f.isAi ? 'is-ai' : undefined}>
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

function ProfileLink({ profile, context }) {
  return <a href={profile.href} rel="noopener" className={context} data-testid={`${context}-${profile.id}`}>{profile.label}<span className="ext" aria-hidden="true">↗</span></a>;
}

function ProfileLinks({ context }) {
  return <ul className={`pl ${context}`} aria-label="Profiles">{profiles.map((profile) => <li key={profile.id}><ProfileLink profile={profile} context={context} /></li>)}</ul>;
}

// Main content precedes the summary in DOM/mobile reading order.
function CV() {
  return (
    <div className="opt-b">
      <div className="b-top">
        <h1><span className="b-name">{site.name}</span><span className="b-role">{cv.headline}<b>.</b></span></h1>
        <div className="b-id">
          <dl className="b-facts">
            <div><dt>Now</dt><dd>{cv.current.title}, {cv.current.org}</dd></div>
            <div><dt>Based</dt><dd>{site.location}</dd></div>
          </dl>
          <ProfileLinks context="cv" />
        </div>
      </div>
      <div className="b-grid">
        <div className="b-main">
          <section aria-labelledby="b-prof">
            <h2 id="b-prof">Profile</h2><p className="b-lede">{cv.lede}</p>
            {cv.profile.map((text) => <p key={text}>{text}</p>)}
          </section>
          <section className="b-ai" aria-labelledby="b-ai">
            <h2 id="b-ai">{ai.heading}</h2><p className="b-ai-body">{ai.body}</p>
            <ol className="b-steps">{ai.steps.map(([title, description], i) => <li key={title}><span aria-hidden="true">{pad(i + 1)}</span><strong>{title}</strong> {description}</li>)}</ol>
          </section>
          <section aria-labelledby="b-exp">
            <h2 id="b-exp">Experience</h2>
            <article className="b-row">
              <p className="b-when">{cv.current.short}</p>
              <div>
                <h3>{cv.current.title}</h3><p className="b-org">{cv.current.org}<span> · {cv.current.since}</span></p>
                <p className="b-workplace">{cv.current.workplace}</p>
                <p>{cv.waterstons.progression}</p>
                <p>{cv.waterstons.description}</p>
                <ul>{cv.current.points.map((text) => <li key={text}>{text}</li>)}</ul>
              </div>
            </article>
            {cv.earlier.map((job) => (
              <article className="b-row b-earlier" key={job.org}>
                <p className="b-when">Earlier</p>
                <div>
                  <h3>{job.title}</h3><p className="b-org">{job.org}</p>
                  <p>{job.description}</p>
                </div>
              </article>
            ))}
          </section>
        </div>
        <aside className="b-side" aria-label="Summary">
          <section aria-labelledby="b-focus">
            <h2 id="b-focus">Focus</h2>
            <ol className="b-focus">{focus.map((item, i) => <li key={item.title} className={item.isAi ? 'is-ai' : undefined}><span aria-hidden="true">{pad(i + 1)}</span><div><strong>{item.title}</strong><p>{item.cv}</p></div></li>)}</ol>
          </section>
          <section aria-labelledby="b-stack">
            <h2 id="b-stack">Technical strengths</h2><ul className="b-stack">{cv.stack.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section aria-labelledby="b-edu">
            <h2 id="b-edu">Education</h2>{cv.education.map((item) => <p key={item.award} className="b-edu">{item.award}<br /><span>{item.place}</span></p>)}
          </section>
        </aside>
      </div>
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
