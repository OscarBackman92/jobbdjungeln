import type { ReactNode } from 'react';

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-raised p-6 shadow-card">
      <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
      {footer ? (
        <div className="mt-5 border-t border-line pt-4 text-sm text-muted">{footer}</div>
      ) : null}
    </div>
  );
}
