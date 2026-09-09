import { APPLIED_LANE_HINTS, APPLIED_LANE_LABELS, type AppliedLane } from '@jobbdjungeln/core';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { BoardView, type LaneSpec } from '@/components/board/board-view';
import { NewApplicationButton } from '@/components/board/new-application';
import { Skeleton } from '@/components/ui';
import { requireUser } from '@/lib/session';
import { appliedBoard } from '@/server/queries/board';

export const metadata: Metadata = { title: 'Ansökningar' };

/** What needs chasing comes first; what is finished comes last, collapsed. */
const LANE_ORDER: readonly AppliedLane[] = [
  'vantar_for_lange',
  'erbjudande',
  'i_dialog',
  'nyligen_sokta',
  'avslutade',
];

async function AppliedBoard({
  search,
  archived,
}: {
  search: string | undefined;
  archived: boolean;
}) {
  const user = await requireUser();
  const { lanes } = await appliedBoard(user.id, { search, archived });

  const specs: LaneSpec[] = LANE_ORDER.map((lane) => ({
    key: lane,
    title: APPLIED_LANE_LABELS[lane],
    hint: APPLIED_LANE_HINTS[lane],
    tone: lane === 'vantar_for_lange' ? 'warning' : 'neutral',
    defaultOpen: lane !== 'avslutade',
    rows: lanes[lane],
  }));

  return (
    <BoardView
      lanes={specs}
      variant="applied"
      emptyTitle="Inga ansökningar ännu"
      emptyDescription="När du markerar ett sparat jobb som sökt hamnar det här. Du kan också lägga in en ansökan du redan skickat."
      emptyAction={<NewApplicationButton defaultStatus="applied" label="Lägg till ansökan" />}
    />
  );
}

export default async function AppliedPage({
  searchParams,
}: {
  searchParams: Promise<{ sok?: string; arkiverade?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Ansökningar"
        description="Allt du sökt, grupperat efter vad som behöver göras."
        actions={<NewApplicationButton defaultStatus="applied" label="Lägg till ansökan" />}
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AppliedBoard search={params.sok} archived={params.arkiverade === '1'} />
      </Suspense>
    </>
  );
}
