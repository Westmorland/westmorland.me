import { site, cv, ai, focus } from './content.ts';
import { ProfileLinks } from './ProfileLinks.tsx';
import { pad } from './format.ts';

function RoleYears({ roles }: { roles: { startYear: string; title: string }[] }) {
  return <ul className="b-roles">{roles.map(({ startYear, title }) => (
    <li key={title}><time className="b-when" dateTime={startYear}>{startYear}</time><strong>{title}</strong></li>
  ))}</ul>;
}

// Main content precedes the summary in DOM/mobile reading order.
export function CV() {
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
              <div>
                <h3 className="b-org">{cv.current.org}</h3>
                <RoleYears roles={[cv.current, ...cv.waterstons.roles]} />
                <p className="b-workplace">{cv.current.workplace}</p>
                <p>{cv.waterstons.description}</p>
                <ul>{cv.current.points.map((text) => <li key={text}>{text}</li>)}</ul>
              </div>
            </article>
            {cv.earlier.map((job) => (
              <article className="b-row b-earlier" key={job.org}>
                <div>
                  <h3 className="b-org">{job.org}</h3>
                  <RoleYears roles={job.roles} />
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
