import { MailCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';

export const metadata: Metadata = { title: 'Bekräfta din e-post', robots: { index: false } };

/**
 * Where the verification link lands when it fails.
 *
 * A successful confirmation is handled by better-auth and redirects straight
 * into the app, so anyone who ends up looking at this page needs a way forward
 * rather than an explanation of what went right.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard
      title={error ? 'Länken fungerade inte' : 'Bekräfta din e-postadress'}
      description={
        error
          ? 'Länken har gått ut eller är redan använd. Logga in så skickar vi en ny.'
          : 'Öppna länken vi skickade till din e-post. Den gäller i ett dygn.'
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <Link href="/logga-in" className="text-sm text-brand-text hover:underline">
          Till inloggningen
        </Link>
      </div>
    </AuthCard>
  );
}
