import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { SignInForm } from '@/components/auth/sign-in-form';
import { googleEnabled } from '@/lib/env';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Logga in' };

export default async function SignInPage() {
  if (await currentUser()) redirect('/oversikt');

  return (
    <AuthCard
      title="Logga in"
      description="Fortsätt där du slutade."
      footer={
        <>
          Har du inget konto?{' '}
          <Link href="/skapa-konto" className="text-brand-text hover:underline">
            Skapa ett
          </Link>
        </>
      }
    >
      <SignInForm googleEnabled={googleEnabled()} />
    </AuthCard>
  );
}
