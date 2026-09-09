import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/password-reset-forms';

export const metadata: Metadata = { title: 'Glömt lösenordet' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Glömt lösenordet"
      description="Skriv din e-postadress så skickar vi en länk för att välja ett nytt."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
