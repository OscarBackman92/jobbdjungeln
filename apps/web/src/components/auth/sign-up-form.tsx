'use client';

import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { GoogleButton } from '@/components/auth/google-button';
import { PasswordInput } from '@/components/auth/password-input';
import { Button, ErrorNote, Field, Input, Separator } from '@/components/ui';
import { signUp } from '@/lib/auth-client';

const MIN_PASSWORD_LENGTH = 10;

/**
 * Create an account.
 *
 * No session is issued until the address is confirmed, so the form ends on a
 * "check your mail" state rather than dropping the user into an app they cannot
 * use yet.
 */
export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const repeat = String(formData.get('repeat') ?? '');

    setFieldErrors({});
    setError(undefined);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldErrors({ password: `Minst ${MIN_PASSWORD_LENGTH} tecken.` });
      return;
    }
    if (password !== repeat) {
      setFieldErrors({ repeat: 'Lösenorden är inte lika.' });
      return;
    }

    setPending(true);
    const { error } = await signUp.email({ email, password, name: '' });
    setPending(false);

    if (error) {
      setError(
        error.status === 422 || error.code === 'USER_ALREADY_EXISTS'
          ? 'Det finns redan ett konto med den adressen. Prova att logga in.'
          : (error.message ?? 'Kunde inte skapa kontot.'),
      );
      return;
    }

    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <p className="text-sm font-medium text-ink">Kolla mejlen</p>
        <p className="text-sm text-muted">
          Vi har skickat en bekräftelselänk till <span className="text-ink">{sentTo}</span>.
          Klicka på den så är du igång. Kolla skräpposten om den inte dyker upp.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {googleEnabled ? (
        <>
          <GoogleButton />
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[13px] text-subtle">eller</span>
            <Separator className="flex-1" />
          </div>
        </>
      ) : null}

      <form action={submit} className="flex flex-col gap-4">
        {error ? <ErrorNote description={error} /> : null}

        <Field label="E-post" required>
          {(props) => (
            <Input
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="du@exempel.se"
            />
          )}
        </Field>

        <Field
          label="Lösenord"
          required
          error={fieldErrors.password}
          hint={`Minst ${MIN_PASSWORD_LENGTH} tecken.`}
        >
          {(props) => (
            <PasswordInput
              {...props}
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          )}
        </Field>

        <Field label="Upprepa lösenordet" required error={fieldErrors.repeat}>
          {(props) => (
            <PasswordInput {...props} name="repeat" autoComplete="new-password" required />
          )}
        </Field>

        <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
          Skapa konto
        </Button>
      </form>
    </div>
  );
}
