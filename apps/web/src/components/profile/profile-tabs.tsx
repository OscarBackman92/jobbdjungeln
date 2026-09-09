'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

const TAB_VALUES = ['cv', 'konto'] as const;
type TabValue = (typeof TAB_VALUES)[number];

function parseTab(value: string | null): TabValue {
  return value === 'konto' ? 'konto' : 'cv';
}

/**
 * Profile tabs synced to `?flik=cv|konto` so deep links and back/forward work.
 */
export function ProfileTabs({
  cv,
  account,
}: {
  cv: ReactNode;
  account: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('flik'));

  function setTab(next: string) {
    const value = parseTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'cv') params.delete('flik');
    else params.set('flik', value);
    const query = params.toString();
    router.replace(query ? `/profil?${query}` : '/profil', { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="cv">CV</TabsTrigger>
        <TabsTrigger value="konto">Konto och data</TabsTrigger>
      </TabsList>

      <TabsContent value="cv">{cv}</TabsContent>
      <TabsContent value="konto">{account}</TabsContent>
    </Tabs>
  );
}
