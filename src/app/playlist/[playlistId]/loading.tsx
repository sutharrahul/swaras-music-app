import LoadingSkeleton from '@/components/LoadingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <Skeleton className="h-9 w-40 mb-4" />
        <Skeleton className="h-10 w-72 mb-3" />
        <Skeleton className="h-4 w-24" />
      </div>
      <LoadingSkeleton rows={5} />
    </div>
  );
}
