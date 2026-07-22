import { Skeleton } from '@/components/ui/skeleton';
import PlaylistCardSkeleton from '@/components/states/PlaylistCardSkeleton';

export default function Loading() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <Skeleton className="h-9 w-64 mb-3" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-9 w-52 mb-6" />
      <PlaylistCardSkeleton />
    </div>
  );
}
