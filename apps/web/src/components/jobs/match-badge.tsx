'use client';

import type { MatchSnapshot } from '@jobbdjungeln/core';
import { useId, useState } from 'react';
import { Badge, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';

const TOP_SKILLS = 5;

/**
 * How well the CV covers an ad's requirements.
 *
 * A button + popover (not hover-only) so keyboard and touch users can open the
 * explanation. The badge shows the fraction of krav so it cannot contradict
 * the detail text.
 */
export function MatchBadge({ jobId, match }: { jobId: string; match: MatchSnapshot | null }) {
  const [open, setOpen] = useState(false);
  const labelId = useId();

  if (!match) return null;

  if (match.score === null) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            aria-label="Matchning oklar — visa detaljer"
            aria-describedby={labelId}
            data-job-id={jobId}
          >
            <Badge tone="outline">Match oklar</Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent id={labelId} className="max-w-64 text-xs" align="end">
          Annonsen listar för få tydliga krav för att ge en rättvis siffra.
        </PopoverContent>
      </Popover>
    );
  }

  const tone =
    match.band === 'strong' ? 'positive' : match.band === 'medium' ? 'info' : 'neutral';
  const topCovered = match.covered.slice(0, TOP_SKILLS).map((item) => item.term);
  const topGaps = match.gaps.slice(0, TOP_SKILLS).map((item) => item.term);

  return (
    <Popover key={jobId} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          aria-label={`${match.mustCovered} av ${match.mustTotal} krav täckta — visa detaljer`}
          aria-describedby={labelId}
          data-job-id={jobId}
        >
          <Badge tone={tone}>
            {match.mustCovered} av {match.mustTotal} krav
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent id={labelId} className="max-w-72 space-y-1.5 text-xs" align="end">
        <p className="font-medium text-ink">
          Du täcker {match.mustCovered} av {match.mustTotal} krav
          {match.score !== null ? ` (${match.score}%)` : ''}.
        </p>
        {topCovered.length > 0 ? (
          <p className="text-muted">Hittade: {topCovered.join(', ')}</p>
        ) : null}
        {topGaps.length > 0 ? (
          <p className="text-subtle">Saknas: {topGaps.join(', ')}</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
