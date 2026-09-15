'use client';

import { useQueries } from '@tanstack/react-query';
import { BookmarkPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  lastRunToPublishedAfter,
  matchesSavedSearch,
  suggestSavedSearchLabel,
} from '@/components/jobs/saved-search-label';
import { EMPTY_SEARCH, type SearchState, toJobTechSort } from '@/components/jobs/search-state';
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui';
import {
  deleteSearchAction,
  restoreSearchAction,
  saveSearchAction,
  touchSavedSearchAction,
} from '@/server/actions/searches';

export interface SavedSearch {
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
}

function searchToState(search: SavedSearch): SearchState {
  return {
    ...EMPTY_SEARCH,
    q: search.query,
    regions: search.regions,
    municipalities: search.municipalities,
    fields: search.occupationFields,
    groups: search.occupationGroups,
    remote: search.remote,
    matchCv: search.matchCv,
    sort: 'pubdate-desc',
  };
}

function toNewCountParams(search: SavedSearch): string {
  const publishedAfter = lastRunToPublishedAfter(search.lastRunAt);
  if (!publishedAfter) return '';
  const state = searchToState(search);
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  for (const id of state.regions) params.append('region', id);
  for (const id of state.municipalities) params.append('kommun', id);
  for (const id of state.fields) params.append('omrade', id);
  for (const id of state.groups) params.append('yrkesgrupp', id);
  if (state.remote) params.set('distans', '1');
  params.set('publicerad', publishedAfter);
  params.set('sort', toJobTechSort(state.sort));
  params.set('offset', '0');
  params.set('limit', '0');
  params.set('cv', '0');
  return params.toString();
}

/**
 * Saved searches as one-click chips under the query field, plus save / manage.
 */
export function SavedSearches({
  searches,
  current,
  onUse,
  hideSave = false,
  labelHints,
}: {
  searches: SavedSearch[];
  current: SearchState;
  hideSave?: boolean;
  labelHints?: {
    municipalities: ReadonlyMap<string, string>;
    groups: ReadonlyMap<string, string>;
  };
  onUse: (
    state: Pick<
      SearchState,
      'q' | 'regions' | 'municipalities' | 'fields' | 'groups' | 'remote' | 'matchCv'
    >,
    meta?: { savedSearchId?: string },
  ) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [naming, setNaming] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedSearch | null>(null);

  const activeMatch = useMemo(
    () => searches.find((search) => matchesSavedSearch(current, search)) ?? null,
    [searches, current],
  );

  const canSave =
    !hideSave &&
    !activeMatch &&
    Boolean(
      current.q ||
        current.regions.length ||
        current.municipalities.length ||
        current.fields.length ||
        current.groups.length ||
        current.remote,
    );

  const newCounts = useQueries({
    queries: searches.map((search) => ({
      queryKey: ['saved-search-new', search.id, search.lastRunAt] as const,
      enabled: Boolean(search.lastRunAt),
      staleTime: 60_000,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const query = toNewCountParams(search);
        if (!query) return 0;
        const response = await fetch(`/api/jobs?${query}`, { signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Kunde inte räkna nya annonser.');
        return (payload as { total: number }).total;
      },
    })),
  });

  function openSave() {
    setRenamingId(null);
    setLabel(suggestSavedSearchLabel(current, labelHints));
    setNaming(true);
  }

  function openRename(search: SavedSearch) {
    setMenuOpen(false);
    setRenamingId(search.id);
    setLabel(search.label);
    setNaming(true);
  }

  function save() {
    startTransition(async () => {
      const trimmed = label.trim();
      const renaming = renamingId
        ? searches.find((item) => item.id === renamingId)
        : undefined;

      const result = await saveSearchAction(
        renaming
          ? {
              id: renaming.id,
              label: trimmed || renaming.label || 'Sparad sökning',
              query: renaming.query,
              regions: renaming.regions,
              municipalities: renaming.municipalities,
              occupationFields: renaming.occupationFields,
              occupationGroups: renaming.occupationGroups,
              remote: renaming.remote,
              matchCv: renaming.matchCv,
              digestOptIn: true,
            }
          : {
              label: trimmed || suggestSavedSearchLabel(current, labelHints),
              query: current.q,
              regions: current.regions,
              municipalities: current.municipalities,
              occupationFields: current.fields,
              occupationGroups: current.groups,
              remote: current.remote,
              matchCv: current.matchCv,
              digestOptIn: true,
            },
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const savedId = result.data.id;
      setNaming(false);
      setLabel('');
      setRenamingId(null);

      if (!renamingId) {
        toast('Sökningen sparad', {
          duration: 8000,
          cancel: {
            label: 'Ångra',
            onClick: () => {
              startTransition(async () => {
                const undone = await deleteSearchAction(savedId);
                if (undone.ok) router.refresh();
                else toast.error(undone.error);
              });
            },
          },
        });
      } else {
        toast.success('Namnet är uppdaterat');
      }
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const result = await deleteSearchAction(target.id);
      setDeleteTarget(null);
      setMenuOpen(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast('Sökningen borttagen', {
        duration: 8000,
        cancel: {
          label: 'Ångra',
          onClick: () => {
            startTransition(async () => {
              const restored = await restoreSearchAction(result.data);
              if (restored.ok) router.refresh();
              else toast.error(restored.error);
            });
          },
        },
      });
      router.refresh();
    });
  }

  function applySavedSearch(search: SavedSearch) {
    onUse(
      {
        q: search.query,
        regions: search.regions,
        municipalities: search.municipalities,
        fields: search.occupationFields,
        groups: search.occupationGroups,
        remote: search.remote,
        matchCv: search.matchCv,
      },
      { savedSearchId: search.id },
    );
    startTransition(async () => {
      await touchSavedSearchAction(search.id);
      router.refresh();
    });
  }

  if (searches.length === 0 && !canSave && !naming) return null;

  return (
    <div className="flex flex-col gap-2">
      {searches.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Sparade sökningar">
          {searches.map((search, index) => {
            const newCount = newCounts[index]?.data ?? 0;
            const active = activeMatch?.id === search.id;
            return (
              <li key={search.id}>
                <button
                  type="button"
                  onClick={() => applySavedSearch(search)}
                  className="outline-none"
                  aria-current={active ? 'true' : undefined}
                >
                  <Badge
                    tone={active ? 'brand' : 'outline'}
                    className="inline-flex max-w-[16rem] items-center gap-1 rounded-full hover:bg-hover"
                  >
                    <span aria-hidden="true">★</span>
                    <span className="truncate">{search.label}</span>
                    {newCount > 0 ? (
                      <span className="tabular-nums text-brand-text">{newCount} nya</span>
                    ) : null}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {naming ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Namn på sökningen"
              aria-label="Namn på sökningen"
              className="h-8 w-56"
              autoFocus
              onKeyDown={(event) => event.key === 'Enter' && save()}
            />
            <Button size="sm" variant="primary" type="button" onClick={save} loading={pending}>
              Spara
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setNaming(false);
                setRenamingId(null);
                setLabel('');
              }}
            >
              Avbryt
            </Button>
          </span>
        ) : activeMatch ? (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="secondary" type="button">
                Sparad sökning ▾
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1">
              <button
                type="button"
                className="flex w-full rounded-[var(--radius-control)] px-2 py-1.5 text-left text-[13px] text-ink hover:bg-hover"
                onClick={() => openRename(activeMatch)}
              >
                Byt namn
              </button>
              <button
                type="button"
                className="flex w-full rounded-[var(--radius-control)] px-2 py-1.5 text-left text-[13px] text-danger-text hover:bg-hover"
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteTarget(activeMatch);
                }}
              >
                Ta bort
              </button>
            </PopoverContent>
          </Popover>
        ) : canSave ? (
          <Button size="sm" variant="ghost" type="button" onClick={openSave}>
            <BookmarkPlus aria-hidden />
            Spara sökningen
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Ta bort sparad sökning?"
        description={
          deleteTarget ? `“${deleteTarget.label}” tas bort. Du kan ångra direkt efteråt.` : null
        }
        confirmLabel="Ta bort"
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
