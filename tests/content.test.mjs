import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { home, cv } from '../src/content.ts';
import * as content from '../src/content.ts';

const hrefs = ['https://uk.linkedin.com/in/danwestmorland', 'https://github.com/Westmorland', 'https://medium.com/@westmorland'];
const main = async (page) => (await readFile(`dist/${page === 'home' ? '' : page + '/'}index.html`, 'utf8')).match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];

test('Home uses the accepted AI-aware introduction', () => {
  assert.equal(home.strap, 'Software leadership, architecture and agentic AI delivery.');
  assert.equal(home.intro, 'I lead developers, shape architecture and help turn ideas into practical, maintainable software. That includes hands-on work with AI agents across delivery, with review, testing and human judgement built in.');
});
test('Home has exactly the accepted four Focus entries and a native CV link', async () => {
  const html = await main('home');
  assert.deepEqual([...html.match(/<section class="cc-focus"[\s\S]*?<\/section>/)[0].matchAll(/<h3>(.*?)<\/h3>/g)].map(m => m[1]), ['Architecture', 'Delivery', 'People', 'Agentic AI software delivery']);
  assert.match(html, /href="\/cv\/"[^>]*>Read the CV/);
});
test('Home presents only the agreed Selected experience after Focus', async () => {
  const expected = {
    heading: 'Selected experience',
    intro: 'My experience spans hands-on development, architecture and technical leadership.',
    cards: [
      { title: 'Building for changing demand', body: 'As lead developer on an online platform, I worked with cloud services to accommodate peaks in demand and quieter periods. The challenge was to increase capacity when needed and reduce it when demand fell.' },
      { title: 'Handling complex business rules', body: 'As a senior developer, I worked on an application with calculation rules that varied between projects. The work involved modelling those rules and supporting background processing.' },
      { title: 'Architecture and technical leadership', body: 'I was lead architect and technical lead for a data and workflow management system. My current software lead work includes managing technical risk, translating requirements into user stories and managing an agile development team.' },
    ],
  };
  assert.deepEqual(content.selectedExperience, expected);
  const html = await main('home');
  assert.match(html, /<\/section><section class="cc-experience" aria-labelledby="cc-experience-h">/);
  const section = html.match(/<section class="cc-experience"[\s\S]*?<\/section>/)[0];
  assert.ok(html.indexOf('id="cc-focus-h"') < html.indexOf('id="cc-experience-h"'));
  assert.match(section, /<h2 id="cc-experience-h">Selected experience<\/h2>/);
  assert.ok(section.includes(expected.intro));
  assert.equal((section.match(/<article>/g) || []).length, 3);
  for (const card of expected.cards) {
    assert.ok(section.includes(`<h3>${card.title}</h3><p>${card.body}</p>`));
  }
  assert.doesNotMatch(section, /<a |<button|tabindex|https?:|\b(?:19|20)\d{2}\b/);
});

test('employers remain visible on CV only, not Home or legal presentation', async () => {
  const employers = [cv.current.org, ...cv.earlier.map(job => job.org)];
  for (const page of ['home', 'privacy', 'terms']) {
    const html = await main(page);
    for (const employer of employers) assert.ok(!html.includes(employer));
  }
  for (const employer of employers) assert.ok((await main('cv')).includes(employer));
});

test('CV statically renders the accepted sections, team and location', async () => {
  const html = await main('cv');
  assert.deepEqual([...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map(m => m[1]), ['Profile', 'Agentic AI delivery', 'Experience', 'Focus', 'Technical strengths', 'Education']);
  for (const text of ['Software lead and architect', 'Based in Newcastle upon Tyne, I work in Durham as a Software Team Lead at Waterstons, within the Digital Solutions software development team.', 'Oak Intranet', 'Creating Careers / vision2learn', 'Tata Steel', 'BSc Computer Studies', 'Teesside University', 'People own priorities, acceptance and release.']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/>C# and .NET</g) || []).length, 1);
});
test('CV career detail uses exact LinkedIn titles and start years with unchanged descriptions', async () => {
  const expected = [
    { org: 'Oak Intranet', roles: [{ startYear: '2018', title: 'Lead Software Developer' }, { startYear: '2014', title: 'Developer' }], description: 'Worked on the development of Oak’s intranet platform, helping organisations connect their people, share information and improve internal communication. Progressed from platform development to Lead Software Developer. My work included frontend and backend development, translating UX designs into working features.' },
    { org: 'Creating Careers / vision2learn', roles: [{ startYear: '2012', title: 'Developer' }], description: 'Developed functionality for the vision2learn e-learning platform, supporting learners studying online and improving the efficiency of the operations team. Worked with ASP.NET to extend the platform’s capabilities. I began my software development career combining service desk support with developing new features. Investigating customer issues helped me build my debugging skills, while working directly with customers developed my communication skills.' },
    { org: 'Tata Steel', roles: [{ startYear: '2010', title: 'Training Manager' }], description: 'Responsible for on-site employee training at Tata Steel.' },
  ];
  assert.deepEqual(cv.earlier, expected);
  assert.deepEqual(cv.waterstons, {
    roles: [{ startYear: '2022', title: 'Senior Software Consultant Lead' }, { startYear: '2019', title: 'Senior Software Consultant' }],
    description: 'My work at Waterstons spans hands-on development, technical leadership, architecture, client advice and mentoring. My project roles have included senior developer, lead developer, lead architect and technical lead. As a software lead, I manage technical risk, translate requirements into user stories and manage agile delivery teams.',
  });
  const html = await main('cv');
  const experience = html.match(/<section aria-labelledby="b-exp">([\s\S]*?)<\/section>/)[1];
  assert.equal((experience.match(/<article /g) || []).length, 4);
  for (const job of expected) {
    const article = [...experience.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].find(m => m[1].includes(job.org))?.[1];
    assert.ok(article, job.org);
    assert.equal(article.split(job.description).length - 1, 1);
  }
  assert.equal(experience.split(cv.waterstons.description).length - 1, 1);
  const roles = [...experience.matchAll(/<time[^>]*>(\d{4})<\/time><strong>(.*?)<\/strong>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(roles, [
    ['2022', 'Software Team Lead'], ['2022', 'Senior Software Consultant Lead'], ['2019', 'Senior Software Consultant'],
    ['2018', 'Lead Software Developer'], ['2014', 'Developer'], ['2012', 'Developer'], ['2010', 'Training Manager'],
  ]);
  assert.doesNotMatch(experience.replace(/<[^>]*>/g, ' '), /Training Facilitator|Earlier|since|to now|disputed|indexed|uncertain|January|February|March|April|May|June|July|August|September|October|November|December|\d{4}\s*[-–]\s*\d{4}/i);
});
test('Tata Steel retains the training-only description with the agreed LinkedIn title', async () => {
  const tata = cv.earlier.filter(job => job.org === 'Tata Steel');
  assert.equal(tata.length, 1);
  const article = [...(await main('cv')).matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].find(m => m[1].includes('Tata Steel'))?.[1];
  assert.ok(article);
  for (const text of [tata[0].description, article.match(/<p>(.*?)<\/p>/)[1]]) {
    assert.doesNotMatch(text, /design|develop|software|courses?|manag|400|achievement/i);
  }
  assert.deepEqual(tata[0], { org: 'Tata Steel', roles: [{ startYear: '2010', title: 'Training Manager' }], description: 'Responsible for on-site employee training at Tata Steel.' });
  assert.match(article, /<strong>Training Manager<\/strong>/);
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
// Characterisation hashes from the agreed baseline 10dd2819dffbcb89ff2b9aa66a418035cea600f5.
test('Home and CV outside Experience preserve the agreed baseline markup', async () => {
  assert.equal(createHash('sha256').update(await main('home')).digest('hex'), '4ce40190cd4bfdd9eb06916418ca74b41acbbe6c8f609bea49e6f5ece53adb12');
  const unchangedCV = (await main('cv')).replace(/<section aria-labelledby="b-exp">[\s\S]*?<\/section>/, '');
  assert.equal(createHash('sha256').update(unchangedCV).digest('hex'), '9bb34c3c2c3a7b565747daa6c283f4fdf80a34a9c404e8dce1bbac0ef96b190b');
});
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
