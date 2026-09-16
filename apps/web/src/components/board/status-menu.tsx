'use client';

import {
  allowedNextStatuses,
  requiresSalaryClaim,
  STATUS_LABELS,
  STATUS_MENU_GROUPS,
  type Status,
  stageForStatus,
} from '@jobbdjungeln/core';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SalaryClaimDialog } from '@/components/board/salary-claim-dialog';
import { Badge } from '@/components/ui';
import { statusTone } from '@/lib/status-tone';
import { changeStatusAction } from '@/server/actions/applications';

/**
 * Move a row along the pipeline.
 *
 * Application rows can jump to any non-wishlist status; saved jobs stay limited
 * to Ansökt / Återkallad. Leaving the wishlist asks for salary when required.
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [askingFor, setAskingFor] = useState<Status | null>(null);

  function apply(next: Status, claim?: string, previous: Status = status) {
    startTransition(async () => {
      try {
        const result = await changeStatusAction({ id, status: next, salaryClaim: claim });
        if (result.ok) {
          setAskingFor(null);
          toast(`Flyttad till ${STATUS_LABELS[next]}`, {
            duration: 8000,
            cancel: {
              label: 'Ångra',
              onClick: () => {
                startTransition(async () => {
                  const undone = await changeStatusAction({ id, status: previous });
                  if (undone.ok) router.refresh();
                  else toast.error(undone.error);
                });
              },
            },
          });
          router.refresh();
        } else if (result.fieldErrors?.salaryClaim) {
          setAskingFor(next);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error('Kunde inte uppdatera statusen. Prova igen.');
      }
    });
  }

  function select(next: Status) {
    if (next === status) return;
    const leavingWishlist =
      stageForStatus(status) === 'bevakad' && stageForStatus(next) !== 'bevakad';
    if (leavingWishlist && requiresSalaryClaim(next) && !salaryClaim.trim()) {
      setAskingFor(next);
      return;
    }
    apply(next);
  }

  const wishlist = status === 'wishlist';
  const allowed = new Set(allowedNextStatuses(status));

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          disabled={pending}
          className="inline-flex min-h-6 min-w-6 items-center justify-center gap-1 rounded-full p-0.5 outline-none disabled:opacity-60"
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
            className="z-50 min-w-52 rounded-[var(--radius-control)] border border-line bg-raised p-1 shadow-overlay"
          >
            {wishlist ? (
              <>
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
              </>
            ) : (
              STATUS_MENU_GROUPS.map((group) => (
                <DropdownMenu.Group key={group.label}>
                  <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-subtle">
                    {group.label}
                  </DropdownMenu.Label>
                  {group.statuses.map((next) => {
                    const current = next === status;
                    const enabled = current || allowed.has(next);
                    return (
                      <DropdownMenu.CheckboxItem
                        key={next}
                        checked={current}
                        disabled={!enabled || pending}
                        onSelect={(event) => {
                          event.preventDefault();
                          select(next);
                        }}
                        className="relative flex cursor-pointer items-center rounded-md py-2 pr-2 pl-7 text-sm text-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover"
                      >
                        <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex">
                          <Check className="size-3.5" aria-hidden />
                        </DropdownMenu.ItemIndicator>
                        {STATUS_LABELS[next]}
                      </DropdownMenu.CheckboxItem>
                    );
                  })}
                </DropdownMenu.Group>
              ))
            )}
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
