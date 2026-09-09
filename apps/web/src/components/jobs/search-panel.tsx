'use client';

import { plural } from '@jobbdjungeln/core';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { JobCard, type JobHit } from '@/components/jobs/job-card';
import { SavedSearches } from '@/components/jobs/saved-searches';
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui';

interface TaxonomyOption {
  id: string;
  label: string;
}

interface Filters {
  regions: TaxonomyOption[];
  fields: TaxonomyOption[];
  municipalities: TaxonomyOption[];
  groups: TaxonomyOption[];
}

export interface SearchState {
  q: string;
  region: string;
  municipality: string;
  field: string;
  group: string;
  remote: boolean;
}

const EMPTY: SearchState = {
  q: '',
  region: '',
  municipality: '',
  field: '',
  group: '',
  remote: false,
};
const PAGE_SIZE = 20;
const ANY = '__alla__';

function toParams(state: SearchState, offset: number): string {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.municipality) params.set('kommun', state.municipality);
  else if (state.region) params.set('region', state.region);
  if (state.group) params.set('yrkesgrupp', state.group);
  else if (state.field) params.set('omrade', state.field);
  if (state.remote) params.set('distans', '1');
  params.set('offset', String(offset));
  params.set('limit', String(PAGE_SIZE));
  return params.toString();
}

/**
 * Live search over the whole of Platsbanken.
 *
 * The narrower filter wins over the broader one — picking a municipality makes
 * the region moot — which is what stops the two from fighting and returning
 * nothing. Results page in on demand rather than all at once.
 */
export function SearchPanel({
  savedSearches,
}: {
  savedSearches: Array<{
    id: string;
    label: string;
    query: string;
    regions: string[];
    municipalities: string[];
    occupationFields: string[];
    occupationGroups: string[];
    remote: boolean;
  }>;
}) {
  const [draft, setDraft] = useState<SearchState>(EMPTY);
  const [applied, setApplied] = useState<SearchState>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const remoteId = useId();

  const { data: filters } = useQuery<Filters>({
    queryKey: ['job-filters', applied.region, applied.field],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (draft.region) params.set('region', draft.region);
      if (draft.field) params.set('omrade', draft.field);
      const response = await fetch(`/api/jobs/filters?${params}`);
      if (!response.ok) throw new Error('Kunde inte hämta filtren.');
      return response.json();
    },
    staleTime: 60 * 60_000,
  });

  // Re-fetch the narrow lists when the broad choice changes.
  const { refetch: refetchFilters } = useQuery<Filters>({
    queryKey: ['job-filters-narrow', draft.region, draft.field],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (draft.region) params.set('region', draft.region);
      if (draft.field) params.set('omrade', draft.field);
      const response = await fetch(`/api/jobs/filters?${params}`);
      return response.json();
    },
    enabled: Boolean(draft.region || draft.field),
    staleTime: 60 * 60_000,
  });

  useEffect(() => {
    if (draft.region || draft.field) void refetchFilters();
  }, [draft.region, draft.field, refetchFilters]);

  const hasQuery = useMemo(
    () => Boolean(applied.q || applied.region || applied.field || applied.remote),
    [applied],
  );

  const { data, isFetching, isError, error, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ['jobs', applied],
      enabled: hasQuery,
      initialPageParam: 0,
      queryFn: async ({ pageParam }) => {
        const response = await fetch(`/api/jobs?${toParams(applied, pageParam)}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Sökningen misslyckades.');
        return payload as { total: number; results: JobHit[]; hasResume: boolean };
      },
      getNextPageParam: (last, pages) => {
        const loaded = pages.reduce((sum, page) => sum + page.results.length, 0);
        return loaded < last.total ? loaded : undefined;
      },
    });

  const hits = data?.pages.flatMap((page) => page.results) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const hasResume = data?.pages[0]?.hasResume ?? true;

  function apply(next: SearchState = draft) {
    setDraft(next);
    setApplied(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
              aria-hidden
            />
            <Input
              value={draft.q}
              onChange={(event) => setDraft({ ...draft, q: event.target.value })}
              placeholder="Yrke, företag eller ort"
              aria-label="Sök jobb"
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            // The label is hidden on a narrow screen, which would otherwise
            // leave an icon-only button with no accessible name at all.
            aria-label="Filter"
          >
            <SlidersHorizontal aria-hidden />
            <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button type="submit" variant="primary">
            Sök
          </Button>
        </div>

        {showFilters ? (
          <div className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-raised p-4 sm:grid-cols-2">
            <Field label="Län">
              {(props) => (
                <Select
                  value={draft.region || ANY}
                  onValueChange={(value) =>
                    setDraft({ ...draft, region: value === ANY ? '' : value, municipality: '' })
                  }
                >
                  <SelectTrigger {...props}>
                    <SelectValue placeholder="Hela landet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Hela landet</SelectItem>
                    {filters?.regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Kommun">
              {(props) => (
                <Select
                  value={draft.municipality || ANY}
                  onValueChange={(value) =>
                    setDraft({ ...draft, municipality: value === ANY ? '' : value })
                  }
                  disabled={!draft.region}
                >
                  <SelectTrigger {...props}>
                    <SelectValue placeholder={draft.region ? 'Hela länet' : 'Välj län först'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Hela länet</SelectItem>
                    {filters?.municipalities.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Yrkesområde">
              {(props) => (
                <Select
                  value={draft.field || ANY}
                  onValueChange={(value) =>
                    setDraft({ ...draft, field: value === ANY ? '' : value, group: '' })
                  }
                >
                  <SelectTrigger {...props}>
                    <SelectValue placeholder="Alla områden" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Alla områden</SelectItem>
                    {filters?.fields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Yrkesgrupp">
              {(props) => (
                <Select
                  value={draft.group || ANY}
                  onValueChange={(value) =>
                    setDraft({ ...draft, group: value === ANY ? '' : value })
                  }
                  disabled={!draft.field}
                >
                  <SelectTrigger {...props}>
                    <SelectValue
                      placeholder={draft.field ? 'Alla grupper' : 'Välj område först'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Alla grupper</SelectItem>
                    {filters?.groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <span className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id={remoteId}
                checked={draft.remote}
                onCheckedChange={(value) => setDraft({ ...draft, remote: value === true })}
              />
              <Label htmlFor={remoteId} className="font-normal">
                Endast jobb på distans
              </Label>
            </span>

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="primary" size="sm">
                Använd filtren
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => apply(EMPTY)}>
                <X aria-hidden />
                Rensa
              </Button>
            </div>
          </div>
        ) : null}
      </form>

      <SavedSearches searches={savedSearches} current={applied} onUse={apply} />

      {!hasQuery ? (
        <EmptyState
          icon={Search}
          title="Sök i hela Platsbanken"
          description="Skriv ett yrke, ett företag eller en ort. Alla annonser hämtas direkt från Arbetsförmedlingens öppna API."
        />
      ) : isError ? (
        <ErrorNote
          description={error instanceof Error ? error.message : 'Sökningen misslyckades.'}
          action={
            <Button size="sm" onClick={() => void refetch()}>
              Försök igen
            </Button>
          }
        />
      ) : isFetching && hits.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : hits.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Inga träffar"
          description="Prova ett bredare sökord, eller ta bort ett filter."
        />
      ) : (
        <>
          <p className="text-[13px] text-subtle" aria-live="polite">
            {plural(total, 'träff', 'träffar')}
            {!hasResume ? ' · lägg in ditt CV under Profil för att se hur väl du matchar' : ''}
          </p>
          <ul className="flex flex-col gap-3">
            {hits.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
          {hasNextPage ? (
            <Button
              variant="secondary"
              onClick={() => void fetchNextPage()}
              disabled={isFetching}
              className="self-center"
            >
              {isFetching ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Visa fler
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
