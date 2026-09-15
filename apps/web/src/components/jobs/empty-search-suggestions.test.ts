import { describe, expect, it } from 'vitest';
import {
  buildSearchRelaxations,
  MAX_RELAXATION_COUNTS,
} from '@/components/jobs/empty-search-suggestions';
import type { SearchState } from '@/components/jobs/search-state';

const base: SearchState = {
  q: 'systemutvecklare',
  regions: ['01'],
  municipalities: ['0182'],
  fields: ['3'],
  groups: ['2512'],
  remote: true,
  sort: 'pubdate-desc',
  publishedAfter: String(7 * 24 * 60),
  noExperience: true,
  matchCv: true,
};

describe('buildSearchRelaxations', () => {
  it('builds one relaxation per active filter, capped at max', () => {
    const relaxations = buildSearchRelaxations(
      base,
      {
        municipalities: new Map([['0182', 'Järfälla']]),
        groups: new Map([['2512', 'Mjukvaru- och systemutvecklare m.fl.']]),
        groupFields: new Map([['2512', '3']]),
      },
      MAX_RELAXATION_COUNTS,
    );

    expect(relaxations.length).toBe(MAX_RELAXATION_COUNTS);
    expect(relaxations[0]).toMatchObject({
      id: 'q:systemutvecklare',
      withoutLabel: 'Utan systemutvecklare',
      removeButton: 'Ta bort systemutvecklare',
    });
    expect(relaxations[0]?.next.q).toBe('');
    expect(relaxations.some((item) => item.withoutLabel === 'Utan Järfälla')).toBe(true);
  });

  it('returns empty when nothing is filtered', () => {
    expect(
      buildSearchRelaxations(
        {
          ...base,
          q: '',
          regions: [],
          municipalities: [],
          fields: [],
          groups: [],
          remote: false,
          publishedAfter: '',
          noExperience: false,
        },
        {
          municipalities: new Map(),
          groups: new Map(),
          groupFields: new Map(),
        },
      ),
    ).toEqual([]);
  });
});
