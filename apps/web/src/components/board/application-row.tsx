'use client';

import type { MatchSnapshot } from '@jobbdjungeln/core';
import {
  formatRelativeDays,
  formatShortDate,
  isSafeExternalUrl,
  type Status,
  savedDueDisplay,
} from '@jobbdjungeln/core';
import { AlertTriangle, CalendarClock, ExternalLink, MessageSquare, Pause } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { StatusMenu } from '@/components/board/status-menu';
import { MatchBadge } from '@/components/jobs/match-badge';
import { Button, Checkbox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { changeStatusAction, updateApplicationAction } from '@/server/actions/applications';
import type { BoardRow } from '@/server/queries/board';

function formatAppliedAgo(appliedAt: string | null): string {
  if (!appliedAt) return '';
  const rel = formatRelativeDays(appliedAt);
  if (!rel) return '';
  if (rel === 'idag') return 'Sökt idag';
  if (rel === 'igår') return 'Sökt igår';
  if (rel.endsWith('sedan')) return `Sökt för ${rel}`;
  return `Sökt ${rel}`;
}

function formatNextAction(nextActionAt: string | null): string {
  if (!nextActionAt) return '';
  const absolute = formatShortDate(nextActionAt);
  const rel = formatRelativeDays(nextActionAt);
  if (!absolute) return '';
  if (rel === 'idag' || rel === 'imorgon') return `Nästa ${rel}`;
  return `Nästa ${absolute}`;
}

/**
 * One row on either board.
 *
 * The row is a button that opens the detail sheet; the status chip, the checkbox
 * and the ad link are separate controls inside it. They stop propagation rather
 * than being nested in the button, so each stays independently focusable — a
 * button inside a button is invalid and breaks keyboard navigation.
 */
export function ApplicationRow({
  row,
  selected,
  onSelect,
  onOpen,
  showDeadline = false,
  showAppliedMeta = false,
}: {
  row: BoardRow;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onOpen: (id: string) => void;
  showDeadline?: boolean;
  showAppliedMeta?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const savedDue = showDeadline ? savedDueDisplay(row) : null;
  const due = showDeadline ? savedDue?.date : row.nextActionAt;
  const dueOverdue = showDeadline
    ? Boolean(due && formatRelativeDays(due).includes('sedan'))
    : row.followUpOverdue;
  const isReminder = savedDue?.source === 'reminder';
  const appliedAgo = showAppliedMeta ? formatAppliedAgo(row.appliedAt) : '';
  const nextActionLabel =
    showAppliedMeta &&
    row.stage !== 'sokt' &&
    row.stage !== 'avslutad' &&
    row.stage !== 'bevakad'
      ? formatNextAction(row.nextActionAt)
      : '';
  const hasLink = isSafeExternalUrl(row.applyUrl || row.adUrl);

  function markNoResponse() {
    startTransition(async () => {
      const result = await changeStatusAction({ id: row.id, status: 'no_response' });
      if (result.ok) {
        toast.success('Markerad som Inget svar');
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function followUp() {
    startTransition(async () => {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const result = await updateApplicationAction({ id: row.id, nextActionAt: iso });
      if (result.ok) {
        toast.success('Påminnelse satt till idag');
        onOpen(row.id);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <li
      className={cn(
        'group relative flex flex-col gap-2 border-b border-line px-3 py-2.5 transition-colors last:border-b-0 hover:bg-hover',
        selected && 'bg-brand-soft/40',
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelect(row.id, value === true)}
          aria-label={`Välj ${row.title} hos ${row.company}`}
          className="shrink-0"
        />

        <button
          type="button"
          onClick={() => onOpen(row.id)}
          className="min-w-0 flex-1 text-left outline-none"
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{row.title}</span>
            {row.intent === 'paused' ? (
              <Pause className="size-3.5 shrink-0 text-subtle" aria-label="Lagd på is" />
            ) : null}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
            <span className="truncate">{row.company}</span>
            {row.location ? (
              <>
                <span aria-hidden className="text-subtle">
                  ·
                </span>
                <span className="truncate">{row.location}</span>
              </>
            ) : null}
            {appliedAgo ? (
              <>
                <span aria-hidden className="text-subtle">
                  ·
                </span>
                <span className="text-subtle">{appliedAgo}</span>
              </>
            ) : null}
            {nextActionLabel ? (
              <>
                <span aria-hidden className="text-subtle">
                  ·
                </span>
                <span className="text-subtle">{nextActionLabel}</span>
              </>
            ) : null}
            {row.eventCount > 0 ? (
              <>
                <span aria-hidden className="text-subtle">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-subtle">
                  <MessageSquare className="size-3" aria-hidden />
                  {row.eventCount}
                </span>
              </>
            ) : null}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {due ? (
            <span
              className={cn(
                'hidden flex-col items-end gap-0 text-[13px] sm:inline-flex',
                dueOverdue ? 'text-warning-text' : isReminder ? 'text-subtle' : 'text-muted',
              )}
              title={savedDue?.label ?? (showDeadline ? 'Sök senast' : 'Nästa steg')}
            >
              <span className="inline-flex items-center gap-1">
                <CalendarClock
                  className={cn('size-3.5', isReminder && 'opacity-60')}
                  aria-hidden
                />
                <span className={cn(isReminder && 'border-b border-dashed border-current/40')}>
                  {formatRelativeDays(due)}
                </span>
              </span>
              {savedDue ? (
                <span className="text-[11px] text-subtle">
                  {savedDue.label}
                  {formatShortDate(due) ? ` · ${formatShortDate(due)}` : ''}
                </span>
              ) : (
                <span className="text-[11px] text-subtle">{formatShortDate(due)}</span>
              )}
            </span>
          ) : null}

          {row.matchSnapshot ? (
            <MatchBadge jobId={row.id} match={row.matchSnapshot as MatchSnapshot} />
          ) : (
            <span
              className="inline-flex min-w-8 justify-center text-[13px] text-subtle"
              title="Ingen matchdata"
            >
              <span aria-hidden="true">–</span>
              <span className="sr-only">Ingen matchdata</span>
            </span>
          )}

          <StatusMenu id={row.id} status={row.status as Status} salaryClaim={row.salaryClaim} />

          <span className="inline-flex w-8 justify-center">
            {hasLink ? (
              <a
                href={row.applyUrl || row.adUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-subtle transition-colors hover:bg-hover hover:text-ink"
                aria-label={`Öppna annonsen för ${row.title}`}
                onClick={(event) => event.stopPropagation()}
              >
                <ExternalLink className="size-4" aria-hidden />
              </a>
            ) : null}
          </span>
        </div>
      </div>

      {showAppliedMeta && row.overdue && row.waitingDays !== null ? (
        <div className="ml-8 flex flex-wrap items-center gap-2 text-[13px] text-warning-text">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          <span>Inget hört på {row.waitingDays} dagar</span>
          <span className="text-subtle" aria-hidden>
            ·
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[13px]"
            disabled={pending}
            onClick={followUp}
          >
            Följ upp
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[13px]"
            disabled={pending}
            onClick={markNoResponse}
          >
            Markera som Inget svar
          </Button>
        </div>
      ) : null}
    </li>
  );
}
