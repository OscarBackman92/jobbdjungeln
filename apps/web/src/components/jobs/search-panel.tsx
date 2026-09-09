'use client';

import { plural } from '@jobbdjungeln/core';
import type { SearchSort } from '@jobbdjungeln/jobtech';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  sort: SearchSort;
  publishedAfter: string;
  noExperience: boolean;
}

const EMPTY: SearchState = {
  q: '',
  region: '',
  municipality: '',
  field: '',
  group: '',
  remote: false,
  sort: 'pubdate-desc',
  publishedAfter: '',
  noExperience: false,
};

const PAGE_SIZE = 20;
const ANY = '__alla__';

const PUBLISHED_CHIPS: ReadonlyArray<{ label: string; minutes: string }> = [
  { label: '24 timmar', minutes: String(24 * 60) },
  { label: '7 dagar', minutes: String(7 * 24 * 60) },
  { label: '30 dagar', minutes: String(30 * 24 * 60) },
];

const SORT_OPTIONS: ReadonlyArray<{ value: SearchSort; label: string }> = [
  { value: 'pubdate-desc', label: 'Nyast' },
  { value: 'relevance', label: 'Relevans' },
  { value: 'applydate-asc', label: 'Sista dag' },
];

function stateFromParams(params: URLSearchParams): SearchState {
  const sort = params.get('sort');
  const validSort = SORT_OPTIONS.some((option) => option.value === sort)
    ? (sort as SearchSort)
    : 'pubdate-desc';
  return {
    q: params.get('q') ?? '',
    region: params.get('region') ?? '',
    municipality: params.get('kommun') ?? '',
    field: params.get('omrade') ?? '',
    group: params.get('yrkesgrupp') ?? '',
    remote: params.get('distans') === '1',
    sort: validSort,
    publishedAfter: params.get('publicerad') ?? '',
    noExperience: params.get('erfarenhet') === '0',
  };
}

function toUrlParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.municipality) params.set('kommun', state.municipality);
  else if (state.region) params.set('region', state.region);
  if (state.group) params.set('yrkesgrupp', state.group);
  else if (state.field) params.set('omrade', state.field);
  if (state.remote) params.set('distans', '1');
  if (state.sort && state.sort !== 'pubdate-desc') params.set('sort', state.sort);
  if (state.publishedAfter) params.set('publicerad', state.publishedAfter);
  if (state.noExperience) params.set('erfarenhet', '0');
  return params;
}

function toApiParams(state: SearchState, offset: number): string {
  const params = toUrlParams(state);
  if (state.sort === 'pubdate-desc') params.set('sort', 'pubdate-desc');
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const remoteId = useId();
  const experienceId = useId();

  const initial = useMemo(() => stateFromParams(searchParams), [searchParams]);
  const [draft, setDraft] = useState<SearchState>(initial);
  const [applied, setApplied] = useState<SearchState>(initial);
  const [showFilters, setShowFilters] = useState(
    Boolean(initial.region || initial.field || initial.remote || initial.noExperience),
  );
  const [urlReady, setUrlReady] = useState(false);

  // Hydrate from the URL once on mount (and when the user hits back/forward).
  useEffect(() => {
    const next = stateFromParams(searchParams);
    setDraft(next);
    setApplied(next);
    setUrlReady(true);
  }, [searchParams]);

  const {
    data: filters,
    isFetching: filtersLoading,
    isPending: filtersPending,
  } = useQuery<Filters>({
    // Draft drives the narrow lists so opening the panel after picking a län
    // loads kommuner before the user presses Sök.
    queryKey: ['job-filters', draft.region, draft.field],
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

  const narrowLoading =
    Boolean(draft.region || draft.field) && (filtersPending || filtersLoading);

  const hasQuery = useMemo(
    () =>
      Boolean(
        applied.q ||
          applied.region ||
          applied.municipality ||
          applied.field ||
          applied.group ||
          applied.remote ||
          applied.publishedAfter ||
          applied.noExperience,
      ),
    [applied],
  );

  const { data, isFetching, isError, error, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ['jobs', applied],
      enabled: hasQuery && urlReady,
      initialPageParam: 0,
      queryFn: async ({ pageParam }) => {
        const response = await fetch(`/api/jobs?${toApiParams(applied, pageParam)}`);
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
    const params = toUrlParams(next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
                    <SelectValue
                      placeholder={
                        !draft.region
                          ? 'Välj län först'
                          : narrowLoading
                            ? 'Laddar…'
                            : 'Hela länet'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>
                      {narrowLoading && draft.region ? 'Laddar…' : 'Hela länet'}
                    </SelectItem>
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
                      placeholder={
                        !draft.field
                          ? 'Välj område först'
                          : narrowLoading
                            ? 'Laddar…'
                            : 'Alla grupper'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>
                      {narrowLoading && draft.field ? 'Laddar…' : 'Alla grupper'}
                    </SelectItem>
                    {filters?.groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Sortering">
              {(props) => (
                <Select
                  value={draft.sort}
                  onValueChange={(value) => setDraft({ ...draft, sort: value as SearchSort })}
                >
                  <SelectTrigger {...props}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-[13px] font-medium text-ink">Publicerad</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={draft.publishedAfter === '' ? 'secondary' : 'ghost'}
                  onClick={() => setDraft({ ...draft, publishedAfter: '' })}
                >
                  Alla
                </Button>
                {PUBLISHED_CHIPS.map((chip) => (
                  <Button
                    key={chip.minutes}
                    type="button"
                    size="sm"
                    variant={draft.publishedAfter === chip.minutes ? 'secondary' : 'ghost'}
                    onClick={() => setDraft({ ...draft, publishedAfter: chip.minutes })}
                  >
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>

            <span className="flex items-center gap-2">
              <Checkbox
                id={remoteId}
                checked={draft.remote}
                onCheckedChange={(value) => setDraft({ ...draft, remote: value === true })}
              />
              <Label htmlFor={remoteId} className="font-normal">
                Endast jobb på distans
              </Label>
            </span>

            <span className="flex items-center gap-2">
              <Checkbox
                id={experienceId}
                checked={draft.noExperience}
                onCheckedChange={(value) =>
                  setDraft({ ...draft, noExperience: value === true })
                }
              />
              <Label htmlFor={experienceId} className="font-normal">
                Utan krav på erfarenhet
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

      <SavedSearches
        searches={savedSearches}
        current={applied}
        onUse={(state) =>
          apply({
            ...EMPTY,
            ...state,
            sort: 'pubdate-desc',
            publishedAfter: '',
            noExperience: false,
          })
        }
      />

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
