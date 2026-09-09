import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { googleEnabled } from '@/lib/env';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Skapa konto' };

export default async function SignUpPage() {
  if (await currentUser()) redirect('/oversikt');

  return (
    <AuthCard
      title="Skapa konto"
      description="Gratis, ingen betalning, inga tredjepartscookies."
      footer={
        <>
          Har du redan ett konto?{' '}
          <Link href="/logga-in" className="text-brand-text hover:underline">
            Logga in
          </Link>
        </>
      }
    >
      <SignUpForm googleEnabled={googleEnabled()} />
    </AuthCard>
  );
}
