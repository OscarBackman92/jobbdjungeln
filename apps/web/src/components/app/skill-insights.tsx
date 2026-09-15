'use client';

import type { SkillInsights } from '@jobbdjungeln/core';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { addSkillToResumeAction } from '@/server/actions/resume';

const INSIGHT_MIN = 10;

function rateLabel(band: SkillInsights['responseByBand'][number]): string {
  if (band.insufficientData || band.rate === null) return 'För lite data';
  return `${Math.round(band.rate * 100)} % svar`;
}

function bandInsight(bands: SkillInsights['responseByBand']): string | null {
  const scored = bands.filter(
    (band) => band.band !== 'ej bedömd' && band.tracked >= INSIGHT_MIN && band.rate !== null,
  );
  if (scored.length < 2) return null;
  const best = [...scored].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];
  const worst = [...scored].sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))[0];
  if (!best || !worst || best.band === worst.band) return null;
  return `Du fick oftast svar på jobb med ${best.band} % match (${Math.round((best.rate ?? 0) * 100)} %), oftare än med ${worst.band} % (${Math.round((worst.rate ?? 0) * 100)} %).`;
}

function searchHrefForTerm(term: string): string {
  const params = new URLSearchParams({ q: term });
  try {
    const regions = globalThis.localStorage?.getItem('jobbdjungeln-last-region');
    const municipalities = globalThis.localStorage?.getItem('jobbdjungeln-last-municipalities');
    if (regions) {
      for (const id of JSON.parse(regions) as string[]) params.append('region', id);
    }
    if (municipalities) {
      for (const id of JSON.parse(municipalities) as string[]) params.append('kommun', id);
    }
  } catch {
    // Ignore storage errors.
  }
  return `/annonser?${params}`;
}

export function SkillInsightsCard({ insights }: { insights: SkillInsights }) {
  const router = useRouter();
  const [pendingTerm, setPendingTerm] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { scope, gapTerms, responseByBand } = insights;
  const withSnapshot = scope.withSnapshot;
  const insight = bandInsight(responseByBand);

  function addTerm(term: string) {
    setPendingTerm(term);
    startTransition(async () => {
      const result = await addSkillToResumeAction(term);
      setPendingTerm(null);
      if (result.ok) {
        toast(`${term} tillagd i kompetenser`, {
          duration: 8000,
          description: 'Läggs till i dina kompetenser – lägg bara till sådant du kan stå för.',
          cancel: {
            label: 'Ångra',
            onClick: () => {
              toast.message('Ta bort kompetensen under Profil om du ångrade dig.');
            },
          },
        });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Kompetenskoll</CardTitle>
        <CardDescription>
          {withSnapshot === 0
            ? scope.hint
            : `${withSnapshot} av ${scope.applications} spårade har matchningsdata${
                scope.since ? ` sedan ${scope.since}` : ''
              }.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Svar per matchning</h3>
          {insight ? <p className="mt-2 text-[13px] text-muted">{insight}</p> : null}
          <ul className="mt-2 flex flex-col gap-2">
            {responseByBand.map((band) => (
              <li key={band.band} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted">
                  {band.band === 'ej bedömd' ? band.band : `${band.band} %`}
                </span>
                <span className="text-right">
                  <strong className="font-medium text-ink">{rateLabel(band)}</strong>
                  <span className="mt-0.5 block text-[12px] text-subtle">
                    {band.tracked} spårade · {band.responded} svar
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Krav du oftast saknar</h3>
          {gapTerms.length === 0 ? (
            <p className="mt-2 text-sm text-muted">För lite data än</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {gapTerms.slice(0, 8).map((row) => (
                <li key={row.term} className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="truncate text-sm font-medium text-brand-text underline-offset-2 hover:underline"
                      onClick={() => router.push(searchHrefForTerm(row.term))}
                    >
                      {row.term}
                    </button>
                    <p className="text-[12px] text-subtle">
                      efterfrågas i {row.count} av {withSnapshot}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending && pendingTerm === row.term}
                    onClick={() => addTerm(row.term)}
                    title="Läggs till i dina kompetenser – lägg bara till sådant du kan stå för."
                  >
                    {pending && pendingTerm === row.term ? 'Lägger till…' : 'Jag kan detta'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
