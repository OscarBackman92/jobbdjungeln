import { describe, expect, it } from 'vitest';
import { type SearchState, sameSearchState } from './search-state';

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

describe('sameSearchState', () => {
  it('treats identical states as equal', () => {
    expect(sameSearchState(base, { ...base })).toBe(true);
  });

  it('ignores id order in taxonomy arrays', () => {
    expect(
      sameSearchState(
        { ...base, regions: ['a', 'b'], municipalities: ['x', 'y'] },
        { ...base, regions: ['b', 'a'], municipalities: ['y', 'x'] },
      ),
    ).toBe(true);
  });

  it('trims the search phrase', () => {
    expect(sameSearchState({ ...base, q: ' java ' }, { ...base, q: 'java' })).toBe(true);
  });

  it('detects a single filter difference', () => {
    expect(sameSearchState(base, { ...base, remote: true })).toBe(false);
    expect(sameSearchState(base, { ...base, publishedAfter: '1440' })).toBe(false);
    expect(sameSearchState(base, { ...base, matchCv: false })).toBe(false);
  });
});
