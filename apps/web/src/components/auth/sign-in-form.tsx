'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GoogleButton } from '@/components/auth/google-button';
import { PasswordInput } from '@/components/auth/password-input';
import { Button, ErrorNote, Field, Input, Separator } from '@/components/ui';
import { signIn } from '@/lib/auth-client';

/**
 * Sign in.
 *
 * The error message stays deliberately vague — "e-post eller lösenord stämmer
 * inte" — because a message that distinguishes the two tells an attacker which
 * addresses have accounts.
 */
export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [unverified, setUnverified] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    setUnverified(false);

    const { error } = await signIn.email({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    });

    setPending(false);

    if (error) {
      if (error.status === 403) {
        setUnverified(true);
        return;
      }
      setError(
        error.status === 429
          ? 'För många försök. Vänta en minut och prova igen.'
          : 'E-post eller lösenord stämmer inte.',
      );
      return;
    }

    router.push('/oversikt');
    router.refresh();
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
        {error ? <ErrorNote title="Kunde inte logga in" description={error} /> : null}
        {unverified ? (
          <ErrorNote
            title="Adressen är inte bekräftad än"
            description="Vi har skickat ett mejl med en bekräftelselänk. Kolla skräpposten om det inte kommit."
          />
        ) : null}

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

        <Field label="Lösenord" required>
          {(props) => (
            <PasswordInput
              {...props}
              name="password"
              autoComplete="current-password"
              required
            />
          )}
        </Field>

        <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
          Logga in
        </Button>

        <Link
          href="/glomt-losenord"
          className="text-center text-[13px] text-muted underline-offset-2 hover:underline"
        >
          Glömt lösenordet?
        </Link>
      </form>
    </div>
  );
}
