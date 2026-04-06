import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import DriversLiveContent from './DriversLiveContent';

export default function DriversLivePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-3.5rem)] min-h-[560px] items-center justify-center p-4">
          <Skeleton className="h-full w-full max-w-6xl rounded-xl" />
        </div>
      }
    >
      <DriversLiveContent />
    </Suspense>
  );
}
