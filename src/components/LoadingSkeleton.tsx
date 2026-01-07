import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="space-y-1 animate-pulse space-x-4 mx-auto">
      <div className="flex items-center gap-5 py-3 px-2">
        <div className="size-12 rounded bg-gray-200"></div>

        <div className="flex-1 grid grid-cols-3 gap-4">
          <div className="h-2 w-56 rounded  bg-gray-200"></div>
          <div className="h-2 w-28 rounded  bg-gray-200"></div>
          <div className="h-2 w-16 rounded  bg-gray-200"></div>
        </div>

        <div className="h-2 w-8 rounded  bg-gray-200"></div>
      </div>
    </div>
  );
}
