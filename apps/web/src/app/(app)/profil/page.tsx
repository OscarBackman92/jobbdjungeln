import { schema } from '@jobbdjungeln/db';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { AccountSettings } from '@/components/profile/account-settings';
import { ResumeEditor } from '@/components/profile/resume-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Profil' };

export default async function ProfilePage() {
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

      <Tabs defaultValue="cv">
        <TabsList className="mb-4">
          <TabsTrigger value="cv">CV</TabsTrigger>
          <TabsTrigger value="konto">Konto och data</TabsTrigger>
        </TabsList>

        <TabsContent value="cv">
          <ResumeEditor
            initial={{
              headline: resume?.headline ?? '',
              summary: resume?.summary ?? '',
              skills: resume?.skills ?? [],
              experience: resume?.experience ?? [],
              education: resume?.education ?? [],
            }}
          />
        </TabsContent>

        <TabsContent value="konto">
          <AccountSettings
            email={user.email}
            operatorId={user.operatorId}
            name={user.name}
            weeklySummaryOptIn={user.weeklySummaryOptIn}
            reminderOptIn={user.reminderOptIn}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
