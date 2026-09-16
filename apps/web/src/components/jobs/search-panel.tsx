'use client';

import { pluralWord } from '@jobbdjungeln/core';
import {
  regionLabel,
  type SearchStatBucket,
  type SearchStatValue,
} from '@jobbdjungeln/jobtech';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueries,
  useQuery,
} from '@tanstack/react-query';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActiveFilterChips,
  buildActiveFilterChips,
  countActiveFiltersExcludingQuery,
} from '@/components/jobs/active-filter-chips';
import { buildSearchRelaxations } from '@/components/jobs/empty-search-suggestions';
import { JobCard, type JobHit } from '@/components/jobs/job-card';
import { MultiSelectCombobox } from '@/components/jobs/multi-select-combobox';
import { SavedSearches } from '@/components/jobs/saved-searches';
import { type InsightFilterKind, SearchInsight } from '@/components/jobs/search-insight';
import {
  EMPTY_SEARCH,
  formatSwedishList,
  parseUiSort,
  type SearchState,
  samePanelFilters,
  toJobTechSort,
  type UiSort,
} from '@/components/jobs/search-state';
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorNote,
  Input,
  Label,
  LiveRegion,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
} from '@/components/ui';
import { cn } from '@/lib/utils';

export type { SearchState } from '@/components/jobs/search-state';
export { sameSearchState } from '@/components/jobs/search-state';

interface TaxonomyOption {
  id: string;
  label: string;
}

interface MunicipalityOption extends TaxonomyOption {
  regionId?: string;
}

interface Filters {
  regions: TaxonomyOption[];
  fields: TaxonomyOption[];
  municipalities: MunicipalityOption[];
  groups: Array<TaxonomyOption & { fieldId?: string }>;
}

const EMPTY = EMPTY_SEARCH;

const PAGE_SIZE = 20;
const COUNT_DEBOUNCE_MS = 300;

const PUBLISHED_CHIPS: ReadonlyArray<{ label: string; minutes: string }> = [
  { label: '24 timmar', minutes: String(24 * 60) },
  { label: '7 dagar', minutes: String(7 * 24 * 60) },
  { label: '30 dagar', minutes: String(30 * 24 * 60) },
];

const SORT_OPTIONS: ReadonlyArray<{ value: UiSort; label: string; needsQuery?: boolean }> = [
  { value: 'pubdate-desc', label: 'Nyast först' },
  { value: 'applydate-asc', label: 'Sista ansökningsdag först' },
  { value: 'cv-match', label: 'Bäst CV-match' },
  { value: 'relevance', label: 'Mest relevant för sökordet', needsQuery: true },
];

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function stateFromParams(params: URLSearchParams): SearchState {
  return {
    q: params.get('q') ?? '',
    regions: unique(params.getAll('region')),
    municipalities: unique(params.getAll('kommun')),
    fields: unique(params.getAll('omrade')),
    groups: unique(params.getAll('yrkesgrupp')),
    remote: params.get('distans') === '1',
    sort: parseUiSort(params.get('sort')),
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
  // Match is always computed; `cv=0` only hides badges in the UI.
  params.delete('cv');
  // Keep `cv-match` for the API — JobTech mapping happens server-side.
  params.set('sort', state.sort);
  params.set('offset', String(offset));
  params.set('limit', String(PAGE_SIZE));
  return params.toString();
}

/** Count-only query string — no CV scoring, limit=0. */
function toCountParams(state: SearchState): string {
  const params = toUrlParams(state);
  params.set('sort', toJobTechSort(state.sort));
  params.set('offset', '0');
  params.set('limit', '0');
  params.set('cv', '0');
  return params.toString();
}

/** Full-result JobTech facets for the insight panel. */
function toStatsParams(state: SearchState): string {
  const params = toUrlParams(state);
  params.set('sort', toJobTechSort(state.sort));
  params.set('offset', '0');
  params.set('limit', '0');
  params.set('cv', '0');
  params.append('stats', 'municipality');
  params.append('stats', 'occupation-group');
  params.set('stats.limit', '5');
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

interface RegionDropNotice {
  message: string;
  previous: SearchState;
}

/**
 * Live search over the whole of Platsbanken.
 *
 * Opens with the newest ads (no phrase required). Narrower taxonomy picks
 * (kommun / yrkesgrupp) are sent alongside their parents so JobTech and the UI
 * stay in sync; JobTech still lets the narrower filter win when both are set.
 *
 * Panel edits stay in `draft` until the user presses the primary action
 * (Visa N annonser / Sök). The result list follows `applied` from the URL.
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
    lastRunAt: string | null;
  }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const remoteId = useId();
  const experienceId = useId();
  const showCvMatchId = useId();
  const sortLabelId = useId();
  const resultsHeadingId = useId();

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

  useEffect(() => {
    if (!showFilters) return;
    const mq = window.matchMedia('(max-width: 639px)');
    if (!mq.matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showFilters]);

  const [urlReady, setUrlReady] = useState(false);
  const [debouncedDraft, setDebouncedDraft] = useState(initial);
  const [regionDropNotice, setRegionDropNotice] = useState<RegionDropNotice | null>(null);
  const [countFlash, setCountFlash] = useState<{ current: number; previous: number } | null>(
    null,
  );
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [pendingResultsFocus, setPendingResultsFocus] = useState(false);
  const [insightLabels, setInsightLabels] = useState<{
    municipalities: Map<string, string>;
    groups: Map<string, string>;
  }>(() => ({ municipalities: new Map(), groups: new Map() }));
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const flashPreviousRef = useRef<number | null>(null);

  useEffect(() => {
    const next = stateFromParams(searchParams);
    setDraft(next);
    setApplied(next);
    setDebouncedDraft(next);
    setRegionDropNotice(null);
    setUrlReady(true);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedDraft(draft), COUNT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const regionKey = [...draft.regions, ...applied.regions].sort().join(',');
  const fieldKey = [...draft.fields, ...applied.fields].sort().join(',');
  const draftDirty = !samePanelFilters(draft, applied);
  const filterPanelId = 'annonser-filter-panel';
  const activeFilterCount = countActiveFiltersExcludingQuery(applied);

  useEffect(() => {
    if (applied.q.trim()) return;
    if (applied.sort !== 'relevance') return;
    const next = { ...applied, sort: 'pubdate-desc' as const };
    setDraft((current) => ({ ...current, sort: 'pubdate-desc' }));
    setApplied(next);
    setDebouncedDraft((current) => ({ ...current, sort: 'pubdate-desc' }));
    const params = toUrlParams(next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [applied, pathname, router]);

  const {
    data: filters,
    isFetching: filtersLoading,
    isPending: filtersPending,
  } = useQuery<Filters>({
    queryKey: ['job-filters', regionKey, fieldKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      for (const id of unique([...draft.regions, ...applied.regions])) {
        params.append('region', id);
      }
      for (const id of unique([...draft.fields, ...applied.fields])) {
        params.append('omrade', id);
      }
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

  const {
    data: draftCount,
    isFetching: draftCountFetching,
    isPending: draftCountPending,
  } = useQuery({
    queryKey: ['jobs-draft-count', debouncedDraft],
    enabled: urlReady && showFilters,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/jobs?${toCountParams(debouncedDraft)}`, { signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Kunde inte räkna annonser.');
      return (payload as { total: number }).total;
    },
  });

  const {
    data: insightStats,
    isFetching: insightStatsFetching,
    isPending: insightStatsPending,
  } = useQuery({
    queryKey: [
      'jobs-stats',
      {
        q: applied.q,
        regions: applied.regions,
        municipalities: applied.municipalities,
        fields: applied.fields,
        groups: applied.groups,
        remote: applied.remote,
        publishedAfter: applied.publishedAfter,
        noExperience: applied.noExperience,
      },
    ],
    enabled: urlReady,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/jobs?${toStatsParams(applied)}`, { signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Kunde inte hämta statistik.');
      return payload as {
        total: number;
        stats?: SearchStatBucket[];
      };
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
    // `matchCv` only toggles badge visibility — keep it out of the query key.
    queryKey: [
      'jobs',
      {
        q: applied.q,
        regions: applied.regions,
        municipalities: applied.municipalities,
        fields: applied.fields,
        groups: applied.groups,
        remote: applied.remote,
        sort: applied.sort,
        publishedAfter: applied.publishedAfter,
        noExperience: applied.noExperience,
      },
    ],
    enabled: urlReady,
    initialPageParam: 0,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      const response = await fetch(`/api/jobs?${toApiParams(applied, pageParam)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Sökningen misslyckades.');
      return payload as {
        total: number;
        results: JobHit[];
        hasResume: boolean;
        cvSortCapped?: boolean;
      };
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.results.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });

  const hits = data?.pages.flatMap((page) => page.results) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const hasResume = data?.pages[0]?.hasResume ?? true;
  const cvSortCapped = Boolean(data?.pages[0]?.cvSortCapped);
  const searching = isFetching && !isFetchingNextPage;
  const showInitialSkeleton = (!urlReady || searching) && hits.length === 0;
  const showStaleResults = searching && hits.length > 0;
  const [focusHitIndex, setFocusHitIndex] = useState<number | null>(null);

  async function loadMore() {
    const before = hits.length;
    const result = await fetchNextPage();
    if (!result.isError) setFocusHitIndex(before);
  }

  const countReady = typeof draftCount === 'number';
  const draftSettled = samePanelFilters(draft, debouncedDraft);
  const counting = showFilters && (!draftSettled || draftCountPending || draftCountFetching);
  const applyDisabled = showFilters && countReady && draftCount === 0 && draftSettled;
  const applyLabel =
    countReady && draftCount === 0
      ? 'Inga annonser – ändra filtren'
      : countReady
        ? `Visa ${draftCount.toLocaleString('sv-SE')} ${pluralWord(draftCount, 'annons', 'annonser')}`
        : 'Visa annonser';

  useEffect(() => {
    if (!countFlash) return;
    const timer = window.setTimeout(() => setCountFlash(null), 4000);
    return () => window.clearTimeout(timer);
  }, [countFlash]);

  useEffect(() => {
    if (!pendingResultsFocus || searching || !urlReady) return;
    setPendingResultsFocus(false);

    const previous = flashPreviousRef.current;
    flashPreviousRef.current = null;
    if (previous !== null) {
      setCountFlash({ current: total, previous });
    }

    const announce = filtered
      ? `${total.toLocaleString('sv-SE')} ${pluralWord(total, 'annons', 'annonser')} matchar dina filter`
      : `${total.toLocaleString('sv-SE')} ${pluralWord(total, 'annons', 'annonser')} i Platsbanken`;
    setLiveAnnouncement(announce);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      const heading = resultsHeadingRef.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }, [pendingResultsFocus, searching, urlReady, total, filtered]);

  function apply(next: SearchState = draft, options?: { confirm?: boolean }) {
    setRegionDropNotice(null);
    setDraft(next);
    setApplied(next);
    setDebouncedDraft(next);
    const params = toUrlParams(next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    try {
      globalThis.localStorage?.setItem(
        'jobbdjungeln-last-region',
        JSON.stringify(next.regions),
      );
      globalThis.localStorage?.setItem(
        'jobbdjungeln-last-municipalities',
        JSON.stringify(next.municipalities),
      );
    } catch {
      // Ignore storage errors.
    }
    if (options?.confirm) {
      flashPreviousRef.current = isFetched ? total : null;
      setShowFilters(false);
      setPendingResultsFocus(true);
    }
  }

  /** Sort / CV visibility — apply immediately without touching other draft filters. */
  function applyToolbar(patch: Partial<Pick<SearchState, 'sort' | 'matchCv'>>) {
    const nextApplied = { ...applied, ...patch };
    setApplied(nextApplied);
    setDraft((current) => ({ ...current, ...patch }));
    setDebouncedDraft((current) => ({ ...current, ...patch }));
    const params = toUrlParams(nextApplied);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function addInsightFilter(kind: InsightFilterKind, value: SearchStatValue) {
    setInsightLabels((current) => {
      const next = {
        municipalities: new Map(current.municipalities),
        groups: new Map(current.groups),
      };
      if (kind === 'municipality') next.municipalities.set(value.conceptId, value.label);
      else next.groups.set(value.conceptId, value.label);
      return next;
    });

    if (kind === 'municipality') {
      if (applied.municipalities.includes(value.conceptId)) return;
      apply(
        { ...applied, municipalities: [...applied.municipalities, value.conceptId] },
        { confirm: true },
      );
      return;
    }

    if (applied.groups.includes(value.conceptId)) return;
    apply({ ...applied, groups: [...applied.groups, value.conceptId] }, { confirm: true });
  }

  function resetDraftToApplied() {
    setDraft(applied);
    setDebouncedDraft(applied);
    setRegionDropNotice(null);
  }

  function clearDraftSelections() {
    setDraft({
      ...EMPTY,
      q: draft.q,
      sort: applied.sort,
      matchCv: applied.matchCv,
    });
    setRegionDropNotice(null);
  }

  function onRegionsChange(regions: string[]) {
    const previous = draft;
    const regionSet = new Set(regions);
    const removedRegions = previous.regions.filter((id) => !regionSet.has(id));
    const options = filters?.municipalities ?? [];
    const kept: string[] = [];
    const removedLabels: string[] = [];

    if (regions.length === 0) {
      for (const id of previous.municipalities) {
        const option = options.find((item) => item.id === id);
        removedLabels.push(option?.label ?? id);
      }
      setDraft({ ...draft, regions, municipalities: [] });
    } else {
      for (const id of previous.municipalities) {
        const option = options.find((item) => item.id === id);
        if (option?.regionId && !regionSet.has(option.regionId)) {
          removedLabels.push(option.label);
        } else {
          kept.push(id);
        }
      }
      setDraft({ ...draft, regions, municipalities: kept });
    }

    if (removedLabels.length > 0 && removedRegions.length > 0) {
      const regionNames = removedRegions.map((id) => regionLabel(id) || id).filter(Boolean);
      setRegionDropNotice({
        message: `${formatSwedishList(removedLabels)} togs bort eftersom ${formatSwedishList(regionNames)} avmarkerades.`,
        previous,
      });
    } else {
      setRegionDropNotice(null);
    }
  }

  const municipalityOptions = filters?.municipalities ?? [];
  const groupOptions = filters?.groups ?? [];

  const municipalitySections = useMemo(() => {
    const byRegion = new Map<
      string,
      { id: string; label: string; options: MunicipalityOption[] }
    >();
    for (const option of municipalityOptions) {
      const regionId = option.regionId ?? 'okand';
      const existing = byRegion.get(regionId);
      if (existing) existing.options.push(option);
      else {
        byRegion.set(regionId, {
          id: regionId,
          label: regionLabel(regionId) || 'Övriga',
          options: [option],
        });
      }
    }
    return [...byRegion.values()].sort((a, b) => a.label.localeCompare(b.label, 'sv'));
  }, [municipalityOptions]);

  const groupSections = useMemo(() => {
    const byField = new Map<
      string,
      { id: string; label: string; options: Array<TaxonomyOption & { fieldId?: string }> }
    >();
    const fieldLabels = new Map((filters?.fields ?? []).map((item) => [item.id, item.label]));
    for (const option of groupOptions) {
      const fieldId = option.fieldId ?? 'okand';
      const existing = byField.get(fieldId);
      if (existing) existing.options.push(option);
      else {
        byField.set(fieldId, {
          id: fieldId,
          label: fieldLabels.get(fieldId) ?? 'Övriga',
          options: [option],
        });
      }
    }
    return [...byField.values()].sort((a, b) => a.label.localeCompare(b.label, 'sv'));
  }, [filters?.fields, groupOptions]);

  const chipLabelMaps = useMemo(() => {
    const municipalities = new Map(
      municipalityOptions.map((item) => [item.id, item.label] as const),
    );
    for (const [id, label] of insightLabels.municipalities) {
      if (!municipalities.has(id)) municipalities.set(id, label);
    }
    const groups = new Map(groupOptions.map((item) => [item.id, item.label] as const));
    for (const [id, label] of insightLabels.groups) {
      if (!groups.has(id)) groups.set(id, label);
    }
    const groupFields = new Map(
      groupOptions
        .filter((item): item is TaxonomyOption & { fieldId: string } => Boolean(item.fieldId))
        .map((item) => [item.id, item.fieldId] as const),
    );
    return { municipalities, groups, groupFields };
  }, [municipalityOptions, groupOptions, insightLabels]);

  const activeChips = useMemo(
    () => buildActiveFilterChips(applied, chipLabelMaps),
    [applied, chipLabelMaps],
  );

  const emptySearch = isFetched && !searching && !isError && total === 0;
  const relaxations = useMemo(
    () => (emptySearch ? buildSearchRelaxations(applied, chipLabelMaps) : []),
    [emptySearch, applied, chipLabelMaps],
  );

  const relaxationCounts = useQueries({
    queries: relaxations.map((relaxation) => ({
      queryKey: ['jobs-relax-count', relaxation.id, relaxation.next] as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const response = await fetch(`/api/jobs?${toCountParams(relaxation.next)}`, { signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Kunde inte räkna annonser.');
        return (payload as { total: number }).total;
      },
      enabled: emptySearch,
      staleTime: 30_000,
    })),
  });

  const qOnlyCount = useQuery({
    queryKey: ['jobs-q-only-count', applied.q.trim()] as const,
    enabled: emptySearch && Boolean(applied.q.trim()),
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/jobs?${toCountParams({
          ...EMPTY,
          q: applied.q.trim(),
          sort: applied.sort,
          matchCv: applied.matchCv,
        })}`,
        { signal },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Kunde inte räkna annonser.');
      return (payload as { total: number }).total;
    },
  });

  const relaxationSuggestions = relaxations
    .map((relaxation, index) => ({
      ...relaxation,
      total: relaxationCounts[index]?.data,
    }))
    .filter((item): item is typeof item & { total: number } => typeof item.total === 'number')
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  const qOnlyZero = Boolean(applied.q.trim()) && qOnlyCount.isFetched && qOnlyCount.data === 0;

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (applyDisabled) return;
          apply(draft, { confirm: true });
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
            className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            aria-controls={filterPanelId}
            aria-label={
              activeFilterCount > 0 ? `Filter, ${activeFilterCount} aktiva` : 'Filter'
            }
          >
            <SlidersHorizontal aria-hidden />
            <span className="hidden sm:inline">
              {activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : 'Filter'}
            </span>
            <span className="sm:hidden">
              {activeFilterCount > 0 ? `· ${activeFilterCount}` : null}
            </span>
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="min-h-11 sm:min-h-0"
            disabled={applyDisabled}
          >
            Sök
          </Button>
        </div>

        <ActiveFilterChips
          chips={activeChips}
          onRemove={(chip) => apply(chip.remove(applied))}
          onClearAll={() =>
            apply({ ...EMPTY, q: '', sort: applied.sort, matchCv: applied.matchCv })
          }
          onExpand={() => setShowFilters(true)}
        />

        <SavedSearches
          searches={savedSearches}
          current={applied}
          hideSave={emptySearch}
          labelHints={{
            municipalities: chipLabelMaps.municipalities,
            groups: chipLabelMaps.groups,
          }}
          onUse={(state) =>
            apply(
              {
                ...EMPTY,
                ...state,
                sort: 'pubdate-desc',
                publishedAfter: '',
                noExperience: false,
              },
              { confirm: true },
            )
          }
        />

        {showFilters ? (
          <div
            id={filterPanelId}
            className="flex flex-col rounded-[var(--radius-card)] border border-line bg-raised max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:rounded-none max-sm:border-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Filter"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2 sm:col-span-2 sm:border-0 sm:p-0">
              <p className="text-sm font-semibold text-ink sm:hidden">Filter</p>
              <div className="ml-auto flex items-center gap-1 sm:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 px-3"
                  onClick={clearDraftSelections}
                >
                  Rensa val
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="Stäng"
                  onClick={() => setShowFilters(false)}
                >
                  <X aria-hidden />
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:contents sm:overflow-visible sm:p-0">
              <MultiSelectCombobox
                label="Län"
                options={filters?.regions ?? []}
                selected={draft.regions}
                onChange={onRegionsChange}
                searchPlaceholder="Sök län…"
                loading={filtersPending && !filters}
                emptyHint="Kunde inte ladda län."
              />

              <MultiSelectCombobox
                label="Kommuner"
                sections={municipalitySections}
                selected={draft.municipalities}
                onChange={(municipalities) => {
                  setRegionDropNotice(null);
                  setDraft({ ...draft, municipalities });
                }}
                searchPlaceholder="Sök kommun…"
                disabled={draft.regions.length === 0}
                disabledPlaceholder="Välj län först"
                loading={municipalitiesLoading}
                emptyHint="Inga kommuner hittades för valt län."
              />

              <MultiSelectCombobox
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
                searchPlaceholder="Sök yrkesområde…"
                loading={filtersPending && !filters}
                emptyHint="Kunde inte ladda yrkesområden."
              />

              <MultiSelectCombobox
                label="Yrkesgrupper"
                sections={groupSections}
                selected={draft.groups}
                onChange={(groups) => setDraft({ ...draft, groups })}
                searchPlaceholder="Sök yrkesgrupp…"
                disabled={draft.fields.length === 0}
                disabledPlaceholder="Välj yrkesområde först"
                loading={groupsLoading}
                emptyHint="Inga yrkesgrupper hittades för valt område."
              />

              <div className="flex flex-col gap-2 sm:col-span-2">
                <span
                  id={`${filterPanelId}-published`}
                  className="text-[13px] font-medium text-ink"
                >
                  Publicerad
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby={`${filterPanelId}-published`}
                  className="inline-flex flex-wrap gap-1 rounded-[var(--radius-control)] bg-sunken p-1"
                >
                  {([{ label: 'Alla datum', minutes: '' }, ...PUBLISHED_CHIPS] as const).map(
                    (chip) => {
                      const selected = draft.publishedAfter === chip.minutes;
                      return (
                        <label
                          key={chip.label}
                          className={cn(
                            'relative inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-3 text-[13px] font-medium transition-colors sm:min-h-8',
                            selected
                              ? 'bg-brand-soft text-brand-text shadow-card'
                              : 'text-muted hover:bg-hover hover:text-ink',
                          )}
                        >
                          <input
                            type="radio"
                            name={`${filterPanelId}-published-radio`}
                            value={chip.minutes}
                            checked={selected}
                            onChange={() =>
                              setDraft({ ...draft, publishedAfter: chip.minutes })
                            }
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                          {chip.label}
                        </label>
                      );
                    },
                  )}
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

              {regionDropNotice ? (
                <div
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-control)] border border-line bg-sunken px-3 py-2 text-[13px] text-ink sm:col-span-2"
                  role="status"
                  aria-live="polite"
                >
                  <span>{regionDropNotice.message}</span>
                  <button
                    type="button"
                    className="font-medium text-brand-text underline-offset-2 hover:underline"
                    onClick={() => {
                      setDraft(regionDropNotice.previous);
                      setDebouncedDraft(regionDropNotice.previous);
                      setRegionDropNotice(null);
                    }}
                  >
                    Ångra
                  </button>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-line bg-raised p-3 max-sm:sticky max-sm:bottom-0 sm:col-span-2 sm:border-0 sm:bg-transparent sm:p-0">
                {draftDirty ? (
                  <p className="text-[13px] text-subtle" role="status">
                    Ej använda ändringar
                    {' · '}
                    <button
                      type="button"
                      className="font-medium text-brand-text underline-offset-2 hover:underline"
                      onClick={resetDraftToApplied}
                    >
                      Återställ
                    </button>
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    className="min-h-11 min-w-[14rem] flex-1 justify-center sm:min-h-8 sm:flex-none"
                    disabled={applyDisabled}
                    loading={counting}
                    aria-live="polite"
                  >
                    {applyLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="hidden min-h-11 sm:inline-flex sm:min-h-8"
                    onClick={clearDraftSelections}
                  >
                    <X aria-hidden />
                    Rensa val
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </form>

      <LiveRegion>{liveAnnouncement}</LiveRegion>

      {showInitialSkeleton ? (
        <div className="flex flex-col gap-3" role="status" aria-busy="true">
          <span className="sr-only">Laddar annonser</span>
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
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              ref={resultsHeadingRef}
              id={resultsHeadingId}
              tabIndex={-1}
              className="text-[13px] text-subtle outline-none"
            >
              {countFlash ? (
                <>
                  <span className="font-medium text-ink tabular-nums">
                    {countFlash.current.toLocaleString('sv-SE')}
                  </span>
                  {` ${pluralWord(countFlash.current, 'annons', 'annonser')} (var ${countFlash.previous.toLocaleString('sv-SE')})`}
                </>
              ) : filtered ? (
                <>
                  <span className="font-medium text-ink tabular-nums">
                    {total.toLocaleString('sv-SE')}
                  </span>
                  {` ${pluralWord(total, 'annons', 'annonser')} matchar dina filter`}
                </>
              ) : (
                <>
                  <span className="font-medium text-ink tabular-nums">
                    {total.toLocaleString('sv-SE')}
                  </span>
                  {` ${pluralWord(total, 'annons', 'annonser')} i Platsbanken`}
                </>
              )}
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-[13px] text-ink">
                <span id={sortLabelId} className="text-subtle">
                  Sortera:
                </span>
                <Select
                  value={applied.sort}
                  onValueChange={(value) => applyToolbar({ sort: value as UiSort })}
                >
                  <SelectTrigger
                    aria-labelledby={sortLabelId}
                    className="h-8 w-auto min-w-[12rem] gap-1.5 px-2 text-[13px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.filter(
                      (option) => !option.needsQuery || Boolean(applied.q.trim()),
                    ).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasResume ? (
                <span className="flex items-center gap-2 text-[13px] text-ink">
                  <Switch
                    id={showCvMatchId}
                    checked={applied.matchCv}
                    onCheckedChange={(value) => applyToolbar({ matchCv: value })}
                  />
                  <Label htmlFor={showCvMatchId} className="font-normal">
                    Visa CV-match
                  </Label>
                </span>
              ) : (
                <Link
                  href="/profil"
                  className="text-[13px] font-medium text-brand-text underline-offset-2 hover:underline"
                >
                  Lägg in ditt CV för att se matchning
                </Link>
              )}
            </div>
          </div>

          {applied.sort === 'cv-match' && cvSortCapped ? (
            <p className="text-[12px] text-subtle">Sorterat bland de 100 nyaste träffarna</p>
          ) : null}

          {hits.length > 0 || (isFetched && total > 0) ? (
            <SearchInsight
              total={insightStats?.total ?? total}
              stats={insightStats?.stats}
              municipalities={applied.municipalities}
              groups={applied.groups}
              loading={insightStatsPending || insightStatsFetching}
              onAddFilter={addInsightFilter}
            />
          ) : null}

          {hits.length === 0 ? (
            qOnlyZero ? (
              <EmptyState
                icon={Search}
                title={`Platsbanken har inga annonser för '${applied.q.trim()}' just nu.`}
                description="Prova ett annat sökord, eller ta bort sökordet och filtrera på yrkesgrupp i stället."
              />
            ) : (
              <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10">
                <div className="text-center">
                  <p className="text-sm font-medium text-ink">
                    Inga annonser matchar alla dina filter.
                  </p>
                  {relaxationSuggestions.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      Prova ett bredare sökord, eller ta bort ett filter.
                    </p>
                  ) : null}
                </div>
                {relaxationSuggestions.length > 0 ? (
                  <ul className="mx-auto flex w-full max-w-lg flex-col gap-2">
                    {relaxationSuggestions.map((suggestion) => (
                      <li
                        key={suggestion.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-raised px-3 py-2 text-[13px]"
                      >
                        <span className="text-ink">
                          {suggestion.withoutLabel}:{' '}
                          <span className="font-medium tabular-nums">
                            {suggestion.total.toLocaleString('sv-SE')}
                          </span>{' '}
                          {pluralWord(suggestion.total, 'annons', 'annonser')}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => apply(suggestion.next, { confirm: true })}
                        >
                          {suggestion.removeButton}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          ) : (
            <>
              <ul
                className={`flex flex-col gap-3 transition-opacity ${showStaleResults ? 'opacity-50' : 'opacity-100'}`}
                aria-busy={showStaleResults || undefined}
              >
                {hits.map((job, index) => (
                  <li key={job.id}>
                    <JobCard
                      job={job}
                      showMatch={applied.matchCv}
                      headingRef={
                        index === focusHitIndex
                          ? (node) => {
                              if (!node) return;
                              node.focus({ preventScroll: true });
                              node.scrollIntoView({ block: 'nearest' });
                              setFocusHitIndex(null);
                            }
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
              {hasNextPage ? (
                <Button
                  variant="secondary"
                  onClick={() => void loadMore()}
                  disabled={isFetchingNextPage}
                  loading={isFetchingNextPage}
                  className="self-center"
                  aria-live="polite"
                >
                  {isFetchingNextPage
                    ? 'Laddar fler annonser…'
                    : `Visa ${PAGE_SIZE} till (${hits.length.toLocaleString('sv-SE')} av ${total.toLocaleString('sv-SE')})`}
                </Button>
              ) : hits.length > 0 ? (
                <p className="self-center text-[13px] text-subtle">
                  {`Alla ${total.toLocaleString('sv-SE')} ${pluralWord(total, 'annons', 'annonser')} visas`}
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
