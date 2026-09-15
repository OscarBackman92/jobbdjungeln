import { describe, expect, it } from 'vitest';
import { formatPlainAdText, sanitizeJobHtml } from '@/components/jobs/sanitize-ad-html';

describe('sanitizeJobHtml', () => {
  it('keeps safe tags and strips scripts and attributes', () => {
    const html = sanitizeJobHtml(
      '<p onclick="alert(1)">Hej <strong>du</strong></p><script>evil()</script><a href="https://x.test">länk</a>',
    );
    expect(html).toContain('<p>');
    expect(html).toContain('<strong>du</strong>');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('script');
    expect(html).not.toContain('<a');
    expect(html).toContain('länk');
  });
});

describe('formatPlainAdText', () => {
  it('splits stuck Swedish headings', () => {
    expect(
      formatPlainAdText('ArbetsuppgifterDu utvecklar.Vi erbjuderFast anställning.'),
    ).toContain('Arbetsuppgifter');
    expect(formatPlainAdText('ArbetsuppgifterDu utvecklar.')).toMatch(/Arbetsuppgifter\n/);
  });
});
