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
const CHART_HEIGHT = 160;

function label(key: string): string {
  const [, month] = key.split('-').map(Number);
  return month ? monthHeading(month).slice(0, 3) : key;
}

function yTicks(max: number): number[] {
  if (max <= 1) return [0, 1];
  if (max <= 4) return [0, 1, 2, max];
  const step = Math.ceil(max / 4);
  const ticks = [0];
  for (let value = step; value < max; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
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
  const ticks = yTicks(max);

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

      <div className="relative flex gap-2">
        <div
          className="flex w-6 shrink-0 flex-col justify-between pb-5 text-right text-[10px] tabular-nums text-subtle"
          style={{ height: CHART_HEIGHT + 20 }}
          aria-hidden
        >
          {[...ticks].reverse().map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{ height: CHART_HEIGHT }}
            aria-hidden
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute inset-x-0 border-t border-chart-grid"
                style={{ bottom: `${(tick / max) * 100}%` }}
              />
            ))}
          </div>

          <ul
            className="relative flex items-end justify-between gap-2"
            style={{ height: CHART_HEIGHT }}
          >
            {points.map((point) => {
              const total = (point.applied / max) * 100;
              const replied =
                point.applied === 0 ? 0 : (point.reachedContact / point.applied) * 100;
              const dim = hovered !== null && hovered !== point.key;
              const empty = point.applied === 0;
              return (
                <li
                  key={point.key}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  onPointerEnter={() => setHovered(point.key)}
                  onPointerLeave={() => setHovered(null)}
                >
                  {!empty ? (
                    <span className="text-[10px] tabular-nums text-subtle">{point.applied}</span>
                  ) : (
                    <span className="text-[10px] text-transparent" aria-hidden>
                      0
                    </span>
                  )}
                  <span
                    className="relative flex w-full flex-col justify-end rounded-t-[4px] transition-opacity"
                    style={{
                      height: empty ? 2 : `${Math.max(total, 3)}%`,
                      maxWidth: BAR_MAX_WIDTH,
                      opacity: dim ? 0.5 : 1,
                      backgroundColor: empty ? 'var(--chart-grid)' : undefined,
                    }}
                  >
                    {!empty ? (
                      <>
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
                            height: `${100 - replied}%`,
                            backgroundColor: 'var(--chart-muted)',
                            borderTop:
                              replied > 0 && replied < 100
                                ? '2px solid var(--surface-raised)'
                                : undefined,
                          }}
                        />
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>

          <ul className="mt-1.5 flex justify-between gap-2" aria-hidden>
            {points.map((point) => (
              <li key={point.key} className="flex-1 text-center text-[11px] text-subtle">
                {label(point.key)}
              </li>
            ))}
          </ul>
        </div>
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
