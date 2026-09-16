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
import { SkillInsightsCard } from '@/components/app/skill-insights';
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
import { skillInsights } from '@/server/queries/insights';

export const metadata: Metadata = { title: 'Översikt' };

const ACTION_LABELS = {
  follow_up: 'Uppföljning',
  apply_by: 'Egen påminnelse',
  deadline: 'Sista ansökningsdag',
  waiting: 'Väntar för länge',
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

function actionHref(board: 'saved' | 'applied', id: string): string {
  const base = board === 'saved' ? '/sparade' : '/ansokningar';
  return `${base}?rad=${encodeURIComponent(id)}`;
}

export default async function OverviewPage() {
  const user = await requireUser();
  const [summary, insights] = await Promise.all([dashboard(user.id), skillInsights(user.id)]);
  const nothingYet = summary.saved === 0 && summary.active === 0 && summary.closed === 0;
  const paceLabel = summary.pace.toFixed(1).replace('.', ',');
  const outcomeEntries = (Object.entries(summary.outcomes) as [Outcome, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

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
              href="/ansokningar?grupp=vantar_for_lange"
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
              href="/ansokningar?grupp=avslutade"
              icon={TrendingUp}
            />
          </section>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Nästa steg</CardTitle>
                <CardDescription>Det du bör göra de närmaste 7 dagarna.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                {summary.nextActions.length === 0 ? (
                  <p className="py-4 text-sm text-muted">
                    {summary.nextDeadline
                      ? `Inget brådskar. Nästa deadline: ${summary.nextDeadline.title} om ${summary.nextDeadline.days} dagar.`
                      : 'Inget brådskar just nu.'}
                  </p>
                ) : (
                  <ul className="flex min-w-0 flex-col divide-y divide-line">
                    {summary.nextActions.map((action) => (
                      <li key={`${action.id}-${action.kind}`} className="first:pt-0">
                        <Link
                          href={actionHref(action.board, action.id)}
                          className="flex min-w-0 flex-col gap-1 py-2.5 outline-none hover:bg-hover sm:flex-row sm:items-center sm:gap-3"
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
                              <p className="truncate text-[13px] text-subtle">
                                {action.company}
                              </p>
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
                              {action.kind === 'waiting'
                                ? 'Följ upp'
                                : formatRelativeDays(action.due)}
                            </p>
                            <p className="truncate text-[11px] text-subtle">
                              {ACTION_LABELS[action.kind]}
                              {action.kind !== 'waiting'
                                ? ` ${formatShortDate(action.due)}`
                                : ''}
                            </p>
                          </div>
                        </Link>
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
              <CardContent className="flex flex-col gap-4">
                <Funnel steps={summary.funnel} />
                {outcomeEntries.length > 0 ? (
                  <div className="border-t border-line pt-3">
                    <p className="mb-2 text-[13px] font-medium text-ink">Avslutade utfall</p>
                    <ul className="flex flex-wrap gap-2">
                      {outcomeEntries.map(([outcome, count]) => (
                        <li key={outcome}>
                          <Badge tone="neutral">
                            {OUTCOME_LABELS[outcome]} {count}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="min-w-0 lg:col-span-2">
              <CardHeader>
                <CardTitle>Sökta jobb per månad</CardTitle>
                <CardDescription>De senaste sex månaderna.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyChart points={summary.monthly} />
              </CardContent>
            </Card>
          </div>

          <SkillInsightsCard insights={insights} />

          <section aria-label="Fördelning" className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sparade jobb</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(summary.savedLanes).map(([lane, count]) => (
                  <Link
                    key={lane}
                    href={`/sparade?grupp=${lane}`}
                    className={count === 0 ? 'pointer-events-none opacity-40' : undefined}
                  >
                    <Badge
                      tone={
                        (lane === 'utgangna' || lane === 'idag_imorgon') && count > 0
                          ? 'warning'
                          : 'neutral'
                      }
                      className={count > 0 ? 'hover:bg-hover' : undefined}
                    >
                      {SAVED_LANE_LABELS[lane as keyof typeof SAVED_LANE_LABELS]} {count}
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ansökningar</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(summary.appliedLanes).map(([lane, count]) => (
                  <Link
                    key={lane}
                    href={`/ansokningar?grupp=${lane}`}
                    className={count === 0 ? 'pointer-events-none opacity-40' : undefined}
                  >
                    <Badge
                      tone={lane === 'vantar_for_lange' && count > 0 ? 'warning' : 'neutral'}
                      className={count > 0 ? 'hover:bg-hover' : undefined}
                    >
                      {APPLIED_LANE_LABELS[lane as keyof typeof APPLIED_LANE_LABELS]} {count}
                    </Badge>
                  </Link>
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
