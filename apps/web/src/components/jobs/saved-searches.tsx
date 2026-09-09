'use client';

import { BookmarkPlus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { SearchState } from '@/components/jobs/search-panel';
import { Badge, Button, Input } from '@/components/ui';
import { deleteSearchAction, saveSearchAction } from '@/server/actions/searches';

export interface SavedSearch {
  id: string;
  label: string;
  query: string;
  regions: string[];
  municipalities: string[];
  occupationFields: string[];
  occupationGroups: string[];
  remote: boolean;
}

/**
 * Saved searches.
 *
 * A job hunt is the same handful of searches run over and over, so they are
 * worth one click — and they are what the Monday digest watches for new ads.
 */
export function SavedSearches({
  searches,
  current,
  onUse,
}: {
  searches: SavedSearch[];
  current: SearchState;
  onUse: (state: Pick<
    SearchState,
    'q' | 'region' | 'municipality' | 'field' | 'group' | 'remote'
  >) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState('');

  const canSave = Boolean(current.q || current.region || current.field || current.remote);

  function save() {
    startTransition(async () => {
      const result = await saveSearchAction({
        label: label.trim() || current.q || 'Sparad sökning',
        query: current.q,
        regions: current.region ? [current.region] : [],
        municipalities: current.municipality ? [current.municipality] : [],
        occupationFields: current.field ? [current.field] : [],
        occupationGroups: current.group ? [current.group] : [],
        remote: current.remote,
        matchCv: false,
        digestOptIn: true,
      });
      if (result.ok) {
        toast.success('Sökningen är sparad');
        setNaming(false);
        setLabel('');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteSearchAction(id);
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  if (searches.length === 0 && !canSave) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searches.map((search) => (
        <span key={search.id} className="inline-flex items-center">
          <button
            type="button"
            onClick={() =>
              onUse({
                q: search.query,
                region: search.regions[0] ?? '',
                municipality: search.municipalities[0] ?? '',
                field: search.occupationFields[0] ?? '',
                group: search.occupationGroups[0] ?? '',
                remote: search.remote,
              })
            }
            className="rounded-l-full outline-none"
          >
            <Badge tone="outline" className="rounded-r-none pr-1.5 hover:bg-hover">
              {search.label}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => remove(search.id)}
            disabled={pending}
            aria-label={`Ta bort sökningen ${search.label}`}
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-r-full border border-l-0 border-line-strong pr-2 pl-1 text-subtle transition-colors hover:text-danger-text"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}

      {canSave ? (
        naming ? (
          <span className="inline-flex items-center gap-1">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Namn på sökningen"
              aria-label="Namn på sökningen"
              className="h-8 w-44"
              autoFocus
              onKeyDown={(event) => event.key === 'Enter' && save()}
            />
            <Button size="sm" variant="primary" onClick={save} loading={pending}>
              Spara
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNaming(false)}>
              Avbryt
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setNaming(true)}>
            <BookmarkPlus aria-hidden />
            Spara sökningen
          </Button>
        )
      ) : null}
    </div>
  );
}
