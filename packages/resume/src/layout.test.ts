import { describe, expect, it } from 'vitest';
import { pageToColumns, type TextItem } from './layout.ts';
import {
  collapseLetterSpacing,
  parseEducation,
  parseExperience,
  splitSections,
} from './parse.ts';

/** Build a pdf.js-shaped text item at a position on the page. */
function item(str: string, x: number, y: number, width = str.length * 5): TextItem {
  return { str, transform: [10, 0, 0, 10, x, y], width, height: 10 };
}

describe('column detection', () => {
  it('reads a single-column page top to bottom', () => {
    const { main, aside } = pageToColumns(
      [item('Andra raden', 50, 700), item('Första raden', 50, 720)],
      595,
    );
    expect(main).toEqual(['Första raden', 'Andra raden']);
    expect(aside).toEqual([]);
  });

  it('keeps a sidebar out of the main column instead of interleaving it', () => {
    const items = [
      // Main column, x 200–500.
      item('ARBETSLIVSERFARENHET', 200, 720, 200),
      item('Utvecklare', 200, 700, 100),
      item('Acme AB', 200, 680, 100),
      item('Byggde tjänster i Python.', 200, 660, 200),
      item('Orderadministratör', 200, 620, 150),
      item('Beta AB', 200, 600, 100),
      // Sidebar, x 40–150 — vertically interleaved with the main column.
      item('KONTAKT', 40, 710, 80),
      item('anna@example.test', 40, 690, 100),
      item('KOMPETENSER', 40, 650, 100),
      item('Excel', 40, 630, 40),
    ];
    const { main, aside } = pageToColumns(items, 595);
    expect(main).toEqual([
      'ARBETSLIVSERFARENHET',
      'Utvecklare',
      'Acme AB',
      'Byggde tjänster i Python.',
      'Orderadministratör',
      'Beta AB',
    ]);
    expect(aside).toEqual(['KONTAKT', 'anna@example.test', 'KOMPETENSER', 'Excel']);
  });

  it('joins items on the same line, inserting the missing spaces', () => {
    const { main } = pageToColumns([item('Acme', 50, 700, 30), item('AB', 90, 700, 15)], 595);
    expect(main).toEqual(['Acme AB']);
  });

  it('ignores blank items and copes with an empty page', () => {
    expect(pageToColumns([], 595)).toEqual({ main: [], aside: [] });
    expect(pageToColumns([item('   ', 50, 700)], 595).main).toEqual([]);
  });

  it('does not split a page on an ordinary paragraph indent', () => {
    const items = Array.from({ length: 30 }, (_, index) =>
      item('En helt vanlig textrad på sidan', 60, 720 - index * 12, 470),
    );
    expect(pageToColumns(items, 595).aside).toEqual([]);
  });
});

describe('letter-spaced text', () => {
  it('collapses a spaced-out heading', () => {
    expect(collapseLetterSpacing('A R B E T S L I V S E R F A R E N H E T')).toBe(
      'ARBETSLIVSERFARENHET',
    );
    expect(collapseLetterSpacing('K O M P E T E N S E R')).toBe('KOMPETENSER');
  });

  it('recovers the word breaks it can see in a spaced-out date', () => {
    expect(collapseLetterSpacing('N O V E M B E R 2 0 1 8 – O K T O B E R 2 0 2 5')).toBe(
      'NOVEMBER 2018 – OKTOBER 2025',
    );
  });

  it('leaves ordinary text alone', () => {
    expect(collapseLetterSpacing('Ansvarig för löpande bokföring')).toBe(
      'Ansvarig för löpande bokföring',
    );
    expect(collapseLetterSpacing('A B C Konsult AB')).toBe('A B C Konsult AB');
    expect(collapseLetterSpacing('Excel')).toBe('Excel');
  });

  it('finds a section behind a letter-spaced heading', () => {
    const sections = splitSections('P R O F I L\nEn kort text om mig.');
    expect(sections.find((section) => section.name === 'profile')?.lines).toEqual([
      'En kort text om mig.',
    ]);
  });
});

describe('date placement', () => {
  it('reads a date that sits above the role', () => {
    const [entry] = parseExperience([
      'FEBRUARI 2020 – JULI 2024',
      'Business Operations Coordinator',
      'Acme AB',
      'Ansvarig för attestflöden.',
    ]);
    expect(entry).toMatchObject({
      role: 'Business Operations Coordinator',
      employer: 'Acme AB',
      start: 'FEBRUARI 2020',
      end: 'JULI 2024',
    });
  });

  it('does not mistake a wrapped description line for a new role', () => {
    const entries = parseExperience([
      'FEBRUARI 2020 – JULI 2024',
      'Koordinator',
      'Acme AB',
      'Central roll med ansvar för ekonomi, administration och uppföljning',
      'i ett växande bolag',
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.description).toContain('Central roll');
  });

  it('reads several roles in a row', () => {
    const entries = parseExperience([
      '2020 – 2024',
      'Koordinator',
      'Acme AB',
      'Beskrivning av rollen.',
      '2017 – 2020',
      'Orderadministratör',
      'Beta AB',
      'Annan beskrivning.',
    ]);
    expect(entries.map((entry) => entry.role)).toEqual(['Koordinator', 'Orderadministratör']);
    expect(entries[1]?.start).toBe('2017');
  });

  it('reads an education line that ends in a year', () => {
    const entries = parseEducation([
      'MS Teams & SharePoint för administratörer— Informator, 2022',
      'Tekniskt gymnasium— Värmdö Tekniska Gymnasium, 2010–2013',
    ]);
    expect(entries[0]).toMatchObject({
      program: 'MS Teams & SharePoint för administratörer',
      school: 'Informator',
      start: '2022',
    });
    expect(entries[1]).toMatchObject({
      program: 'Tekniskt gymnasium',
      school: 'Värmdö Tekniska Gymnasium',
      start: '2010',
      end: '2013',
    });
  });

  it('treats a bare year on its own line as the entry date', () => {
    const [entry] = parseEducation(['2024', 'Fullstack Development', 'Code Institute']);
    expect(entry).toMatchObject({
      program: 'Fullstack Development',
      school: 'Code Institute',
      start: '2024',
    });
  });
});
