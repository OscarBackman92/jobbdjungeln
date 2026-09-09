'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line-strong bg-raised px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-60 data-[placeholder]:text-subtle',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-subtle" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  collisionPadding = 16,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        collisionPadding={collisionPadding}
        className={cn(
          // Above the mobile bottom nav (z-40) so phone users can scroll options.
          'scrollbar-slim relative z-[60] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-[var(--radius-control)] border border-line bg-raised p-1 shadow-overlay',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="max-h-[inherit] w-full">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-md py-2 pr-2 pl-8 text-sm text-ink outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-brand" aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn('px-2 py-1.5 text-xs font-medium text-subtle', className)}
      {...props}
    />
  );
}
