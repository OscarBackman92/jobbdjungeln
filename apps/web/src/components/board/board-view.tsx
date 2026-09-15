'use client';

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { ApplicationRow } from '@/components/board/application-row';
import { ApplicationSheet } from '@/components/board/application-sheet';
import { BulkBar } from '@/components/board/bulk-bar';
import { Lane } from '@/components/board/lane';
import { Button, EmptyState, Input, Label, Switch } from '@/components/ui';
import type { BoardRow } from '@/server/queries/board';

export interface LaneSpec {
  key: string;
  title: string;
  hint: string;
  tone?: 'neutral' | 'warning';
  defaultOpen?: boolean;
  rows: BoardRow[];
}

/**
 * The shared board.
 *
 * Both views are the same list of lanes over the same row type; only which
 * lanes exist and what the bulk actions do differ. Search and the archive
 * toggle live in the URL, so a filtered view can be linked to and survives a
 * reload.
 */
export function BoardView({
  lanes,
  variant,
  emptyTitle,
  emptyDescription,
  emptyAction,
  showDeadline = false,
}: {
  lanes: LaneSpec[];
  variant: 'saved' | 'applied';
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  showDeadline?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('sok') ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openLanes, setOpenLanes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(lanes.map((lane) => [lane.key, lane.defaultOpen ?? true])),
  );
  const archivedId = useId();

  const archived = params.get('arkiverade') === '1';
  const focusLane = params.get('grupp');
  const focusRow = params.get('rad');

  useEffect(() => {
    if (!focusLane) return;
    setOpenLanes((current) => ({ ...current, [focusLane]: true }));
    const timer = window.setTimeout(() => {
      document.getElementById(`lane-${focusLane}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusLane]);

  useEffect(() => {
    if (!focusRow) return;
    setOpenId(focusRow);
  }, [focusRow]);
  const total = lanes.reduce((sum, lane) => sum + lane.rows.length, 0);

  useEffect(() => {
    setOpenLanes((current) => {
      const next = { ...current };
      for (const lane of lanes) {
        if (next[lane.key] === undefined) next[lane.key] = lane.defaultOpen ?? true;
      }
      return next;
    });
  }, [lanes]);

  const visibleIds = useMemo(
    () =>
      lanes
        .filter((lane) => openLanes[lane.key] !== false)
        .flatMap((lane) => lane.rows.map((row) => row.id)),
    [lanes, openLanes],
  );

  const rowsById = useMemo(() => {
    const map = new Map<string, BoardRow>();
    for (const lane of lanes) {
      for (const row of lane.rows) map.set(row.id, row);
    }
    return map;
  }, [lanes]);
  const selectedRows = useMemo(
    () => selected.map((id) => rowsById.get(id)).filter((row): row is BoardRow => Boolean(row)),
    [selected, rowsById],
  );

  // Debounced, so typing does not fire a server round-trip per keystroke.
  useEffect(() => {
    const current = params.get('sok') ?? '';
    if (search === current) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set('sok', search);
      else next.delete('sok');
      router.replace(`?${next}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, params, router]);

  // Drop selections that are no longer on the board at all.
  useEffect(() => {
    const allIds = lanes.flatMap((lane) => lane.rows.map((row) => row.id));
    setSelected((current) => current.filter((id) => allIds.includes(id)));
  }, [lanes]);

  function toggleArchived(next: boolean) {
    const params_ = new URLSearchParams(params.toString());
    if (next) params_.set('arkiverade', '1');
    else params_.delete('arkiverade');
    router.replace(`?${params_}`, { scroll: false });
  }

  function select(id: string, isSelected: boolean) {
    setSelected((current) =>
      isSelected ? [...current, id] : current.filter((value) => value !== id),
    );
  }

  const selectAllLabel =
    variant === 'applied'
      ? `Välj alla ${visibleIds.length} synliga`
      : `Välj alla (${visibleIds.length})`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sök på arbetsgivare, roll eller ort"
            aria-label="Sök i listan"
            className="pl-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Rensa sökningen"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-subtle hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <span className="flex items-center gap-2">
          <Switch id={archivedId} checked={archived} onCheckedChange={toggleArchived} />
          <Label htmlFor={archivedId} className="text-[13px] font-normal text-muted">
            Visa arkiverade
          </Label>
        </span>

        {selected.length === 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(visibleIds)}
            disabled={visibleIds.length === 0}
          >
            {selectAllLabel}
          </Button>
        ) : null}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={Search}
          title={search ? 'Inget matchade sökningen' : emptyTitle}
          description={
            search ? 'Prova ett annat ord, eller rensa sökningen.' : emptyDescription
          }
          action={search ? undefined : emptyAction}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {lanes.map((lane) => (
            <Lane
              key={lane.key}
              id={`lane-${lane.key}`}
              title={lane.title}
              hint={lane.hint}
              count={lane.rows.length}
              tone={lane.tone}
              open={openLanes[lane.key] !== false}
              onOpenChange={(open) =>
                setOpenLanes((current) => ({ ...current, [lane.key]: open }))
              }
            >
              {lane.rows.map((row) => (
                <ApplicationRow
                  key={row.id}
                  row={row}
                  selected={selected.includes(row.id)}
                  onSelect={select}
                  onOpen={setOpenId}
                  showDeadline={showDeadline}
                  showAppliedMeta={variant === 'applied'}
                />
              ))}
            </Lane>
          ))}
        </div>
      )}

      <BulkBar
        selected={selectedRows}
        totalCount={visibleIds.length}
        onClear={() => setSelected([])}
        onSelectAll={() => setSelected(visibleIds)}
        variant={variant}
      />
      <ApplicationSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
