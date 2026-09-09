import { Skeleton } from '@/components/ui';

/** Content skeleton inside the signed-in shell (sidebar/header stay mounted). */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="mb-1 flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
