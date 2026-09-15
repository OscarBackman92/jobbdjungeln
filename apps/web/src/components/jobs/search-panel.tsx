'use client';

import { pluralWord } from '@jobbdjungeln/core';
import type { SearchSort } from '@jobbdjungeln/jobtech';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { FilterChecklist } from '@/components/jobs/filter-checklist';
import { JobCard, type JobHit } from '@/components/jobs/job-card';
import { SavedSearches } from '@/components/jobs/saved-searches';
import { SearchInsight } from '@/components/jobs/search-insight';
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
  regions: string[];
  municipalities: string[];
  fields: string[];
  groups: string[];
  remote: boolean;
  sort: SearchSort;
  publishedAfter: string;
  noExperience: boolean;
  /** Default on. `cv=0` in the URL turns CV matching off. */
  matchCv: boolean;
}

const EMPTY: SearchState = {
  q: '',
  regions: [],
  municipalities: [],
  fields: [],
  groups: [],
  remote: false,
  sort: 'pubdate-desc',
  publishedAfter: '',
  noExperience: false,
  matchCv: true,
};

const PAGE_SIZE = 20;

const PUBLISHED_CHIPS: ReadonlyArray<{ label: string; minutes: string }> = [
  { label: '24 timmar', minutes: String(24 * 60) },
  { label: '7 dagar', minutes: String(7 * 24 * 60) },
  { label: '30 dagar', minutes: String(30 * 24 * 60) },
];

const SORT_OPTIONS: ReadonlyArray<{ value: SearchSort; label: string }> = [
  { value: 'pubdate-desc', label: 'Nyast först' },
  { value: 'relevance', label: 'Bäst match mot sökfras' },
  { value: 'applydate-asc', label: 'Sista ansökningsdag snartast' },
];

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function stateFromParams(params: URLSearchParams): SearchState {
  const sort = params.get('sort');
  const validSort = SORT_OPTIONS.some((option) => option.value === sort)
    ? (sort as SearchSort)
    : 'pubdate-desc';
  return {
    q: params.get('q') ?? '',
    regions: unique(params.getAll('region')),
    municipalities: unique(params.getAll('kommun')),
    fields: unique(params.getAll('omrade')),
    groups: unique(params.getAll('yrkesgrupp')),
    remote: params.get('distans') === '1',
    sort: validSort,
    publishedAfter: params.get('publicerad') ?? '',
    noExperience: params.get('erfarenhet') === '0',
    matchCv: params.get('cv') !== '0',
  };
}

function appendAll(params: URLSearchParams, key: string, values: readonly string[]) {
  for (const value of values) params.append(key, value);
}

/** Keep both län and kommun in the URL so the filter panel can reopen intact. */
function toUrlParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  appendAll(params, 'region', state.regions);
  appendAll(params, 'kommun', state.municipalities);
  appendAll(params, 'omrade', state.fields);
  appendAll(params, 'yrkesgrupp', state.groups);
  if (state.remote) params.set('distans', '1');
  if (state.sort && state.sort !== 'pubdate-desc') params.set('sort', state.sort);
  if (state.publishedAfter) params.set('publicerad', state.publishedAfter);
  if (state.noExperience) params.set('erfarenhet', '0');
  if (!state.matchCv) params.set('cv', '0');
  return params;
}

function toApiParams(state: SearchState, offset: number): string {
  const params = toUrlParams(state);
  if (state.sort === 'pubdate-desc') params.set('sort', 'pubdate-desc');
  params.set('offset', String(offset));
  params.set('limit', String(PAGE_SIZE));
  return params.toString();
}

function isFiltered(state: SearchState): boolean {
  return Boolean(
    state.q ||
      state.regions.length ||
      state.municipalities.length ||
      state.fields.length ||
      state.groups.length ||
      state.remote ||
      state.publishedAfter ||
      state.noExperience,
  );
}

function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Live search over the whole of Platsbanken.
 *
 * Opens with the newest ads (no phrase required). Narrower taxonomy picks
 * (kommun / yrkesgrupp) are sent alongside their parents so JobTech and the UI
 * stay in sync; JobTech still lets the narrower filter win when both are set.
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
    matchCv: boolean;
  }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const remoteId = useId();
  const experienceId = useId();
  const matchCvId = useId();

  const initial = useMemo(() => stateFromParams(searchParams), [searchParams]);
  const [draft, setDraft] = useState<SearchState>(initial);
  const [applied, setApplied] = useState<SearchState>(initial);
  const [showFilters, setShowFilters] = useState(
    Boolean(
      initial.regions.length ||
        initial.municipalities.length ||
        initial.fields.length ||
        initial.groups.length ||
        initial.remote ||
        initial.noExperience ||
        initial.publishedAfter,
    ),
  );
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const next = stateFromParams(searchParams);
    setDraft(next);
    setApplied(next);
    setUrlReady(true);
  }, [searchParams]);

  const regionKey = draft.regions.slice().sort().join(',');
  const fieldKey = draft.fields.slice().sort().join(',');

  const {
    data: filters,
    isFetching: filtersLoading,
    isPending: filtersPending,
  } = useQuery<Filters>({
    queryKey: ['job-filters', regionKey, fieldKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      for (const id of draft.regions) params.append('region', id);
      for (const id of draft.fields) params.append('omrade', id);
      const response = await fetch(`/api/jobs/filters?${params}`);
      if (!response.ok) throw new Error('Kunde inte hämta filtren.');
      return response.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 60_000,
  });

  const municipalitiesLoading = draft.regions.length > 0 && (filtersPending || filtersLoading);
  const groupsLoading = draft.fields.length > 0 && (filtersPending || filtersLoading);

  const filtered = isFiltered(applied);

  const { data: baseline, isFetching: baselineFetching } = useQuery({
    queryKey: ['jobs-baseline-total'],
    enabled: urlReady,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const response = await fetch('/api/jobs?limit=1&offset=0&sort=pubdate-desc');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Kunde inte hämta totalen.');
      return (payload as { total: number }).total;
    },
  });

  const {
    data,
    isFetching,
    isError,
    error,
    isFetched,
    fetchNextPage,
    hasNextPage,
    refetch,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['jobs', applied],
    enabled: urlReady,
    initialPageParam: 0,
    placeholderData: keepPreviousData,
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
  const searching = isFetching && !isFetchingNextPage;
  const showInitialSkeleton = searching && hits.length === 0 && !isFetched;

  function apply(next: SearchState = draft) {
    setDraft(next);
    setApplied(next);
    const params = toUrlParams(next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const municipalityOptions = filters?.municipalities ?? [];
  const groupOptions = filters?.groups ?? [];

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
              placeholder="Yrke, företag eller ort (valfritt)"
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
          <div className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-raised p-4 sm:grid-cols-2">
            <FilterChecklist
              label="Län"
              options={filters?.regions ?? []}
              selected={draft.regions}
              onChange={(regions) =>
                setDraft({
                  ...draft,
                  regions,
                  // Parent changed — drop kommuner so we never filter on orphans.
                  municipalities: [],
                })
              }
              loading={filtersPending && !filters}
              emptyHint="Kunde inte ladda län."
            />

            <FilterChecklist
              label="Kommuner"
              options={municipalityOptions}
              selected={draft.municipalities}
              onChange={(municipalities) => setDraft({ ...draft, municipalities })}
              disabled={draft.regions.length === 0}
              disabledHint="Välj minst ett län först — sedan kan du kryssa i flera kommuner."
              loading={municipalitiesLoading}
              emptyHint="Inga kommuner hittades för valt län."
            />

            <FilterChecklist
              label="Yrkesområden"
              options={filters?.fields ?? []}
              selected={draft.fields}
              onChange={(fields) =>
                setDraft({
                  ...draft,
                  fields,
                  groups: [],
                })
              }
              loading={filtersPending && !filters}
              emptyHint="Kunde inte ladda yrkesområden."
            />

            <FilterChecklist
              label="Yrkesgrupper"
              options={groupOptions}
              selected={draft.groups}
              onChange={(groups) => setDraft({ ...draft, groups })}
              disabled={draft.fields.length === 0}
              disabledHint="Välj minst ett yrkesområde först — sedan kan du kryssa i flera grupper."
              loading={groupsLoading}
              emptyHint="Inga yrkesgrupper hittades för valt område."
            />

            <Field label="Sortera resultat">
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

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-ink">
                Visa endast nyligen publicerade
              </span>
              <p className="text-[12px] text-subtle">
                Filtrerar bort äldre annonser. Skilt från sorteringen ovan.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={draft.publishedAfter === '' ? 'secondary' : 'ghost'}
                  onClick={() => setDraft({ ...draft, publishedAfter: '' })}
                >
                  Alla datum
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

            <span className="flex items-center gap-2">
              <Checkbox
                id={matchCvId}
                checked={draft.matchCv}
                onCheckedChange={(value) => setDraft({ ...draft, matchCv: value === true })}
              />
              <Label htmlFor={matchCvId} className="font-normal">
                Matcha mot CV
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

      {searching ? (
        <div
          className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-brand-soft/40 px-3 py-2 text-[13px] text-brand-text"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          Söker i Platsbanken…
        </div>
      ) : null}

      {!urlReady || showInitialSkeleton ? (
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <ErrorNote
          description={error instanceof Error ? error.message : 'Sökningen misslyckades.'}
          action={
            <Button size="sm" onClick={() => void refetch()}>
              Försök igen
            </Button>
          }
        />
      ) : hits.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Inga träffar"
          description="Prova ett bredare sökord, eller ta bort ett filter."
        />
      ) : (
        <>
          <p className="text-[13px] text-subtle" aria-live="polite">
            {filtered && typeof baseline === 'number' ? (
              <>
                <span className="font-medium text-ink tabular-nums">
                  {total.toLocaleString('sv-SE')}
                </span>
                {' av '}
                <span className="tabular-nums">{baseline.toLocaleString('sv-SE')}</span>
                {' annonser i Platsbanken'}
                {baselineFetching ? ' …' : ''}
              </>
            ) : (
              <>
                <span className="font-medium text-ink tabular-nums">
                  {total.toLocaleString('sv-SE')}
                </span>
                {` ${pluralWord(total, 'annons', 'annonser')} i Platsbanken`}
              </>
            )}
            {!hasResume ? ' · lägg in ditt CV under Profil för att se hur väl du matchar' : ''}
          </p>

          {filtered && typeof baseline === 'number' && baseline > 0 ? (
            <div
              className="h-2 overflow-hidden rounded-full bg-sunken"
              aria-hidden
              title={`${Math.round((total / baseline) * 100)}% av alla annonser`}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max(2, Math.min(100, Math.round((total / baseline) * 100)))}%`,
                }}
              />
            </div>
          ) : null}

          <SearchInsight jobs={hits} today={todayLocal()} />

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
              disabled={isFetchingNextPage}
              className="self-center"
            >
              {isFetchingNextPage ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Visa fler
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
