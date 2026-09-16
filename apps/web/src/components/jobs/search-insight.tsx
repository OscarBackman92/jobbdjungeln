'use client';

import { pluralWord } from '@jobbdjungeln/core';
import type { SearchStatBucket, SearchStatValue } from '@jobbdjungeln/jobtech';
import { useEffect, useId, useState } from 'react';

/**
 * Market context for the full Platsbanken result set (JobTech `stats`).
 *
 * Collapsed by default so the first ad stays near the result count. Open state
 * is remembered in localStorage when available.
 */

const STORAGE_KEY = 'jobbdjungeln.search-insight.open';

export type InsightFilterKind = 'municipality' | 'occupation-group';

function readOpenPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOpenPreference(open: boolean) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, open ? '1' : '0');
  } catch {
    // Private mode / disabled storage — ignore.
  }
}

function visibleBucket(
  bucket: SearchStatBucket | undefined,
  activeIds: readonly string[],
): SearchStatValue[] {
  if (!bucket?.values.length) return [];
  const values = bucket.values;
  if (values.length === 1) {
    const only = values[0];
    if (only && activeIds.includes(only.conceptId)) return [];
  }
  return values;
}

function ShareBars({
  title,
  rows,
  total,
  kind,
  activeIds,
  onSelect,
}: {
  title: string;
  rows: readonly SearchStatValue[];
  total: number;
  kind: InsightFilterKind;
  activeIds: readonly string[];
  onSelect: (kind: InsightFilterKind, value: SearchStatValue) => void;
}) {
  if (rows.length === 0 || total === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-medium text-ink">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const share = Math.round((row.count / total) * 100);
          const active = activeIds.includes(row.conceptId);
          return (
            <li key={row.conceptId}>
              <button
                type="button"
                disabled={active}
                onClick={() => onSelect(kind, row)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius-control)] text-left outline-none transition-colors hover:bg-sunken focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-default disabled:hover:bg-transparent"
                aria-label={
                  active
                    ? `${row.label}, redan filterat, ${row.count} annonser`
                    : `Filtrera på ${row.label}, ${row.count} annonser`
                }
              >
                <div className="min-w-0 px-1 py-0.5">
                  <div className="truncate text-[12px] text-muted">{row.label}</div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(share > 0 ? share : 0, 0))}%`,
                        backgroundColor: 'var(--chart-accent)',
                      }}
                    />
                  </div>
                </div>
                <span className="pr-1 tabular-nums text-[12px] text-subtle">
                  {row.count.toLocaleString('sv-SE')}
                  <span className="text-subtle/80"> · {share}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SearchInsight({
  total,
  stats,
  municipalities,
  groups,
  loading,
  onAddFilter,
}: {
  total: number;
  stats: readonly SearchStatBucket[] | undefined;
  municipalities: readonly string[];
  groups: readonly string[];
  loading?: boolean;
  onAddFilter: (kind: InsightFilterKind, value: SearchStatValue) => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(readOpenPreference());
  }, []);

  const municipalityValues = visibleBucket(
    stats?.find((bucket) => bucket.type === 'municipality'),
    municipalities,
  );
  const groupValues = visibleBucket(
    stats?.find((bucket) => bucket.type === 'occupation-group'),
    groups,
  );

  if (total <= 0) return null;
  if (!loading && municipalityValues.length === 0 && groupValues.length === 0) {
    return null;
  }

  function toggle() {
    setOpen((current) => {
      const next = !current;
      writeOpenPreference(next);
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Statistik för träffarna">
      <button
        type="button"
        className="flex w-fit items-center gap-1 text-[13px] text-subtle outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span>
          Statistik för {total.toLocaleString('sv-SE')}{' '}
          {pluralWord(total, 'annons', 'annonser')}
        </span>
        <span aria-hidden="true" className="tabular-nums">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-raised p-4 sm:grid-cols-2"
        >
          {loading && !stats ? (
            <p className="text-[12px] text-subtle sm:col-span-2">Hämtar statistik…</p>
          ) : (
            <>
              <ShareBars
                title="Vanligaste orterna"
                rows={municipalityValues}
                total={total}
                kind="municipality"
                activeIds={municipalities}
                onSelect={onAddFilter}
              />
              <ShareBars
                title="Vanligaste yrkesgrupperna"
                rows={groupValues}
                total={total}
                kind="occupation-group"
                activeIds={groups}
                onSelect={onAddFilter}
              />
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
