import { site, home, focus, selectedExperience } from './content.ts';
import { ProfileLinks } from './ProfileLinks.tsx';
import { pad } from './format.ts';

export function Home() {
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
      <section className="cc-experience" aria-labelledby="cc-experience-h">
        <h2 id="cc-experience-h">{selectedExperience.heading}</h2>
        <p className="cc-experience-intro">{selectedExperience.intro}</p>
        <div className="cc-experience-cards">
          {selectedExperience.cards.map((card) => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
