import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { NewPasswordForm } from '@/components/auth/password-reset-forms';
import { Skeleton } from '@/components/ui';

export const metadata: Metadata = { title: 'Nytt lösenord' };

export default function NewPasswordPage() {
  return (
    <AuthCard title="Välj ett nytt lösenord">
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <NewPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
