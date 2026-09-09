import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Funnel } from './funnel';

const STEPS = [
  { stage: 'sokt' as const, count: 12, share: 100 },
  { stage: 'kontakt' as const, count: 5, share: 42 },
  { stage: 'intervju' as const, count: 2, share: 17 },
  { stage: 'erbjudande' as const, count: 1, share: 8 },
];

describe('Funnel', () => {
  it('labels every bar with its own value, not just the axis', () => {
    render(<Funnel steps={STEPS} />);
    // Scoped to the bars: the same numbers appear again in the table view.
    const bars = within(screen.getByRole('list'));
    for (const step of STEPS) {
      expect(bars.getByText(String(step.count))).toBeVisible();
      expect(bars.getByText(`${step.share}%`)).toBeVisible();
    }
  });

  it('offers a table view, so the numbers do not depend on seeing the chart', () => {
    render(<Funnel steps={STEPS} />);
    expect(screen.getByText('Visa som tabell')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Steg' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Antal' })).toBeInTheDocument();
  });

  it('says what is missing instead of drawing an empty chart', () => {
    render(<Funnel steps={STEPS.map((step) => ({ ...step, count: 0, share: 0 }))} />);
    expect(screen.getByText(/Tratten fylls när du markerat/)).toBeVisible();
  });
});
