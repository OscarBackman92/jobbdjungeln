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

function rateLabel(band: SkillInsights['responseByBand'][number]): string {
  if (band.insufficientData || band.rate === null) return 'för lite data';
  return `${Math.round(band.rate * 100)} % svar`;
}

export function SkillInsightsCard({ insights }: { insights: SkillInsights }) {
  const router = useRouter();
  const [pendingTerm, setPendingTerm] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { scope, gapTerms, responseByBand } = insights;
  const withSnapshot = scope.withSnapshot;

  function addTerm(term: string) {
    setPendingTerm(term);
    startTransition(async () => {
      const result = await addSkillToResumeAction(term);
      setPendingTerm(null);
      if (result.ok) {
        toast.success(`${term} är tillagd i CV:t`);
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
            <p className="mt-2 text-sm text-muted">Inga gap ännu — spara fler annonser.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {gapTerms.slice(0, 8).map((row) => (
                <li key={row.term} className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="truncate text-sm font-medium text-brand-text underline-offset-2 hover:underline"
                      onClick={() => router.push(`/annonser?q=${encodeURIComponent(row.term)}`)}
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
                  >
                    {pending && pendingTerm === row.term ? 'Lägger till…' : '+ lägg till'}
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
