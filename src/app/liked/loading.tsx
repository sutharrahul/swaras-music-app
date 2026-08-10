import { Skeleton } from '@/components/ui/skeleton';
import LoadingSkeleton from '@/components/LoadingSkeleton';

export default function Loading() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <Skeleton className="h-9 w-64 mb-3" />
        <Skeleton className="h-4 w-80" />
      </div>
      <LoadingSkeleton />
    </div>
  );
}
