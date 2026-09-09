import { schema } from '@jobbdjungeln/db';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { AccountSettings } from '@/components/profile/account-settings';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { ResumeEditor } from '@/components/profile/resume-editor';
import { Skeleton } from '@/components/ui';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Profil' };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ flik?: string }>;
}) {
  // Awaited so the URL is part of the RSC payload; the client tabs re-read it.
  await searchParams;
  const user = await requireUser();
  const resume = await db().query.resumes.findFirst({
    where: eq(schema.resumes.userId, user.id),
  });

  return (
    <>
      <PageHeader
        title="Profil"
        description="Ditt CV styr hur väl annonserna matchar. Här finns också dina inställningar och din data."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ProfileTabs
          cv={
            <ResumeEditor
              initial={{
                headline: resume?.headline ?? '',
                summary: resume?.summary ?? '',
                skills: resume?.skills ?? [],
                experience: resume?.experience ?? [],
                education: resume?.education ?? [],
              }}
            />
          }
          account={
            <AccountSettings
              email={user.email}
              operatorId={user.operatorId}
              name={user.name}
              weeklySummaryOptIn={user.weeklySummaryOptIn}
              reminderOptIn={user.reminderOptIn}
            />
          }
        />
      </Suspense>
    </>
  );
}
