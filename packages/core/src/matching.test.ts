import { describe, expect, it } from 'vitest';
import { cvCoverage, labelsInText, skillHitsText } from './matching.ts';
import { canonicalSkillLabel, normalizeSkillList, skillMatchTerms } from './skills.ts';

describe('boundary-aware matching', () => {
  it('does not match a short skill glued inside a longer word', () => {
    expect(skillHitsText('Go', 'Vi bygger med Django och Python')).toBe(false);
    expect(skillHitsText('R', 'Erfarenhet av React krävs')).toBe(false);
    expect(skillHitsText('AI', 'Kontoret ligger i Thailand')).toBe(false);
    expect(skillHitsText('Java', 'Du kan JavaScript')).toBe(false);
  });

  it('matches the same skills when they stand alone', () => {
    expect(skillHitsText('Go', 'Vi skriver tjänster i Go.')).toBe(true);
    expect(skillHitsText('Java', 'Du kan Java och Kotlin')).toBe(true);
  });

  it('respects Swedish letters as word characters', () => {
    expect(skillHitsText('Word', 'Wörd är inte Word')).toBe(true);
    expect(skillHitsText('Excel', 'Excellerar på kontoret')).toBe(false);
  });

  it('treats å, ä and ö as word characters at the boundary', () => {
    // JavaScript's own \\b and \\w are ASCII-only and would treat "å" as a
    // boundary, letting a skill match glued to the tail of a Swedish word.
    // These assert the Unicode-aware boundary the matcher uses instead.
    expect(skillHitsText('SQL', 'påSQL')).toBe(false);
    expect(skillHitsText('SQL', 'SQLång')).toBe(false);
    expect(skillHitsText('SQL', 'på SQL')).toBe(true);
  });

  it('matches symbol-edged skills that break plain word boundaries', () => {
    expect(skillHitsText('C#', 'Vi utvecklar i C# och .NET')).toBe(true);
    expect(skillHitsText('.NET', 'Vi utvecklar i C# och .NET')).toBe(true);
    expect(skillHitsText('Node.js', 'Erfarenhet av Node.js')).toBe(true);
  });

  it('matches multi-word skills with flexible whitespace', () => {
    expect(skillHitsText('Power BI', 'Rapporter i Power   BI')).toBe(true);
    expect(skillHitsText('Power BI', 'Rapporter i PowerBI')).toBe(true);
    expect(skillHitsText('Microsoft 365', 'Van vid Office 365')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(skillHitsText('PostgreSQL', 'god kunskap i postgres')).toBe(true);
    expect(skillHitsText('python', 'PYTHON krävs')).toBe(true);
  });

  it('matches Swedish inflections through stems', () => {
    expect(skillHitsText('Upphandling', 'Du har drivit upphandlingar')).toBe(true);
    expect(skillHitsText('Bokföring', 'Erfaren bokförare sökes')).toBe(true);
    expect(skillHitsText('Redovisning', 'Du redovisar månadsvis')).toBe(true);
    expect(skillHitsText('Projektledning', 'Erfarenhet som projektledare')).toBe(true);
  });

  it('ignores blank skills and empty text', () => {
    expect(skillHitsText('', 'något')).toBe(false);
    expect(skillHitsText('  ', 'något')).toBe(false);
    expect(skillHitsText('Excel', '')).toBe(false);
  });
});

describe('labelsInText', () => {
  it('returns each canonical label once', () => {
    const found = labelsInText('Excel, Microsoft Excel och MS Excel', ['Excel', 'Excel']);
    expect(found).toEqual(['Excel']);
  });

  it('preserves the order of the label list', () => {
    const found = labelsInText('Python, SQL och Docker', ['SQL', 'Docker', 'Python']);
    expect(found).toEqual(['SQL', 'Docker', 'Python']);
  });
});

describe('cvCoverage', () => {
  it('splits skills into matched and missing', () => {
    const result = cvCoverage(['Excel', 'Python', 'SAP'], 'Vi söker dig med Excel och Python.');
    expect(result.matched).toEqual(['Excel', 'Python']);
    expect(result.missing).toEqual(['SAP']);
  });
});

describe('canonical labels', () => {
  it('folds synonyms onto one stored label', () => {
    expect(canonicalSkillLabel('microsoft excel')).toBe('Excel');
    expect(canonicalSkillLabel('  MS Office ')).toBe('Microsoft 365');
    expect(canonicalSkillLabel('k8s')).toBe('Kubernetes');
  });

  it('passes unknown skills through, trimmed', () => {
    expect(canonicalSkillLabel('  Truckförare ')).toBe('Truckförare');
    expect(canonicalSkillLabel('   ')).toBe('');
  });

  it('exposes every surface form for matching', () => {
    expect(skillMatchTerms('powerbi')).toContain('Power BI');
    expect(skillMatchTerms('powerbi')).toContain('powerbi');
  });

  it('de-duplicates a skill list case-insensitively after canonicalisation', () => {
    expect(normalizeSkillList(['Excel', 'microsoft excel', ' ', 'SQL', 'sql'])).toEqual([
      'Excel',
      'SQL',
    ]);
  });
});
