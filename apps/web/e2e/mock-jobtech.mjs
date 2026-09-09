#!/usr/bin/env node
/**
 * A stand-in for Arbetsförmedlingen's JobTech API.
 *
 * The end-to-end suite must be able to run offline and produce the same results
 * every time, which a live third-party search cannot do. The shapes here are
 * copied from real responses, including the parts the client has to be tolerant
 * of: an occupation arriving as a one-item list, a hit with almost no fields.
 */

import { createServer } from 'node:http';

const ADS = [
  {
    id: '29876543',
    headline: 'Ekonomiassistent till Acme AB',
    description: {
      text: [
        'Om oss',
        'Acme AB är ett växande bolag i Stockholm.',
        '',
        'Kvalifikationer',
        '- Du har erfarenhet av Excel',
        '- Du har arbetat med bokföring',
        '- Du behärskar Fortnox sedan tidigare',
        '- Du har god kunskap i SQL och rapportering',
        '',
        'Meriterande',
        '- Erfarenhet av Power BI är ett plus',
        '- Kunskap i Visma är meriterande',
      ].join('\n'),
    },
    employer: { name: 'Acme AB' },
    workplace_address: { municipality: 'Stockholm', city: 'Stockholm' },
    webpage_url: 'https://arbetsformedlingen.se/jobb/29876543',
    application_details: { via_af: false, url: 'https://acme.test/ansok' },
    publication_date: '2026-09-01T08:00:00',
    application_deadline: '2026-12-30T23:59:59',
    remote_work: false,
    occupation: { concept_id: 'occ-ekonomiassistent', label: 'Ekonomiassistent' },
    occupation_group: { concept_id: 'grp-ekonomi', label: 'Ekonomiassistenter' },
    working_hours_type: { concept_id: 'wh-heltid', label: 'Heltid' },
    scope_of_work: { min: 100, max: 100 },
  },
  {
    id: '29876544',
    headline: 'Systemutvecklare inom Python',
    description: {
      text: [
        'Kvalifikationer',
        'Du har erfarenhet av Python och Django.',
        'Du har arbetat med Docker och Kubernetes i produktion.',
        'Du behärskar PostgreSQL och skriver egna migreringar.',
        'Meriterande',
        'Kunskap i TypeScript är ett plus.',
      ].join('\n'),
    },
    employer: { name: 'Beta Tech AB' },
    workplace_address: { municipality: 'Göteborg' },
    webpage_url: 'https://arbetsformedlingen.se/jobb/29876544',
    application_details: { via_af: true },
    publication_date: '2026-09-02T09:00:00',
    application_deadline: null,
    remote_work: true,
    // Deliberately a one-item list: the real API sometimes answers this way.
    occupation: [{ concept_id: 'occ-systemutvecklare', label: 'Systemutvecklare' }],
    working_hours_type: { concept_id: 'wh-heltid', label: 'Heltid' },
  },
  {
    id: '29876545',
    headline: 'Orderadministratör',
    description: { text: 'Kort annons utan tydliga krav.' },
    employer: { name: 'Gamma Handel AB' },
    workplace_address: { municipality: 'Malmö' },
    webpage_url: 'https://arbetsformedlingen.se/jobb/29876545',
    publication_date: '2026-09-03T10:00:00',
  },
];

const MUNICIPALITIES = [
  { 'taxonomy/id': 'mun-stockholm', 'taxonomy/preferred-label': 'Stockholm' },
  { 'taxonomy/id': 'mun-botkyrka', 'taxonomy/preferred-label': 'Botkyrka' },
  { 'taxonomy/id': 'mun-osteraker', 'taxonomy/preferred-label': 'Österåker' },
];

const GROUPS = [
  { 'taxonomy/id': 'grp-systemutvecklare', 'taxonomy/preferred-label': 'Systemutvecklare' },
  { 'taxonomy/id': 'grp-support', 'taxonomy/preferred-label': 'IT-support' },
];

function matches(ad, query) {
  if (!query) return true;
  const haystack = `${ad.headline} ${ad.employer?.name ?? ''} ${ad.workplace_address?.municipality ?? ''}`;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const json = (body, status = 200) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
  };

  if (url.pathname === '/search') {
    const hits = ADS.filter((ad) => matches(ad, url.searchParams.get('q') ?? ''));
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 25);
    json({ total: { value: hits.length }, hits: hits.slice(offset, offset + limit) });
    return;
  }

  if (url.pathname.startsWith('/ad/')) {
    const id = url.pathname.slice('/ad/'.length);
    const ad = ADS.find((item) => item.id === id);
    if (!ad) return json({ error: 'not found' }, 404);
    return json(ad);
  }

  if (url.pathname === '/concepts') {
    const type = url.searchParams.get('type');
    if (type === 'municipality') return json(MUNICIPALITIES);
    if (type === 'ssyk-level-4') return json(GROUPS);
    return json([]);
  }

  json({ error: 'not found' }, 404);
});

const port = Number(process.env.MOCK_JOBTECH_PORT ?? 4010);
server.listen(port, '127.0.0.1', () => {
  console.log(`mock-jobtech lyssnar på http://127.0.0.1:${port}`);
});
