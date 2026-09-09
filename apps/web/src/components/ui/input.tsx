'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentProps, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

const fieldStyles =
  'w-full rounded-[var(--radius-control)] border border-line-strong bg-raised px-3 text-sm text-ink placeholder:text-subtle transition-[border-color,box-shadow] outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25';

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-[13px] font-medium text-ink', className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldStyles, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(fieldStyles, 'min-h-24 py-2 leading-relaxed', className)}
      {...props}
    />
  );
}

export interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean;
  }) => ReactNode;
}

/**
 * A labelled form field.
 *
 * The render prop hands down the generated id and the aria wiring, so no caller
 * can accidentally ship an input whose error text is invisible to a screen
 * reader.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/*
        The required marker sits outside the <label>, so it stays out of the
        accessible name: Chromium folds both label text and CSS generated content
        into it, and a screen reader would announce "Lösenord star". The meaning
        is carried by the input's own `required` attribute instead.
      */}
      <span className="flex items-center gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {required ? (
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        ) : null}
      </span>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-[13px] text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
