import { Skeleton } from '@/components/ui';

/** Rapport content skeleton — shell (nav/header) stays from the app layout. */
export default function RapportLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="mb-1 flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="ml-auto h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
