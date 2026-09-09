'use client';

import type { MatchSnapshot } from '@jobbdjungeln/core';
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui';

/**
 * How well the CV covers an ad's requirements.
 *
 * The number is deliberately withheld when the ad is too thin to judge — a made
 * up 40 % is worse than saying nothing, because people act on these. The
 * tooltip always shows what was found and what was missing, so the score is
 * never a black box.
 */
export function MatchBadge({ match }: { match: MatchSnapshot | null }) {
  if (!match) return null;

  if (match.score === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge tone="outline">Match oklar</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Annonsen listar för få tydliga krav för att ge en rättvis siffra.
        </TooltipContent>
      </Tooltip>
    );
  }

  const tone =
    match.band === 'strong' ? 'positive' : match.band === 'medium' ? 'info' : 'neutral';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge tone={tone}>{match.score}% match</Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">
          Du täcker {match.mustCovered} av {match.mustTotal} krav.
        </p>
        {match.covered.length > 0 ? (
          <p className="mt-1">Hittade: {match.covered.map((item) => item.term).join(', ')}</p>
        ) : null}
        {match.gaps.length > 0 ? (
          <p className="mt-1 text-subtle">
            Saknas: {match.gaps.map((item) => item.term).join(', ')}
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
