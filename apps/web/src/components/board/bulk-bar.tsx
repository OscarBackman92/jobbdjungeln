'use client';

import { plural } from '@jobbdjungeln/core';
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Pause,
  Play,
  Send,
  Trash2,
} from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SalaryClaimDialog } from '@/components/board/salary-claim-dialog';
import {
  Button,
  ConfirmDialog,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui';
import { bulkAction } from '@/server/actions/applications';
import type { BoardRow } from '@/server/queries/board';

/**
 * The bar that appears once rows are selected.
 *
 * Sticky at the bottom of the viewport, with a spacer so it never covers the
 * last row in the list. Only actions that apply to at least one selected row
 * are shown.
 */
export function BulkBar({
  selected,
  totalCount,
  onClear,
  onSelectAll,
  variant,
}: {
  selected: BoardRow[];
  totalCount: number;
  onClear: () => void;
  onSelectAll: () => void;
  variant: 'saved' | 'applied';
}) {
  const [pending, startTransition] = useTransition();
  const [askSalary, setAskSalary] = useState(false);
  const [applyBy, setApplyBy] = useState('');
  const [reminderOpen, setReminderOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reminderLabelId = useId();

  if (selected.length === 0) return null;

  const ids = selected.map((row) => row.id);
  const anyPaused = selected.some((row) => row.intent === 'paused');
  const anyActive = selected.some((row) => row.intent !== 'paused');
  const anyArchived = selected.some((row) => row.archivedAt !== null);
  const anyUnarchived = selected.some((row) => row.archivedAt === null);

  function run(action: string, extra: Record<string, unknown> = {}) {
    startTransition(async () => {
      const result = await bulkAction({ ids, action, ...extra });
      if (result.ok) {
        toast.success(plural(result.data.affected, 'rad uppdaterad', 'rader uppdaterade'));
        setAskSalary(false);
        setReminderOpen(false);
        setApplyBy('');
        onClear();
      } else if (result.fieldErrors?.salaryClaim) {
        setAskSalary(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <div className="h-24 shrink-0 lg:h-20" aria-hidden />

      <section
        aria-label={`${plural(selected.length, 'vald rad', 'valda rader')}`}
        className="fixed inset-x-3 bottom-[4.5rem] z-40 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-raised p-2 shadow-overlay lg:inset-x-auto lg:right-6 lg:bottom-6 lg:left-[16.5rem]"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 text-sm text-ink">
          <span className="font-medium tabular-nums">
            {plural(selected.length, 'vald', 'valda')}
          </span>
          <span className="text-subtle" aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="font-medium text-brand-text underline-offset-2 hover:underline disabled:opacity-50"
            onClick={onSelectAll}
            disabled={selected.length >= totalCount || totalCount === 0}
          >
            Välj alla {totalCount}
          </button>
          <span className="text-subtle" aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="font-medium text-muted underline-offset-2 hover:underline"
            onClick={onClear}
          >
            Avmarkera
          </button>
        </span>

        {variant === 'saved' ? (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setAskSalary(true)}
              disabled={pending}
            >
              <Send aria-hidden />
              Markera som sökt
            </Button>

            <Popover open={reminderOpen} onOpenChange={setReminderOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" type="button" disabled={pending}>
                  <CalendarClock aria-hidden />
                  Sätt påminnelse…
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3">
                <div className="flex flex-col gap-2">
                  <Label id={reminderLabelId} htmlFor="bulk-apply-by" className="text-[13px]">
                    Sök senast
                  </Label>
                  <Input
                    id="bulk-apply-by"
                    type="date"
                    aria-labelledby={reminderLabelId}
                    value={applyBy}
                    onChange={(event) => setApplyBy(event.target.value)}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    type="button"
                    onClick={() => run('set_apply_by', { applyBy })}
                    disabled={pending || !applyBy}
                  >
                    Spara
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {anyActive ? (
              <Button size="sm" onClick={() => run('pause')} disabled={pending}>
                <Pause aria-hidden />
                Lägg på is
              </Button>
            ) : null}
            {anyPaused ? (
              <Button size="sm" onClick={() => run('activate')} disabled={pending}>
                <Play aria-hidden />
                Aktivera
              </Button>
            ) : null}
          </>
        ) : null}

        {anyUnarchived ? (
          <Button size="sm" onClick={() => run('archive')} disabled={pending}>
            <Archive aria-hidden />
            Arkivera
          </Button>
        ) : null}
        {anyArchived ? (
          <Button size="sm" onClick={() => run('unarchive')} disabled={pending}>
            <ArchiveRestore aria-hidden />
            Återställ
          </Button>
        ) : null}

        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />

        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 aria-hidden />
          Ta bort
        </Button>
      </section>

      <SalaryClaimDialog
        open={askSalary}
        pending={pending}
        onOpenChange={setAskSalary}
        onSubmit={(claim) => run('mark_applied', { salaryClaim: claim })}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Ta bort ${plural(selected.length, 'rad', 'rader')} permanent?`}
        description="Det går inte att ångra. Markerade rader och deras historik försvinner."
        confirmLabel="Ta bort permanent"
        pending={pending}
        onConfirm={() => {
          setConfirmDelete(false);
          run('delete');
        }}
      />
    </>
  );
}
