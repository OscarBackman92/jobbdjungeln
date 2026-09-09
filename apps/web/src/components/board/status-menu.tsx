'use client';

import {
  allowedNextStatuses,
  STATUS_LABELS,
  type Status,
  stageForStatus,
} from '@jobbdjungeln/core';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SalaryClaimDialog } from '@/components/board/salary-claim-dialog';
import { Badge } from '@/components/ui';
import { statusTone } from '@/lib/status-tone';
import { changeStatusAction } from '@/server/actions/applications';

/**
 * Move a row along the pipeline.
 *
 * Only transitions the domain allows are offered, so the menu can never produce
 * a state the server would refuse. Leaving the wishlist asks for the salary
 * expectation first — that is the one moment the answer is actually known.
 */
export function StatusMenu({
  id,
  status,
  salaryClaim,
}: {
  id: string;
  status: Status;
  salaryClaim: string;
}) {
  const [pending, startTransition] = useTransition();
  const [askingFor, setAskingFor] = useState<Status | null>(null);

  function apply(next: Status, claim?: string) {
    startTransition(async () => {
      const result = await changeStatusAction({ id, status: next, salaryClaim: claim });
      if (result.ok) {
        toast.success(`Flyttad till ${STATUS_LABELS[next]}`);
        setAskingFor(null);
      } else if (result.fieldErrors?.salaryClaim) {
        setAskingFor(next);
      } else {
        toast.error(result.error);
      }
    });
  }

  function select(next: Status) {
    const leavingWishlist =
      stageForStatus(status) === 'bevakad' && stageForStatus(next) !== 'bevakad';
    if (leavingWishlist && !salaryClaim.trim()) {
      setAskingFor(next);
      return;
    }
    apply(next);
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full outline-none disabled:opacity-60"
          aria-label={`Status: ${STATUS_LABELS[status]}. Ändra`}
        >
          <Badge tone={statusTone(status)}>
            {STATUS_LABELS[status]}
            <ChevronDown className="size-3" aria-hidden />
          </Badge>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 min-w-48 rounded-[var(--radius-control)] border border-line bg-raised p-1 shadow-overlay"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-subtle">
              Flytta till
            </DropdownMenu.Label>
            {allowedNextStatuses(status).map((next) => (
              <DropdownMenu.Item
                key={next}
                onSelect={() => select(next)}
                className="cursor-pointer rounded-md px-2 py-2 text-sm text-ink outline-none data-[highlighted]:bg-hover"
              >
                {STATUS_LABELS[next]}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <SalaryClaimDialog
        open={askingFor !== null}
        pending={pending}
        onOpenChange={(open) => !open && setAskingFor(null)}
        onSubmit={(claim) => askingFor && apply(askingFor, claim)}
      />
    </>
  );
}
