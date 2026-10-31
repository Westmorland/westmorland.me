import type { PolicyDocument } from './content.ts';
import { pad } from './format.ts';

export function Policy({ doc, prefix }: { doc: PolicyDocument; prefix: 'p' | 't' }) {
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
