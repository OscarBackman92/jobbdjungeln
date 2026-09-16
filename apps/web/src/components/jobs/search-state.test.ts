import { describe, expect, it } from 'vitest';
import {
  parseUiSort,
  type SearchState,
  samePanelFilters,
  sameSearchState,
  toJobTechSort,
} from './search-state';

const base: SearchState = {
  q: '',
  regions: [],
  municipalities: [],
  fields: [],
  groups: [],
  remote: false,
  sort: 'pubdate-desc',
  publishedAfter: '',
  noExperience: false,
  matchCv: true,
};

describe('samePanelFilters', () => {
  it('ignores sort and CV visibility', () => {
    expect(samePanelFilters(base, { ...base, sort: 'relevance', matchCv: false })).toBe(true);
  });

  it('detects taxonomy differences', () => {
    expect(samePanelFilters(base, { ...base, remote: true })).toBe(false);
  });
});

describe('sameSearchState', () => {
  it('still compares sort and matchCv', () => {
    expect(sameSearchState(base, { ...base, sort: 'relevance' })).toBe(false);
    expect(sameSearchState(base, { ...base, matchCv: false })).toBe(false);
  });
});

describe('sort helpers', () => {
  it('maps cv-match to pubdate-desc for JobTech', () => {
    expect(toJobTechSort('cv-match')).toBe('pubdate-desc');
    expect(toJobTechSort('applydate-asc')).toBe('applydate-asc');
  });

  it('parses known UI sorts', () => {
    expect(parseUiSort('cv-match')).toBe('cv-match');
    expect(parseUiSort('nope')).toBe('pubdate-desc');
  });
});
