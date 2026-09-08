import { describe, expect, it } from 'vitest';
import { detectKind, extractText, MAX_UPLOAD_BYTES, ResumeParseError } from './extract.ts';
import {
  findSkills,
  parseEducation,
  parseExperience,
  parseResume,
  splitSections,
} from './parse.ts';

const CV = `Anna Andersson
Ekonomiassistent
anna.andersson@example.test
070-123 45 67

Profil
Noggrann ekonomiassistent med sex års erfarenhet av leverantörsreskontra.

Kompetenser
Excel • Fortnox • Visma • SQL
Bokföring, Attest

Arbetslivserfarenhet
Ekonomiassistent – Acme AB
2020 – Pågående
Ansvarig för leverantörsreskontra och attestflöden i Fortnox.
• Månadsavstämningar i Excel

Ekonomiassistent, Beta Handel AB
2017 – 2020
Kundreskontra och fakturering.

Utbildning
Ekonomiprogrammet – Handelshögskolan
2014 – 2017

Referenser
Lämnas på begäran.
`;

describe('splitSections', () => {
  const sections = splitSections(CV);

  it('keeps everything before the first heading as the header', () => {
    expect(sections[0]?.name).toBe('header');
    expect(sections[0]?.lines[0]).toBe('Anna Andersson');
  });

  it('finds each recognised section', () => {
    const names = sections.map((section) => section.name);
    expect(names).toContain('profile');
    expect(names).toContain('skills');
    expect(names).toContain('experience');
    expect(names).toContain('education');
    expect(names).toContain('ignore');
  });

  it('prefers the longest matching heading', () => {
    // "Arbetslivserfarenhet" must not be read as the shorter "erfarenhet".
    const experience = splitSections('Arbetslivserfarenhet\nUtvecklare – Acme AB\n2020 – 2022');
    expect(experience.some((section) => section.name === 'experience')).toBe(true);
  });

  it('drops page numbers and blank lines', () => {
    const sections = splitSections('Profil\n\n1\nEn rad\nSida 2\n');
    expect(sections.find((section) => section.name === 'profile')?.lines).toEqual(['En rad']);
  });
});

describe('findSkills', () => {
  it('reads an explicit skills list, whatever the separator', () => {
    const skills = findSkills('', ['Excel • Fortnox • Visma', 'Bokföring, Attest']);
    expect(skills).toContain('Excel');
    expect(skills).toContain('Fortnox');
    expect(skills).toContain('Visma');
    expect(skills).toContain('Bokföring');
    expect(skills).toContain('Attest');
  });

  it('picks up known skills mentioned in the body text', () => {
    expect(findSkills('Jag har arbetat mycket i Power BI och SQL.', [])).toEqual(
      expect.arrayContaining(['Power BI', 'SQL']),
    );
  });

  it('does not mistake a sentence for a skill', () => {
    const skills = findSkills('', [
      'Jag är en noggrann person som trivs bäst när jag får arbeta självständigt',
    ]);
    expect(skills).toEqual([]);
  });

  it('canonicalises and de-duplicates', () => {
    const skills = findSkills('', ['Microsoft Excel, excel, MS Excel']);
    expect(skills).toEqual(['Excel']);
  });
});

describe('parseExperience', () => {
  it('reads role, employer and dates when the date is on its own line', () => {
    const [first] = parseExperience([
      'Ekonomiassistent – Acme AB',
      '2020 – Pågående',
      'Ansvarig för leverantörsreskontra.',
    ]);
    expect(first).toMatchObject({
      role: 'Ekonomiassistent',
      employer: 'Acme AB',
      start: '2020',
      end: 'Pågående',
    });
    expect(first?.description).toContain('leverantörsreskontra');
  });

  it('reads an entry where the date trails the role', () => {
    const [first] = parseExperience(['Utvecklare, Beta AB 2017 – 2020', 'Byggde API:er.']);
    expect(first).toMatchObject({
      role: 'Utvecklare',
      employer: 'Beta AB',
      start: '2017',
      end: '2020',
    });
  });

  it('normalises every way of writing "still there"', () => {
    for (const ongoing of ['Pågående', 'nuvarande', 'present', 'idag']) {
      const [entry] = parseExperience([`Roll – Acme AB`, `2020 – ${ongoing}`]);
      expect(entry?.end).toBe('Pågående');
    }
  });

  it('tags each entry with the skills its text mentions', () => {
    const [first] = parseExperience([
      'Ekonomiassistent – Acme AB',
      '2020 – 2022',
      'Attestflöden i Fortnox och avstämningar i Excel.',
    ]);
    expect(first?.skills).toEqual(expect.arrayContaining(['Fortnox', 'Excel']));
  });

  it('ignores lines it cannot place rather than inventing an entry', () => {
    expect(parseExperience(['Lite löst prat utan datum alls.'])).toEqual([]);
    expect(parseExperience([])).toEqual([]);
  });
});

describe('parseEducation', () => {
  it('reads programme, school and years', () => {
    const [first] = parseEducation(['Ekonomiprogrammet – Handelshögskolan', '2014 – 2017']);
    expect(first).toMatchObject({
      program: 'Ekonomiprogrammet',
      school: 'Handelshögskolan',
      start: '2014',
      end: '2017',
    });
  });

  it('falls back to the following line for the school', () => {
    const [first] = parseEducation([
      'Systemvetenskap',
      '2014 – 2017',
      'Linköpings universitet',
    ]);
    expect(first?.school).toBe('Linköpings universitet');
  });
});

describe('parseResume', () => {
  const parsed = parseResume(CV);

  it('reads the headline from the top of the CV', () => {
    expect(parsed.headline).toBe('Ekonomiassistent');
  });

  it('reads the profile text as the summary', () => {
    expect(parsed.summary).toContain('leverantörsreskontra');
  });

  it('collects skills from the list and the body', () => {
    expect(parsed.skills).toEqual(
      expect.arrayContaining(['Excel', 'Fortnox', 'Visma', 'SQL', 'Bokföring']),
    );
  });

  it('reads both jobs', () => {
    expect(parsed.experience).toHaveLength(2);
    expect(parsed.experience[0]?.employer).toBe('Acme AB');
    expect(parsed.experience[1]?.employer).toBe('Beta Handel AB');
  });

  it('reads the education entry', () => {
    expect(parsed.education).toHaveLength(1);
    expect(parsed.education[0]?.program).toBe('Ekonomiprogrammet');
  });

  it('surfaces contact details so the user can check them', () => {
    expect(parsed.contact.email).toBe('anna.andersson@example.test');
    expect(parsed.contact.phone).toBe('070-123 45 67');
  });

  it('leaves ignored sections out of the draft entirely', () => {
    expect(JSON.stringify(parsed)).not.toContain('Lämnas på begäran');
  });

  it('returns an empty draft for empty input instead of throwing', () => {
    const empty = parseResume('');
    expect(empty.skills).toEqual([]);
    expect(empty.experience).toEqual([]);
    expect(empty.headline).toBe('');
  });
});

describe('upload handling', () => {
  it('recognises supported formats by extension and by content type', () => {
    expect(detectKind('cv.pdf')).toBe('pdf');
    expect(detectKind('cv.DOCX')).toBe('docx');
    expect(detectKind('cv.txt')).toBe('txt');
    expect(detectKind('cv', 'application/pdf')).toBe('pdf');
    expect(detectKind('cv.pages')).toBeNull();
  });

  it('reads a plain-text CV', async () => {
    const data = new TextEncoder().encode('Anna Andersson\nEkonom');
    await expect(extractText('cv.txt', data)).resolves.toContain('Anna Andersson');
  });

  it('refuses an unsupported format', async () => {
    const data = new TextEncoder().encode('x');
    await expect(extractText('cv.pages', data)).rejects.toBeInstanceOf(ResumeParseError);
  });

  it('refuses an empty or oversized file', async () => {
    await expect(extractText('cv.txt', new Uint8Array())).rejects.toBeInstanceOf(
      ResumeParseError,
    );
    await expect(
      extractText('cv.txt', new Uint8Array(MAX_UPLOAD_BYTES + 1)),
    ).rejects.toBeInstanceOf(ResumeParseError);
  });

  it('refuses a file whose contents do not match its extension', async () => {
    const notAPdf = new TextEncoder().encode('bara text, inte en pdf');
    await expect(extractText('cv.pdf', notAPdf)).rejects.toThrow(/ser inte ut som en PDF/);
  });

  it('explains what to do when a PDF holds no text', async () => {
    await expect(extractText('cv.txt', new TextEncoder().encode('   '))).rejects.toThrow(
      /Ingen text hittades/,
    );
  });
});
