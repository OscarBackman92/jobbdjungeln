'use client';

import { monthHeading } from '@jobbdjungeln/core';
import { useState } from 'react';

/**
 * Applications per month, split by whether they got a reply.
 *
 * An emphasis chart rather than a categorical one: the story is "how many led
 * somewhere", so that part carries the accent hue and the rest is neutral
 * context. Two series, so a legend is present.
 */

export interface MonthlyPoint {
  key: string;
  applied: number;
  reachedContact: number;
}

const BAR_MAX_WIDTH = 24;

function label(key: string): string {
  const [, month] = key.split('-').map(Number);
  return month ? monthHeading(month).slice(0, 3) : key;
}

export function MonthlyChart({ points }: { points: readonly MonthlyPoint[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...points.map((point) => point.applied), 1);

  if (points.every((point) => point.applied === 0)) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Diagrammet fylls när du börjat söka jobb.
      </p>
    );
  }

  const active = points.find((point) => point.key === hovered);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: 'var(--chart-accent)' }}
            aria-hidden
          />
          Fick svar
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: 'var(--chart-muted)' }}
            aria-hidden
          />
          Inget svar än
        </span>
      </div>

      <div className="relative">
        <ul className="flex h-40 items-end justify-between gap-2">
          {points.map((point) => {
            const total = (point.applied / max) * 100;
            const replied =
              point.applied === 0 ? 0 : (point.reachedContact / point.applied) * 100;
            const dim = hovered !== null && hovered !== point.key;
            return (
              <li
                key={point.key}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                onPointerEnter={() => setHovered(point.key)}
                onPointerLeave={() => setHovered(null)}
              >
                <span
                  className="flex w-full flex-col justify-end rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${Math.max(total, point.applied > 0 ? 3 : 0)}%`,
                    maxWidth: BAR_MAX_WIDTH,
                    opacity: dim ? 0.5 : 1,
                  }}
                >
                  <span
                    className="w-full rounded-t-[4px]"
                    style={{
                      height: `${replied}%`,
                      backgroundColor: 'var(--chart-accent)',
                    }}
                  />
                  <span
                    className="w-full"
                    style={{
                      // A 2px gap in the surface colour separates the segments.
                      height: `${100 - replied}%`,
                      backgroundColor: 'var(--chart-muted)',
                      borderTop:
                        replied > 0 && replied < 100
                          ? '2px solid var(--surface-raised)'
                          : undefined,
                    }}
                  />
                </span>
                <span className="text-[11px] text-subtle">{label(point.key)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <p aria-live="polite" className="min-h-4 text-[13px] text-subtle">
        {active
          ? `${label(active.key)}: ${active.applied} sökta, ${active.reachedContact} fick svar`
          : ''}
      </p>

      <details className="text-[13px] text-subtle">
        <summary className="cursor-pointer select-none hover:text-muted">
          Visa som tabell
        </summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-subtle">
              <th scope="col" className="pb-1 font-medium">
                Månad
              </th>
              <th scope="col" className="pb-1 font-medium">
                Sökta
              </th>
              <th scope="col" className="pb-1 font-medium">
                Fick svar
              </th>
            </tr>
          </thead>
          <tbody className="text-muted">
            {points.map((point) => (
              <tr key={point.key}>
                <td className="py-0.5">{point.key}</td>
                <td className="py-0.5 tabular-nums">{point.applied}</td>
                <td className="py-0.5 tabular-nums">{point.reachedContact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
