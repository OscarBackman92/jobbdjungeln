'use client';

import { STAGE_LABELS, type Stage } from '@jobbdjungeln/core';
import { useState } from 'react';

/**
 * The pipeline funnel.
 *
 * Colour encodes the stage's position, not its identity, so it is one hue in
 * five monotone steps rather than five different colours — the reader sees the
 * order in the ramp. Every bar carries its own value, which is also what makes
 * the lightest step legible without relying on the fill alone.
 */

export interface FunnelStep {
  stage: Stage;
  count: number;
  share: number;
}

const STAGE_HINTS: Partial<Record<Stage, string>> = {
  sokt: 'Ansökningar du skickat',
  kontakt: 'Fick någon form av svar',
  intervju: 'Kom till intervju',
  erbjudande: 'Fick ett erbjudande',
};

const RAMP = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

export function Funnel({ steps }: { steps: readonly FunnelStep[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...steps.map((step) => step.count), 1);

  if (steps.every((step) => step.count === 0)) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Tratten fylls när du markerat din första ansökan som skickad.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {steps.map((step, index) => {
          const width = (step.count / max) * 100;
          const active = hovered === step.stage;
          return (
            <li
              key={step.stage}
              className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3"
              onPointerEnter={() => setHovered(step.stage)}
              onPointerLeave={() => setHovered(null)}
            >
              <span className="truncate text-[13px] text-muted">
                {STAGE_LABELS[step.stage]}
              </span>
              <span className="relative block h-5 rounded-sm bg-sunken">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width,opacity] duration-300"
                  style={{
                    width: `${Math.max(width, step.count > 0 ? 1.5 : 0)}%`,
                    backgroundColor: RAMP[index] ?? RAMP[RAMP.length - 1],
                    opacity: hovered && !active ? 0.55 : 1,
                  }}
                />
              </span>
              <span className="tabular-nums text-[13px] font-medium text-ink">
                {step.count}
                <span className="ml-1.5 font-normal text-subtle">{step.share}%</span>
              </span>
            </li>
          );
        })}
      </ul>

      <p aria-live="polite" className="min-h-4 text-[13px] text-subtle">
        {hovered
          ? (STAGE_HINTS[hovered as Stage] ??
            `${STAGE_LABELS[hovered as Stage]}: ${steps.find((s) => s.stage === hovered)?.count ?? 0}`)
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
                Steg
              </th>
              <th scope="col" className="pb-1 font-medium">
                Antal
              </th>
              <th scope="col" className="pb-1 font-medium">
                Andel
              </th>
            </tr>
          </thead>
          <tbody className="text-muted">
            {steps.map((step) => (
              <tr key={step.stage}>
                <td className="py-0.5">{STAGE_LABELS[step.stage]}</td>
                <td className="py-0.5 tabular-nums">{step.count}</td>
                <td className="py-0.5 tabular-nums">{step.share}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
