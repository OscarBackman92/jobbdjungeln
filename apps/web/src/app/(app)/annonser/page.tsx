import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { SearchPanel } from '@/components/jobs/search-panel';
import { Skeleton } from '@/components/ui';
import { requireUser } from '@/lib/session';
import { listSavedSearches } from '@/server/queries/jobs';

export const metadata: Metadata = { title: 'Annonser' };

export default async function JobsPage() {
  const user = await requireUser();
  const searches = await listSavedSearches(user.id);
  const savedSearches = searches.map((search) => ({
    id: search.id,
    label: search.label || search.query || 'Sparad sökning',
    query: search.query,
    regions: search.regions,
    municipalities: search.municipalities,
    occupationFields: search.occupationFields,
    occupationGroups: search.occupationGroups,
    remote: search.remote,
    matchCv: search.matchCv,
  }));

  return (
    <>
      <PageHeader
        title="Annonser"
        description="Söker hela Platsbanken live via Arbetsförmedlingens öppna API. Ingen inloggning där, inga cookies."
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <SearchPanel savedSearches={savedSearches} />
      </Suspense>
    </>
  );
}
