import type { z } from 'zod';

/**
 * The shape every Server Action returns.
 *
 * Actions never throw at the UI: a validation failure and a business rule
 * failure both come back as data, so a form can render the message next to the
 * field it belongs to instead of tripping an error boundary.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Flatten a Zod error into one message per field, for inline display. */
export function fromZod(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    fieldErrors[key] ??= issue.message;
  }
  const first = Object.values(fieldErrors)[0] ?? 'Kontrollera fälten och försök igen.';
  return fail(first, fieldErrors);
}
