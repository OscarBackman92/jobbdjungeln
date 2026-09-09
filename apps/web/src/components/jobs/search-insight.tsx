'use client';

import type { JobHit } from '@/components/jobs/job-card';

/**
 * Lightweight market context from the ads already on screen.
 *
 * Not a national forecast — it answers "what does this result set look like?"
 * so the user can tighten or widen filters with something concrete.
 */

function topCounts(
  values: readonly string[],
  limit = 5,
): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'sv'))
    .slice(0, limit);
}

function deadlineBuckets(jobs: readonly JobHit[], today: string) {
  let overdue = 0;
  let week = 0;
  let later = 0;
  let none = 0;
  const todayMs = Date.parse(`${today}T12:00:00`);
  const weekMs = todayMs + 7 * 24 * 60 * 60 * 1000;

  for (const job of jobs) {
    const day = job.applicationDeadline;
    if (!day) {
      none += 1;
      continue;
    }
    const ms = Date.parse(`${day}T12:00:00`);
    if (!Number.isFinite(ms)) {
      none += 1;
      continue;
    }
    if (ms < todayMs) overdue += 1;
    else if (ms <= weekMs) week += 1;
    else later += 1;
  }

  return [
    { label: 'Utgångna', count: overdue, color: 'var(--danger)' },
    { label: 'Inom 7 dagar', count: week, color: 'var(--warning)' },
    { label: 'Senare', count: later, color: 'var(--chart-accent)' },
    { label: 'Utan sista dag', count: none, color: 'var(--chart-muted)' },
  ].filter((row) => row.count > 0);
}

function ShareBars({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ label: string; count: number; color?: string }>;
  total: number;
}) {
  if (rows.length === 0 || total === 0) return null;
  const max = Math.max(...rows.map((row) => row.count));

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-medium text-ink">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const width = Math.max(8, Math.round((row.count / max) * 100));
          const share = Math.round((row.count / total) * 100);
          return (
            <li
              key={row.label}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[12px] text-muted">{row.label}</div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${width}%`,
                      backgroundColor: row.color ?? 'var(--chart-accent)',
                    }}
                  />
                </div>
              </div>
              <span className="tabular-nums text-[12px] text-subtle">
                {row.count}
                <span className="text-subtle/80"> · {share}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SearchInsight({
  jobs,
  today,
}: {
  jobs: readonly JobHit[];
  /** Calendar day YYYY-MM-DD from the server or client local date. */
  today: string;
}) {
  if (jobs.length < 3) return null;

  const locations = topCounts(jobs.map((job) => job.location));
  const roles = topCounts(jobs.map((job) => job.occupationGroupLabel || job.occupationLabel));
  const deadlines = deadlineBuckets(jobs, today);

  if (locations.length === 0 && roles.length === 0 && deadlines.length === 0) {
    return null;
  }

  return (
    <section
      className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-raised p-4 sm:grid-cols-2"
      aria-label="Insikter från träffarna"
    >
      <p className="text-[12px] text-subtle sm:col-span-2">
        Baserat på de {jobs.length} annonser som laddats — inte hela Platsbanken.
      </p>
      <ShareBars title="Vanligaste orterna i träffarna" rows={locations} total={jobs.length} />
      <ShareBars title="Vanligaste yrkesgrupperna" rows={roles} total={jobs.length} />
      <div className="sm:col-span-2">
        <ShareBars title="Sista ansökningsdag" rows={deadlines} total={jobs.length} />
      </div>
    </section>
  );
}
