import { describe, expect, it } from 'vitest';
import { employerKey } from './lifecycle.ts';
import { findSimilarRows, titlesSimilar } from './similar.ts';

describe('titlesSimilar', () => {
  it('treats a contained title as the same role', () => {
    expect(titlesSimilar('Ekonomiassistent', 'Ekonomiassistent till ekonomiavdelningen')).toBe(
      true,
    );
  });

  it('rejects unrelated titles', () => {
    expect(titlesSimilar('Ekonomiassistent', 'Lastbilschaufför')).toBe(false);
  });
});

describe('findSimilarRows', () => {
  const rows = [
    {
      id: 'a',
      company: 'Acme AB',
      title: 'Ekonomiassistent',
      status: 'applied',
      appliedAt: '2026-06-01',
      sourceJobId: 'job-1',
      employerKey: employerKey('Acme AB'),
    },
    {
      id: 'b',
      company: 'Annat AB',
      title: 'Ekonomiassistent',
      status: 'wishlist',
      appliedAt: null,
      sourceJobId: '',
      employerKey: employerKey('Annat AB'),
    },
  ];

  it('matches the same JobTech id first', () => {
    const hits = findSimilarRows(rows, {
      company: 'Nytt Namn',
      title: 'Annan roll',
      sourceJobId: 'job-1',
    });
    expect(hits.map((row) => row.id)).toEqual(['a']);
  });

  it('matches the same employer with a similar title', () => {
    const hits = findSimilarRows(rows, {
      company: 'Acme Aktiebolag',
      title: 'Ekonomiassistent',
    });
    expect(hits.map((row) => row.id)).toEqual(['a']);
  });
});
