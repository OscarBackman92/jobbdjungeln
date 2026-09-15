import { describe, expect, it, vi } from 'vitest';
import { createJobTechClient, hitToJobAd, JobTechError } from './client.ts';
import { expandSwedishQuery, isSwedishPlace } from './swedish.ts';
import { validConceptIds, validFieldIds, validRegionIds } from './taxonomy.ts';

const HIT = {
  id: 29876543,
  headline: 'Ekonomiassistent',
  description: { text: 'Du har erfarenhet av Excel.' },
  employer: { name: 'Acme AB' },
  workplace_address: { municipality: 'Jönköping', city: 'Jönköping' },
  webpage_url: 'https://arbetsformedlingen.se/jobb/29876543',
  application_details: { via_af: false, url: 'https://acme.test/ansok' },
  publication_date: '2026-06-01T08:00:00',
  application_deadline: '2026-06-30T23:59:59',
  remote_work: true,
  occupation: { concept_id: 'abc123', label: 'Ekonomiassistent' },
  occupation_group: { concept_id: 'grp1', label: 'Ekonomiassistenter' },
  working_hours_type: { concept_id: 'h1', label: 'Heltid' },
  scope_of_work: { min: 80, max: 100 },
};

function stubFetch(payload: unknown, init: { status?: number } = {}) {
  return vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(JSON.stringify(payload), {
        status: init.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

describe('hitToJobAd', () => {
  it('maps a full hit onto the app shape', () => {
    const ad = hitToJobAd(HIT);
    expect(ad).toMatchObject({
      id: '29876543',
      title: 'Ekonomiassistent',
      companyName: 'Acme AB',
      location: 'Jönköping',
      description: 'Du har erfarenhet av Excel.',
      descriptionHtml: '',
      applicationUrl: 'https://acme.test/ansok',
      publishedAt: '2026-06-01',
      applicationDeadline: '2026-06-30',
      remote: true,
      occupationConceptId: 'abc123',
      occupationLabel: 'Ekonomiassistent',
      workingHoursType: 'Heltid',
      scopeOfWorkMin: 80,
      scopeOfWorkMax: 100,
    });
  });

  it('hides the apply URL when the ad is handled through AF', () => {
    const ad = hitToJobAd({
      ...HIT,
      application_details: { via_af: true, url: 'https://x.test' },
    });
    expect(ad?.applicationUrl).toBe('');
  });

  it('falls back to a mailto link when only an address is given', () => {
    const ad = hitToJobAd({
      ...HIT,
      application_details: { via_af: false, email: 'jobb@acme.test' },
    });
    expect(ad?.applicationUrl).toBe('mailto:jobb@acme.test');
  });

  it('tolerates concepts arriving as a one-item list', () => {
    const ad = hitToJobAd({ ...HIT, occupation: [{ concept_id: 'x', label: 'Roll' }] });
    expect(ad?.occupationLabel).toBe('Roll');
  });

  it('survives a hit with almost nothing in it', () => {
    const ad = hitToJobAd({ id: '1' });
    expect(ad).toMatchObject({
      id: '1',
      title: '',
      companyName: '',
      location: '',
      publishedAt: null,
      remote: false,
      scopeOfWorkMin: null,
    });
  });

  it('drops a hit with no usable id', () => {
    expect(hitToJobAd({ headline: 'Utan id' })).toBeNull();
    expect(hitToJobAd(null)).toBeNull();
    expect(hitToJobAd('inte ett objekt')).toBeNull();
  });

  it('rejects a malformed date rather than storing it', () => {
    expect(hitToJobAd({ ...HIT, publication_date: 'igår' })?.publishedAt).toBeNull();
  });
});

describe('search', () => {
  it('asks for the newest ads first and clamps the page size', async () => {
    const fetch = stubFetch({ total: { value: 2 }, hits: [HIT] });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    const result = await client.search({ limit: 500 });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('sort')).toBe('pubdate-desc');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(1);
  });

  it('allows limit=0 so callers can fetch only the total', async () => {
    const fetch = stubFetch({ total: { value: 281 }, hits: [] });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    const result = await client.search({ limit: 0 });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('limit')).toBe('0');
    expect(result.total).toBe(281);
    expect(result.results).toHaveLength(0);
  });

  it('requests and parses stats buckets for the full result set', async () => {
    const fetch = stubFetch({
      total: { value: 100 },
      hits: [],
      stats: [
        {
          type: 'municipality',
          values: [
            { term: 'Stockholm', concept_id: 'AvNB_uwa_6n6', count: 40 },
            { term: 'Göteborg', concept_id: 'oYPt_yRv_okr', count: 20 },
          ],
        },
        {
          type: 'occupation-group',
          values: [{ term: 'Mjukvaru- och systemutvecklare m.fl.', concept_id: 'grp_1', count: 15 }],
        },
      ],
    });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    const result = await client.search({
      limit: 0,
      stats: ['municipality', 'occupation-group'],
      statsLimit: 5,
    });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.getAll('stats')).toEqual(['municipality', 'occupation-group']);
    expect(url.searchParams.get('stats.limit')).toBe('5');
    expect(result.stats).toEqual([
      {
        type: 'municipality',
        values: [
          { conceptId: 'AvNB_uwa_6n6', label: 'Stockholm', count: 40 },
          { conceptId: 'oYPt_yRv_okr', label: 'Göteborg', count: 20 },
        ],
      },
      {
        type: 'occupation-group',
        values: [
          {
            conceptId: 'grp_1',
            label: 'Mjukvaru- och systemutvecklare m.fl.',
            count: 15,
          },
        ],
      },
    ]);
  });

  it('lets municipalities override the region they sit in', async () => {
    const fetch = stubFetch({ total: { value: 0 }, hits: [] });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    await client.search({ regions: ['CifL_Rzy_Mku'], municipalities: ['AvNB_uwa_6n6'] });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.getAll('municipality')).toEqual(['AvNB_uwa_6n6']);
    expect(url.searchParams.getAll('region')).toEqual([]);
  });

  it('lets occupation groups override the field they sit in', async () => {
    const fetch = stubFetch({ total: { value: 0 }, hits: [] });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    await client.search({ fields: ['apaJ_2ja_LuF'], groups: ['grp_1'] });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.getAll('occupation-group')).toEqual(['grp_1']);
    expect(url.searchParams.getAll('occupation-field')).toEqual([]);
  });

  it('silently drops filter ids that are not in the taxonomy', async () => {
    const fetch = stubFetch({ total: { value: 0 }, hits: [] });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    await client.search({ regions: ['CifL_Rzy_Mku', 'påhittat'], fields: ['nonsens'] });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.getAll('region')).toEqual(['CifL_Rzy_Mku']);
    expect(url.searchParams.getAll('occupation-field')).toEqual([]);
  });

  it('rewrites ASCII place names to the spelling JobTech indexes', async () => {
    const fetch = stubFetch({ total: { value: 0 }, hits: [] });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    await client.search({ q: 'ekonom jonkoping' });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('q')).toBe('ekonom jönköping');
  });

  it('skips hits it cannot understand instead of failing the whole search', async () => {
    const fetch = stubFetch({ total: { value: 2 }, hits: [HIT, { headline: 'utan id' }] });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    const result = await client.search({});
    expect(result.results).toHaveLength(1);
  });

  it('reports an upstream failure as a JobTechError with its status', async () => {
    const fetch = stubFetch({ error: 'nope' }, { status: 503 });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    await expect(client.search({})).rejects.toBeInstanceOf(JobTechError);
    await expect(client.search({})).rejects.toMatchObject({ status: 503 });
  });

  it('reports a network failure as a JobTechError', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    const client = createJobTechClient({ fetch, searchUrl: 'https://jt.test/search' });
    await expect(client.search({})).rejects.toBeInstanceOf(JobTechError);
  });
});

describe('fetchAd', () => {
  it('refuses an id that is not a JobTech ad id', async () => {
    const fetch = stubFetch(HIT);
    const client = createJobTechClient({ fetch, adUrl: 'https://jt.test/ad' });
    await expect(client.fetchAd('../../etc/passwd')).rejects.toBeInstanceOf(JobTechError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('treats a gone historical ad as null, not an error', async () => {
    const fetch = stubFetch({ error: 'not found' }, { status: 404 });
    const client = createJobTechClient({ fetch, historicalAdUrl: 'https://jt.test/hist' });
    await expect(client.fetchHistoricalAd('123')).resolves.toBeNull();
  });
});

describe('taxonomy lookups', () => {
  it('returns municipalities sorted in Swedish alphabetical order', async () => {
    const fetch = stubFetch([
      { 'taxonomy/id': 'b', 'taxonomy/preferred-label': 'Österåker' },
      { 'taxonomy/id': 'a', 'taxonomy/preferred-label': 'Botkyrka' },
      { 'taxonomy/id': 'c', 'taxonomy/preferred-label': 'Ängelholm' },
    ]);
    const client = createJobTechClient({ fetch, taxonomyConceptsUrl: 'https://jt.test/tax' });
    const result = await client.municipalities('CifL_Rzy_Mku');
    expect(result.map((item) => item.label)).toEqual(['Botkyrka', 'Ängelholm', 'Österåker']);
    expect(result[0]?.regionId).toBe('CifL_Rzy_Mku');
  });

  it('does not call upstream for a region that does not exist', async () => {
    const fetch = stubFetch([]);
    const client = createJobTechClient({ fetch, taxonomyConceptsUrl: 'https://jt.test/tax' });
    await expect(client.municipalities('påhittat')).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads a taxonomy payload wrapped in a value key', async () => {
    const fetch = stubFetch({
      value: [{ 'taxonomy/id': 'g1', 'taxonomy/preferred-label': 'Systemutvecklare' }],
    });
    const client = createJobTechClient({ fetch, taxonomyConceptsUrl: 'https://jt.test/tax' });
    const groups = await client.occupationGroups('apaJ_2ja_LuF');
    expect(groups).toEqual([{ id: 'g1', label: 'Systemutvecklare', fieldId: 'apaJ_2ja_LuF' }]);
  });

  it('does not autocomplete on a single character', async () => {
    const fetch = stubFetch([]);
    const client = createJobTechClient({
      fetch,
      taxonomyAutocompleteUrl: 'https://jt.test/ac',
    });
    await expect(client.suggestOccupations('e')).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('Swedish query expansion', () => {
  it('repairs place names typed without å, ä or ö', () => {
    expect(expandSwedishQuery('jonkoping')).toBe('jönköping');
    expect(expandSwedishQuery('norrkoping')).toBe('norrköping');
    expect(expandSwedishQuery('malmo')).toBe('malmö');
    expect(expandSwedishQuery('goteborg')).toBe('göteborg');
    expect(expandSwedishQuery('ornskoldsvik')).toBe('örnsköldsvik');
    expect(expandSwedishQuery('vasteras')).toBe('västerås');
  });

  it('does not invent diacritics the real name does not have', () => {
    // A rule that maximises diacritics would produce "nörrköping" here.
    expect(expandSwedishQuery('norrkoping')).not.toContain('nörr');
    expect(expandSwedishQuery('helsingborg')).toBe('helsingborg');
    expect(expandSwedishQuery('stockholm')).toBe('stockholm');
    expect(expandSwedishQuery('sundsvall')).toBe('sundsvall');
  });

  it('leaves ordinary search words untouched', () => {
    expect(expandSwedishQuery('python')).toBe('python');
    expect(expandSwedishQuery('controller ekonomi')).toBe('controller ekonomi');
    expect(expandSwedishQuery('mo')).toBe('mo');
    expect(expandSwedishQuery('')).toBe('');
    expect(expandSwedishQuery('   ')).toBe('');
  });

  it('keeps a spelling that is already correct', () => {
    expect(expandSwedishQuery('jönköping')).toBe('jönköping');
    expect(expandSwedishQuery('Göteborg')).toBe('Göteborg');
  });

  it('repairs a place inside a longer query without touching the rest', () => {
    expect(expandSwedishQuery('ekonom jonkoping')).toBe('ekonom jönköping');
    expect(expandSwedishQuery('java utvecklare vaxjo')).toBe('java utvecklare växjö');
  });

  it('handles place names made of several words', () => {
    expect(expandSwedishQuery('upplands vasby')).toBe('upplands väsby');
    expect(expandSwedishQuery('jobb i ostra goinge')).toBe('jobb i östra göinge');
  });

  it('recognises a place regardless of spelling', () => {
    expect(isSwedishPlace('vaxjo')).toBe(true);
    expect(isSwedishPlace('Växjö')).toBe(true);
    expect(isSwedishPlace('python')).toBe(false);
  });
});

describe('taxonomy validation', () => {
  it('accepts known ids and de-duplicates them', () => {
    expect(validRegionIds(['CifL_Rzy_Mku', 'CifL_Rzy_Mku', 'nej'])).toEqual(['CifL_Rzy_Mku']);
    expect(validFieldIds(['apaJ_2ja_LuF', 'nej'])).toEqual(['apaJ_2ja_LuF']);
  });

  it('shape-checks free concept ids without calling upstream', () => {
    expect(validConceptIds(['AvNB_uwa_6n6', 'ok_1', '../etc', 'a b', ''])).toEqual([
      'AvNB_uwa_6n6',
      'ok_1',
    ]);
  });
});
