import { describe, expect, it } from 'vitest';
import {
  buildActiveFilterChips,
  countActiveFiltersExcludingQuery,
} from './active-filter-chips';
import type { SearchState } from './search-state';

const base: SearchState = {
  q: 'systemutvecklare',
  regions: ['CifL_Rzy_Mku'],
  municipalities: ['qm5H_jsD_fUF'],
  fields: ['apaJ_2ja_LuF'],
  groups: [],
  remote: true,
  sort: 'pubdate-desc',
  publishedAfter: String(7 * 24 * 60),
  noExperience: false,
  matchCv: true,
};

describe('buildActiveFilterChips', () => {
  it('orders chips: query, region, municipality, field, published, remote', () => {
    const chips = buildActiveFilterChips(base, {
      municipalities: new Map([['qm5H_jsD_fUF', 'Järfälla']]),
      groups: new Map(),
      groupFields: new Map(),
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      'systemutvecklare',
      'Stockholms län',
      'Järfälla',
      'Data/IT',
      'Senaste 7 dagarna',
      'Distans',
    ]);
  });

  it('counts filters excluding the search phrase', () => {
    expect(countActiveFiltersExcludingQuery(base)).toBe(5);
    expect(countActiveFiltersExcludingQuery({ ...base, q: '' })).toBe(5);
  });

  it('removes a municipality without touching the region', () => {
    const chips = buildActiveFilterChips(base, {
      municipalities: new Map([['qm5H_jsD_fUF', 'Järfälla']]),
      groups: new Map(),
      groupFields: new Map(),
    });
    const kommun = chips.find((chip) => chip.key.startsWith('kommun:'));
    expect(kommun).toBeDefined();
    if (!kommun) return;
    const next = kommun.remove(base);
    expect(next.municipalities).toEqual([]);
    expect(next.regions).toEqual(['CifL_Rzy_Mku']);
  });
});
