import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/password-reset-forms';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Glömt lösenordet' };

export default async function ForgotPasswordPage() {
  if (await currentUser()) redirect('/oversikt');

  return (
    <AuthCard
      title="Glömt lösenordet"
      description="Skriv din e-postadress så skickar vi en länk för att välja ett nytt."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
