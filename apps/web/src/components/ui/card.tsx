import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Elements a card may render as, when a plain box is not the honest markup — a
 * job ad is an <article>, not a div.
 */
type CardElement = 'div' | 'article' | 'section';

export function Card({
  className,
  as: Component = 'div',
  ...props
}: Omit<ComponentProps<'div'>, 'ref'> & { as?: CardElement }) {
  return (
    <Component
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-raised shadow-card',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('text-[15px] font-semibold tracking-tight text-ink', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-line p-5 py-3', className)}
      {...props}
    />
  );
}
