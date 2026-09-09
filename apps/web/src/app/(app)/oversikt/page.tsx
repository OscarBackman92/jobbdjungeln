import {
  APPLIED_LANE_LABELS,
  formatRelativeDays,
  formatShortDate,
  OUTCOME_LABELS,
  type Outcome,
  plural,
  SAVED_LANE_LABELS,
} from '@jobbdjungeln/core';
import {
  AlertTriangle,
  Bookmark,
  CalendarClock,
  MessageSquare,
  Send,
  TrendingUp,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { StatTile } from '@/components/app/stat-tile';
import { Funnel } from '@/components/charts/funnel';
import { MonthlyChart } from '@/components/charts/monthly';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/ui';
import { requireUser } from '@/lib/session';
import { dashboard } from '@/server/queries/board';

export const metadata: Metadata = { title: 'Översikt' };

const ACTION_LABELS = {
  follow_up: 'Följ upp',
  apply_by: 'Sök senast',
  deadline: 'Sista ansökningsdag',
} as const;

function savedHint(lanes: {
  utgangna: number;
  idag_imorgon: number;
  denna_vecka: number;
}): string {
  const expired = lanes.utgangna;
  const urgent = lanes.idag_imorgon + lanes.denna_vecka;
  if (expired > 0 && urgent > 0) {
    return `${plural(expired, 'utgången', 'utgångna')}, ${urgent} brådskar`;
  }
  if (expired > 0) return plural(expired, 'utgången', 'utgångna');
  if (urgent > 0) return `${urgent} brådskar`;
  return 'inget brådskar';
}

export default async function OverviewPage() {
  const user = await requireUser();
  const summary = await dashboard(user.id);
  const nothingYet = summary.saved === 0 && summary.active === 0 && summary.closed === 0;
  const paceLabel = summary.pace.toFixed(1).replace('.', ',');

  return (
    <>
      <PageHeader
        title="Översikt"
        description="Var ditt jobbsök står just nu, och vad som behöver göras härnäst."
      />

      {nothingYet ? (
        <EmptyState
          icon={Bookmark}
          title="Här samlas hela ditt jobbsök"
          description="Sök i Platsbanken och spara annonser du vill söka, eller lägg in en ansökan du redan skickat. Resten av den här sidan fyller i sig själv."
          action={
            <Link
              href="/annonser"
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-brand px-4 text-sm font-medium text-on-brand"
            >
              Sök jobb
            </Link>
          }
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Nyckeltal" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Sparade jobb"
              value={summary.saved}
              hint={savedHint(summary.savedLanes)}
              href="/sparade"
              icon={Bookmark}
            />
            <StatTile
              label="Pågående"
              value={summary.active}
              hint={`${summary.inDialog} i dialog`}
              href="/ansokningar"
              icon={Send}
            />
            <StatTile
              label="Väntar för länge"
              value={summary.waitingTooLong}
              hint={summary.waitingTooLong > 0 ? 'hör av dig' : 'inget att jaga'}
              href="/ansokningar"
              icon={AlertTriangle}
              tone={summary.waitingTooLong > 0 ? 'warning' : 'neutral'}
            />
            <StatTile
              label="Svarsfrekvens"
              value={summary.responseRate === null ? '–' : `${summary.responseRate}%`}
              hint={
                summary.responseRate === null
                  ? 'för få ansökningar än'
                  : `${paceLabel} ansökningar/vecka`
              }
              icon={TrendingUp}
            />
          </section>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Nästa steg</CardTitle>
                <CardDescription>Det som har en dag satt för sig.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                {summary.nextActions.length === 0 ? (
                  <p className="py-4 text-sm text-muted">
                    Inget inplanerat. Sätt en uppföljningsdag på en ansökan så dyker den upp
                    här.
                  </p>
                ) : (
                  <ul className="flex min-w-0 flex-col divide-y divide-line">
                    {summary.nextActions.map((action) => (
                      <li
                        key={`${action.id}-${action.kind}`}
                        className="flex min-w-0 flex-col gap-1 py-2.5 first:pt-0 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <CalendarClock
                            className={
                              action.overdue
                                ? 'mt-0.5 size-4 shrink-0 text-warning'
                                : 'mt-0.5 size-4 shrink-0 text-subtle'
                            }
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">
                              {action.title}
                            </p>
                            <p className="truncate text-[13px] text-subtle">{action.company}</p>
                          </div>
                        </div>
                        <div className="min-w-0 pl-7 sm:shrink-0 sm:pl-0 sm:text-right">
                          <p
                            className={
                              action.overdue
                                ? 'truncate text-[13px] font-medium text-warning-text'
                                : 'truncate text-[13px] text-muted'
                            }
                          >
                            {formatRelativeDays(action.due)}
                          </p>
                          <p className="truncate text-[11px] text-subtle">
                            {ACTION_LABELS[action.kind]} {formatShortDate(action.due)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Från sökt till erbjudande</CardTitle>
                <CardDescription>Hur långt dina ansökningar har kommit.</CardDescription>
              </CardHeader>
              <CardContent>
                <Funnel steps={summary.funnel} />
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Sökta jobb per månad</CardTitle>
                <CardDescription>De senaste sex månaderna.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyChart points={summary.monthly} />
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Så här har det gått</CardTitle>
                <CardDescription>Avslutade ansökningar, per utfall.</CardDescription>
              </CardHeader>
              <CardContent>
                {summary.closed === 0 ? (
                  <p className="py-4 text-sm text-muted">Inga avslutade ansökningar ännu.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(Object.entries(summary.outcomes) as [Outcome, number][])
                      .filter(([, count]) => count > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([outcome, count]) => (
                        <li key={outcome} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-muted">{OUTCOME_LABELS[outcome]}</span>
                          <span className="text-sm font-medium tabular-nums text-ink">
                            {count}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <section aria-label="Fördelning" className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sparade jobb</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(summary.savedLanes).map(([lane, count]) => (
                  <Badge
                    key={lane}
                    tone={
                      (lane === 'utgangna' || lane === 'idag_imorgon') && count > 0
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {SAVED_LANE_LABELS[lane as keyof typeof SAVED_LANE_LABELS]} {count}
                  </Badge>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ansökningar</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(summary.appliedLanes).map(([lane, count]) => (
                  <Badge
                    key={lane}
                    tone={lane === 'vantar_for_lange' && count > 0 ? 'warning' : 'neutral'}
                  >
                    {APPLIED_LANE_LABELS[lane as keyof typeof APPLIED_LANE_LABELS]} {count}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </section>

          {summary.staleCount > 0 ? (
            <p className="flex items-center gap-2 rounded-[var(--radius-card)] border border-line bg-sunken px-4 py-3 text-sm text-muted">
              <MessageSquare className="size-4 shrink-0 text-subtle" aria-hidden />
              {plural(summary.staleCount, 'ansökan har', 'ansökningar har')} varit tyst i över
              45 dagar. Det är rimligt att sätta dem till <em>Inget svar</em> och rensa vyn.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
