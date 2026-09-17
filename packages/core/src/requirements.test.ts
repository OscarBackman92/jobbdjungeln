import { describe, expect, it } from 'vitest';
import {
  type Evidence,
  extractRequirements,
  normalizeMatchSnapshot,
  postingLikeFromApplication,
  scorePosting,
  trimSnapshot,
} from './requirements.ts';

const RICH_AD = {
  title: 'Ekonomiassistent till Acme AB',
  description: [
    'Om oss',
    'Acme AB är ett växande bolag som arbetar med Docker och Kubernetes i molnet.',
    '',
    'Kvalifikationer',
    '- Du har erfarenhet av Excel',
    '- Du har arbetat med bokföring',
    '- Du behärskar Fortnox',
    '- Du har god kunskap i SQL',
    '',
    'Meriterande',
    '- Erfarenhet av Power BI är ett plus',
    '- Kunskap i Visma är meriterande',
    '',
    'Vi erbjuder',
    'Ett kontor med SAP och fri kaffe.',
  ].join('\n'),
};

describe('extractRequirements', () => {
  const requirements = extractRequirements(RICH_AD);
  const byTerm = new Map(requirements.map((req) => [req.term, req]));

  it('reads the qualifications block as hard requirements', () => {
    expect(byTerm.get('Excel')?.level).toBe('must');
    expect(byTerm.get('Bokföring')?.level).toBe('must');
    expect(byTerm.get('Fortnox')?.level).toBe('must');
    expect(byTerm.get('SQL')?.level).toBe('must');
  });

  it('reads the meriting block as merits', () => {
    expect(byTerm.get('Power BI')?.level).toBe('merit');
    expect(byTerm.get('Visma')?.level).toBe('merit');
  });

  it('ignores skills that only appear in employer boilerplate', () => {
    expect(byTerm.has('Docker')).toBe(false);
    expect(byTerm.has('Kubernetes')).toBe(false);
    expect(byTerm.has('SAP')).toBe(false);
  });

  it('does not treat Svenska/Engelska as scored requirements', () => {
    const withLanguages = extractRequirements({
      title: 'Receptionist',
      description: [
        'Kvalifikationer',
        '- God svenska i tal och skrift',
        '- Engelska',
        '- Du har erfarenhet av Excel',
      ].join('\n'),
    });
    const terms = withLanguages.map((req) => req.term);
    expect(terms).toContain('Excel');
    expect(terms).not.toContain('Svenska');
    expect(terms).not.toContain('Engelska');
  });

  it('treats a skill in the title as a hard requirement', () => {
    expect(byTerm.get('Ekonomiassistent')?.level).toBe('must');
    expect(byTerm.get('Ekonomiassistent')?.sourceLine).toBe(0);
  });

  it('keeps a snippet and source line for every requirement', () => {
    for (const requirement of requirements) {
      expect(requirement.snippet.length).toBeGreaterThan(0);
      expect(requirement.snippet.length).toBeLessThanOrEqual(120);
      expect(requirement.sourceLine).toBeGreaterThanOrEqual(0);
    }
  });

  it('lets must win when a term appears at both levels', () => {
    const mixed = extractRequirements({
      title: '',
      description: [
        'Kvalifikationer',
        'Du har erfarenhet av Excel.',
        'Meriterande',
        'Excel är meriterande.',
      ].join('\n'),
    });
    expect(mixed.find((req) => req.term === 'Excel')?.level).toBe('must');
  });

  it('picks up requirements from a single-paragraph ad by sentence', () => {
    const blob = extractRequirements({
      title: '',
      description:
        'Vi söker dig som har erfarenhet av Excel. Kunskap i Power BI är meriterande. Du ska kunna SQL.',
    });
    const levels = new Map(blob.map((req) => [req.term, req.level]));
    expect(levels.get('Excel')).toBe('must');
    expect(levels.get('Power BI')).toBe('merit');
    expect(levels.get('SQL')).toBe('must');
  });

  it('returns nothing for an empty ad', () => {
    expect(extractRequirements({ title: '', description: '' })).toEqual([]);
    expect(extractRequirements({})).toEqual([]);
  });
});

describe('scorePosting', () => {
  it('scores against the ad requirements, not the size of the CV', () => {
    const short = scorePosting(['Excel', 'Bokföring', 'Fortnox', 'SQL'], RICH_AD);
    const padded = scorePosting(
      ['Excel', 'Bokföring', 'Fortnox', 'SQL', 'Truckkort', 'Svenska', 'Engelska', 'Scrum'],
      RICH_AD,
    );
    expect(padded.score).toBe(short.score);
    expect(padded.mustTotal).toBe(short.mustTotal);
  });

  it('never reports a perfect score, even on full coverage', () => {
    const result = scorePosting(
      ['Ekonomiassistent', 'Excel', 'Bokföring', 'Fortnox', 'SQL'],
      RICH_AD,
    );
    expect(result.mustCovered).toBe(result.mustTotal);
    expect(result.score).not.toBeNull();
    expect(result.score).toBeLessThan(100);
    expect(result.band).toBe('strong');
  });

  it('reports zero coverage as a weak band, not an error', () => {
    const result = scorePosting(['Truckkort'], RICH_AD);
    expect(result.mustCovered).toBe(0);
    expect(result.score).toBe(0);
    expect(result.band).toBe('weak');
  });

  it('withholds a score when the ad is too thin to judge', () => {
    const thin = scorePosting(['Excel'], {
      title: 'Ekonom',
      description: 'Du har erfarenhet av Excel.',
    });
    expect(thin.confidence).toBe('low');
    expect(thin.score).toBeNull();
    expect(thin.band).toBe('unknown');
  });

  it('lists uncovered requirements as gaps, with their level', () => {
    const result = scorePosting(['Excel'], RICH_AD);
    const gapTerms = result.gaps.map((gap) => gap.term);
    expect(gapTerms).toContain('SQL');
    expect(gapTerms).toContain('Fortnox');
    expect(result.covered.map((item) => item.term)).toContain('Excel');
    expect(result.gaps.find((gap) => gap.term === 'Power BI')?.level).toBe('merit');
  });

  it('separates unused CV skills from real gaps', () => {
    const result = scorePosting(['Excel', 'Truckkort'], RICH_AD);
    expect(result.unusedCvTerms).toEqual(['Truckkort']);
    expect(result.gaps.map((gap) => gap.term)).not.toContain('Truckkort');
    expect(result.cvTermsTotal).toBe(2);
    expect(result.cvTermsUsed).toBe(1);
  });

  it('carries evidence provenance through to covered requirements', () => {
    const evidence: Evidence[] = [
      { term: 'Excel', confirmed: true, source: { label: 'Acme AB', kind: 'experience' } },
      { term: 'SQL', confirmed: false, source: { label: 'Gissning' } },
    ];
    const result = scorePosting(evidence, RICH_AD);
    const excel = result.covered.find((item) => item.term === 'Excel');
    expect(excel?.source.label).toBe('Acme AB');
    // Unconfirmed evidence must not count as coverage.
    expect(result.gaps.map((gap) => gap.term)).toContain('SQL');
  });

  it('falls back to merits when an ad states no hard requirements', () => {
    const meritOnly = scorePosting(['Excel'], {
      title: 'Assistent',
      description: [
        'Meriterande',
        'Erfarenhet av Excel är meriterande.',
        'Kunskap i Power BI är ett plus.',
        'Vana vid Visma är önskvärt.',
        'Det är gärna så att du har arbetat med SAP tidigare i en liknande roll hos oss.',
        'Vi ser positivt på erfarenhet av Fortnox och andra ekonomisystem sedan tidigare.',
      ].join('\n'),
    });
    expect(meritOnly.mustTotal).toBe(0);
    expect(meritOnly.meritTotal).toBeGreaterThanOrEqual(3);
    expect(meritOnly.meritCovered).toBe(1);
  });

  it('handles an empty CV without throwing', () => {
    const result = scorePosting([], RICH_AD);
    expect(result.cvTermsTotal).toBe(0);
    expect(result.mustCovered).toBe(0);
    expect(result.covered).toEqual([]);
  });
});

describe('postingLikeFromApplication', () => {
  it('prefers the saved ad text and appends notes', () => {
    const posting = postingLikeFromApplication({
      title: 'Utvecklare',
      adDescription: 'Du har erfarenhet av Python.',
      notes: 'Rekryteraren nämnde Docker.',
    });
    expect(posting.title).toBe('Utvecklare');
    expect(posting.description).toContain('Python');
    expect(posting.description).toContain('Docker');
  });

  it('copes with a row that has neither ad text nor notes', () => {
    const posting = postingLikeFromApplication({ title: 'Utvecklare' });
    expect(posting.description).toBe('');
  });
});

describe('trimSnapshot', () => {
  it('caps the stored lists so a snapshot stays small', () => {
    const result = scorePosting(['Excel'], RICH_AD);
    const inflated = {
      ...result,
      covered: Array.from({ length: 40 }, () => result.covered[0]).filter(
        (item): item is NonNullable<typeof item> => item != null,
      ),
      unusedCvTerms: Array.from({ length: 40 }, (_, index) => `term-${index}`),
    };
    const snapshot = trimSnapshot(inflated);
    expect(snapshot.covered.length).toBeLessThanOrEqual(12);
    expect(snapshot.unusedCvTerms.length).toBeLessThanOrEqual(12);
    expect(snapshot.score).toBe(result.score);
  });
});

describe('normalizeMatchSnapshot', () => {
  it('maps Django snake_case coverage counts to camelCase', () => {
    expect(
      normalizeMatchSnapshot({
        must_total: 2,
        must_covered: 1,
        merit_total: 0,
        merit_covered: 0,
        band: 'unknown',
        confidence: 'low',
        covered: [],
        gaps: [],
        unused_cv_terms: ['Visma'],
        cv_terms_used: 1,
        cv_terms_total: 10,
      }),
    ).toMatchObject({
      mustTotal: 2,
      mustCovered: 1,
      unusedCvTerms: ['Visma'],
      cvTermsUsed: 1,
      cvTermsTotal: 10,
    });
  });

  it('returns null when coverage counts are missing', () => {
    expect(normalizeMatchSnapshot({ score: 50 })).toBeNull();
    expect(normalizeMatchSnapshot(null)).toBeNull();
  });

  it('passes through already-camelCase snapshots', () => {
    expect(normalizeMatchSnapshot({ mustTotal: 4, mustCovered: 3 })).toMatchObject({
      mustTotal: 4,
      mustCovered: 3,
    });
  });
});
