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
  X,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SalaryClaimDialog } from '@/components/board/salary-claim-dialog';
import { Button, Input } from '@/components/ui';
import { bulkAction } from '@/server/actions/applications';

/**
 * The bar that appears once rows are selected.
 *
 * Sticky at the bottom of the viewport, with a spacer so it never covers the
 * last row in the list.
 */
export function BulkBar({
  selected,
  onClear,
  variant,
}: {
  selected: string[];
  onClear: () => void;
  variant: 'saved' | 'applied';
}) {
  const [pending, startTransition] = useTransition();
  const [askSalary, setAskSalary] = useState(false);
  const [applyBy, setApplyBy] = useState('');

  if (selected.length === 0) return null;

  function run(action: string, extra: Record<string, unknown> = {}) {
    startTransition(async () => {
      const result = await bulkAction({ ids: selected, action, ...extra });
      if (result.ok) {
        toast.success(plural(result.data.affected, 'rad uppdaterad', 'rader uppdaterade'));
        setAskSalary(false);
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
      {/* Reserve space so the fixed bar does not cover the last lane row. */}
      <div className="h-24 shrink-0 lg:h-20" aria-hidden />

      <section
        aria-label={`${plural(selected.length, 'vald rad', 'valda rader')}`}
        className="fixed inset-x-3 bottom-[4.5rem] z-40 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-raised p-2 shadow-overlay lg:inset-x-auto lg:right-6 lg:bottom-6 lg:left-[16.5rem]"
      >
        <span className="px-2 text-sm font-medium text-ink tabular-nums">
          {plural(selected.length, 'vald', 'valda')}
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
            <div className="flex items-center gap-1">
              <Input
                type="date"
                aria-label="Sök senast"
                value={applyBy}
                onChange={(event) => setApplyBy(event.target.value)}
                className="h-8 w-36"
              />
              <Button
                size="sm"
                onClick={() => run('set_apply_by', { applyBy })}
                disabled={pending || !applyBy}
              >
                <CalendarClock aria-hidden />
                Sätt
              </Button>
            </div>
            <Button size="sm" onClick={() => run('pause')} disabled={pending}>
              <Pause aria-hidden />
              Lägg på is
            </Button>
            <Button size="sm" onClick={() => run('activate')} disabled={pending}>
              <Play aria-hidden />
              Aktivera
            </Button>
          </>
        ) : null}

        <Button size="sm" onClick={() => run('archive')} disabled={pending}>
          <Archive aria-hidden />
          Arkivera
        </Button>
        <Button size="sm" onClick={() => run('unarchive')} disabled={pending}>
          <ArchiveRestore aria-hidden />
          Återställ
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`Ta bort ${plural(selected.length, 'rad', 'rader')} permanent?`))
              run('delete');
          }}
        >
          <Trash2 aria-hidden />
          Ta bort
        </Button>

        <Button size="icon" variant="ghost" onClick={onClear} aria-label="Avmarkera alla">
          <X aria-hidden />
        </Button>
      </section>

      <SalaryClaimDialog
        open={askSalary}
        pending={pending}
        onOpenChange={setAskSalary}
        onSubmit={(claim) => run('mark_applied', { salaryClaim: claim })}
      />
    </>
  );
}
