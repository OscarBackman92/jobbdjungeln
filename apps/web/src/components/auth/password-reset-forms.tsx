'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PasswordInput } from '@/components/auth/password-input';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { requestPasswordReset, resetPassword } from '@/lib/auth-client';

const MIN_PASSWORD_LENGTH = 10;

/**
 * Ask for a reset link.
 *
 * Always reports success, whether or not the address has an account: an honest
 * "no such user" here is a way to enumerate who has one.
 */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    await requestPasswordReset({
      email: String(formData.get('email') ?? ''),
      redirectTo: '/nytt-losenord',
    });
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-muted">
          Finns det ett konto med den adressen har vi skickat en återställningslänk. Den gäller
          i en timme.
        </p>
        <Link href="/logga-in" className="text-sm text-brand-text hover:underline">
          Tillbaka till inloggningen
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <Field label="E-post" required>
        {(props) => (
          <Input {...props} name="email" type="email" autoComplete="email" required autoFocus />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Skicka återställningslänk
      </Button>
    </form>
  );
}

/** Choose a new password, using the token from the e-mail link. */
export function NewPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!token) {
    return (
      <ErrorNote
        title="Länken är ofullständig"
        description="Öppna länken från mejlet igen, eller be om en ny."
        action={
          <Link href="/glomt-losenord" className="text-sm text-brand-text hover:underline">
            Begär en ny länk
          </Link>
        }
      />
    );
  }

  async function submit(formData: FormData) {
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
    const { error } = await resetPassword({ newPassword: password, token });
    setPending(false);

    if (error) {
      setError('Länken har gått ut eller är redan använd. Begär en ny.');
      return;
    }

    router.push('/logga-in');
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error ? <ErrorNote description={error} /> : null}

      <Field
        label="Nytt lösenord"
        required
        error={fieldErrors.password}
        hint={`Minst ${MIN_PASSWORD_LENGTH} tecken. Alla inloggade enheter loggas ut.`}
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            autoFocus
          />
        )}
      </Field>

      <Field label="Upprepa lösenordet" required error={fieldErrors.repeat}>
        {(props) => (
          <PasswordInput {...props} name="repeat" autoComplete="new-password" required />
        )}
      </Field>

      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Spara nytt lösenord
      </Button>
    </form>
  );
}
