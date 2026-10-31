import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { home, cv } from '../src/content.js';

const hrefs = ['https://uk.linkedin.com/in/danwestmorland', 'https://github.com/Westmorland', 'https://medium.com/@westmorland'];
const main = async (page) => (await readFile(`dist/${page === 'home' ? '' : page + '/'}index.html`, 'utf8')).match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];

test('Home uses the accepted AI-aware introduction', () => {
  assert.equal(home.strap, 'Software leadership, architecture and agentic AI delivery.');
  assert.equal(home.intro, 'I lead developers, shape architecture and help turn ideas into practical, maintainable software. That includes hands-on work with AI agents across delivery, with review, testing and human judgement built in.');
});
test('Home has exactly the accepted four Focus entries and a native CV link', async () => {
  const html = await main('home');
  assert.deepEqual([...html.matchAll(/<h3>(.*?)<\/h3>/g)].map(m => m[1]), ['Architecture', 'Delivery', 'People', 'Agentic AI software delivery']);
  assert.match(html, /href="\/cv\/"[^>]*>Read the CV/);
});
test('CV statically renders the accepted sections, team and location', async () => {
  const html = await main('cv');
  assert.deepEqual([...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map(m => m[1]), ['Profile', 'Agentic AI delivery', 'Experience', 'Focus', 'Technical strengths', 'Education']);
  for (const text of ['Software lead and architect', 'Based in Newcastle upon Tyne, I work in Durham as a Software Team Lead at Waterstons, within the Digital Solutions software development team.', '2022 to now', 'since 2019', 'Oak Intranet', 'Creating Careers / vision2learn', 'Tata Steel', 'BSc Computer Studies', 'Teesside University', 'People own priorities, acceptance and release.']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/>C# and .NET</g) || []).length, 1);
});
test('CV career detail uses the agreed titles and factual descriptions without disputed dates', async () => {
  const expected = [
    { org: 'Oak Intranet', title: 'Developer and Lead Software Developer', description: 'Worked on the development of Oak’s intranet platform, helping organisations connect their people, share information and improve internal communication. Progressed from platform development to Lead Software Developer.' },
    { org: 'Creating Careers / vision2learn', title: 'Developer', description: 'Developed functionality for the vision2learn e-learning platform, supporting learners studying online and improving the efficiency of the operations team. Worked with ASP.NET to extend the platform’s capabilities.' },
    { org: 'Tata Steel', title: 'Training Facilitator', description: 'Responsible for on-site employee training at Tata Steel.' },
  ];
  assert.deepEqual(cv.earlier, expected);
  assert.deepEqual(cv.waterstons, {
    progression: 'Earlier roles: Senior Software Consultant and Senior Software Consultant Lead.',
    description: 'My work at Waterstons spans hands-on development, technical leadership, architecture, client advice and mentoring.',
  });
  const html = await main('cv');
  const experience = html.match(/<section aria-labelledby="b-exp">([\s\S]*?)<\/section>/)[1];
  assert.equal((experience.match(/<article /g) || []).length, 4);
  for (const job of expected) {
    const article = [...experience.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].find(m => m[1].includes(job.org))?.[1];
    assert.ok(article, job.org);
    for (const text of Object.values(job)) assert.ok(article.includes(text), text);
    assert.doesNotMatch(article, /\b(?:19|20)\d{2}\b/);
  }
  for (const text of Object.values(cv.waterstons)) assert.ok(experience.includes(text), text);
  assert.doesNotMatch(experience, /Training Manager|disputed|indexed|uncertain|April|August|November|2010|2011|2012|2014|2018|2020|2021/i);
  assert.equal((experience.match(/2022/g) || []).length, 1);
  assert.equal((experience.match(/2019/g) || []).length, 1);
});
test('Tata Steel is training facilitation only in source and generated CV', async () => {
  const tata = cv.earlier.filter(job => job.org === 'Tata Steel');
  assert.equal(tata.length, 1);
  const article = [...(await main('cv')).matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].find(m => m[1].includes('Tata Steel'))?.[1];
  assert.ok(article);
  for (const text of [JSON.stringify(tata[0]), article]) {
    assert.doesNotMatch(text, /design|develop|software|courses?|manag|400|achievement/i);
  }
  assert.deepEqual(tata[0], { org: 'Tata Steel', title: 'Training Facilitator', description: 'Responsible for on-site employee training at Tata Steel.' });
  assert.match(article, /<h3>Training Facilitator<\/h3>/);
  assert.match(article, /<p>Responsible for on-site employee training at Tata Steel\.<\/p>/);
});
for (const page of ['home', 'cv', 'privacy', 'terms']) {
  test(`${page}: Home/CV header, footer-only legal navigation and exact social hrefs`, async () => {
    const html = await readFile(`dist/${page === 'home' ? '' : page + '/'}index.html`, 'utf8');
    const header = html.match(/<header[\s\S]*?<\/header>/)[0];
    assert.deepEqual([...header.matchAll(/data-testid="nav-(.*?)"/g)].map(m => m[1]), ['home', 'cv']);
    assert.doesNotMatch(header, /\/privacy\/|\/terms\//);
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.match(footer, /href="\/privacy\/"/); assert.match(footer, /href="\/terms\/"/);
    for (const region of [footer, ...(['home', 'cv'].includes(page) ? [await main(page)] : [])]) {
      assert.deepEqual([...region.matchAll(/href="(https?:[^"\s]*)"/g)].map(m => m[1]), hrefs);
    }
  });
}

import { createHash } from 'node:crypto';
import { checkResourceAttributes, profileHrefs } from './resource-policy.mjs';
test('privacy: legal main markup is unchanged', async () => {
  assert.equal(createHash('sha256').update(await main('privacy')).digest('hex'), '55dac9b31ca9c0c0d464c04482eef1fbfa7b653befbf6bf4fac570313b38bd1f');
});
test('terms: legal main markup is unchanged', async () => {
  assert.equal(createHash('sha256').update(await main('terms')).digest('hex'), 'abbca4230e3e7fc3fba997dd40db73a030bbc378ea7684d0a2cb7b60cb47a665');
});

test('external navigation exception does not authorise runtime resources or other links', () => {
  for (const href of profileHrefs) checkResourceAttributes(`<a href="${href}">Profile</a>`);
  for (const html of [
    '<a href="https://example.invalid/">Unapproved</a>',
    '<a href="https://github.com/Westmorland/extra">Changed path</a>',
    '<a href="//github.com/Westmorland">Protocol relative</a>',
    '<script src="https://github.com/Westmorland"></script>',
    '<link href="https://github.com/Westmorland" rel="stylesheet">',
    '<img src="https://github.com/Westmorland">',
    '<img srcset="https://example.invalid/image.png 2x">',
    '<style>body{background:url(https://example.invalid/image.png)}</style>',
  ]) assert.throws(() => checkResourceAttributes(html));
});
