'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
      <DialogPrimitive.Content
        className={cn(
          // Full height on a phone, a centred sheet from `sm` up.
          // overflow-hidden + max-h keeps the sheet bounded so DialogBody
          // (min-h-0, overflow-y-auto) is the only scroll surface — without
          // it the whole dialog grows and a sticky footer floats mid-form.
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-raised shadow-overlay',
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85dvh] sm:w-[min(42rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-card)]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-4 right-4 rounded-md p-1.5 text-subtle transition-colors hover:bg-hover hover:text-ink"
          aria-label="Stäng"
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-1 border-b border-line bg-raised px-5 py-4 pr-14',
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-semibold tracking-tight text-ink', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />
  );
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        // min-h-0 lets this flex child shrink so overflow-y-auto can scroll
        // inside a max-height dialog (without it, Save/Delete sit off-screen).
        'scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        // Sibling of the scrolling DialogBody — not sticky. Sticky bottom
        // floated the actions over mid-form fields when the dialog itself
        // became the scroll container.
        'flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-raised px-5 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}
