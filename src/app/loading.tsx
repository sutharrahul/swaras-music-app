import LoadingSkeleton from '@/components/LoadingSkeleton';

export default function Loading() {
  return (
    <div className="flex flex-col justify-between items-center h-full py-8 px-4">
      <div className="w-full h-full">
        <LoadingSkeleton />
      </div>
    </div>
  );
}
