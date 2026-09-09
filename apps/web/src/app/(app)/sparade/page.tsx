import { SAVED_LANE_HINTS, SAVED_LANE_LABELS, type SavedLane } from '@jobbdjungeln/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { BoardView, type LaneSpec } from '@/components/board/board-view';
import { NewApplicationButton } from '@/components/board/new-application';
import { Skeleton } from '@/components/ui';
import { requireUser } from '@/lib/session';
import { savedBoard } from '@/server/queries/board';

export const metadata: Metadata = { title: 'Sparade jobb' };

/** Urgent first: the whole point of the view is what runs out soonest. */
const LANE_ORDER: readonly SavedLane[] = [
  'utgangna',
  'brattom',
  'denna_manad',
  'utan_datum',
  'pa_is',
];

async function SavedBoard({
  search,
  archived,
}: {
  search: string | undefined;
  archived: boolean;
}) {
  const user = await requireUser();
  const { lanes } = await savedBoard(user.id, { search, archived });

  const specs: LaneSpec[] = LANE_ORDER.map((lane) => ({
    key: lane,
    title: SAVED_LANE_LABELS[lane],
    hint: SAVED_LANE_HINTS[lane],
    tone: lane === 'brattom' || lane === 'utgangna' ? 'warning' : 'neutral',
    defaultOpen: lane !== 'pa_is',
    rows: lanes[lane],
  }));

  return (
    <BoardView
      lanes={specs}
      variant="saved"
      showDeadline
      emptyTitle="Inga sparade jobb"
      emptyDescription="Sök i Platsbanken och spara annonserna du vill söka. De hamnar här, sorterade efter hur bråttom det är."
      emptyAction={
        <Link
          href="/annonser"
          className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-brand px-4 text-sm font-medium text-on-brand"
        >
          Sök jobb
        </Link>
      }
    />
  );
}

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ sok?: string; arkiverade?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Sparade jobb"
        description="Annonser du vill söka, grupperade efter när de behöver sökas."
        actions={<NewApplicationButton defaultStatus="wishlist" label="Nytt sparat jobb" />}
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SavedBoard search={params.sok} archived={params.arkiverade === '1'} />
      </Suspense>
    </>
  );
}
