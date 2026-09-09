import { periodKey, today as todayIso } from '@jobbdjungeln/core';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { ReportView } from '@/components/report/report-view';
import { EmptyState } from '@/components/ui';
import { requireUser } from '@/lib/session';
import { listPeriods, periodDetail } from '@/server/queries/report';

export const metadata: Metadata = { title: 'Rapport' };

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ manad?: string }>;
}) {
  const user = await requireUser();
  const { manad } = await searchParams;

  const today = todayIso();
  const [year, month] = today.split('-').map(Number) as [number, number];
  const periods = await listPeriods(user.id, today);
  const requested = manad ?? periods[0]?.key ?? periodKey(year, month);
  const detail = await periodDetail(user.id, requested, today);

  return (
    <>
      <PageHeader
        title="Rapport"
        description="Månadens aktiviteter, i den ordning Arbetsförmedlingens formulär frågar efter dem."
      />
      {detail ? (
        <ReportView period={detail} periods={periods} />
      ) : (
        <EmptyState title="Månaden finns inte" description="Välj en annan månad i listan." />
      )}
    </>
  );
}
