'use client';

import { normalizeMatchSnapshot, type MatchSnapshot } from '@jobbdjungeln/core';
import { useId, useState } from 'react';
import { getMatchBadge } from '@/components/jobs/match-badge-logic';
import { Badge, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * How well the CV covers an ad's requirements.
 *
 * A button + popover (not hover-only) so keyboard and touch users can open the
 * explanation when the score is uncertain. Colour never carries meaning alone —
 * the label always includes the fraction of krav.
 */
export function MatchBadge({
  jobId,
  match,
}: {
  jobId: string;
  match: MatchSnapshot | Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();

  const snapshot = normalizeMatchSnapshot(match);
  if (!snapshot) return null;

  const view = getMatchBadge(snapshot);

  const badge = (
    <Badge
      tone={view.tone}
      className={cn(view.uncertain && 'border border-dashed border-current/40 bg-transparent')}
    >
      {view.label}
    </Badge>
  );

  if (!view.tooltip) {
    return (
      <span data-job-id={jobId} className="inline-flex">
        {badge}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          aria-label={`${view.label} — visa detaljer`}
          aria-describedby={labelId}
          data-job-id={jobId}
        >
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent id={labelId} className="max-w-64 text-xs" align="end">
        {view.tooltip}
      </PopoverContent>
    </Popover>
  );
}
