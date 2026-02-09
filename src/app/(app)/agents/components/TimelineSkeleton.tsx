import { Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// AIDEV-NOTE: Skeleton loading state for timeline
// Shows timeline structure while tasks are loading

export function TimelineSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 px-4 pt-4 border-b pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Timeline</h3>
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>

        {/* View Mode Selector skeleton */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {['Hour', '6 Hours', '12 Hours', 'Day', 'Week', 'Month', '3 Months', 'Year'].map((mode) => (
            <Skeleton key={mode} className="h-7 w-16" />
          ))}
        </div>
      </div>

      {/* Timeline content skeleton */}
      <div className="flex-1 overflow-auto">
        <div className="relative h-full pb-8" style={{ minHeight: 400 }}>
          {/* Time axis skeleton */}
          <div className="sticky top-0 z-30 bg-card border-b border-border h-8 flex items-center">
            <div className="w-[160px] flex-shrink-0" />
            <div className="flex-1 relative flex justify-between px-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-12" />
              ))}
            </div>
          </div>

          {/* Swim lanes skeleton */}
          <div className="relative mt-8 px-4">
            {/* Lane 1 */}
            <div className="relative border-b border-border/30 py-4" style={{ height: 80 }}>
              <Skeleton className="h-4 w-24 mb-2" />
              <div className="ml-[160px] flex gap-2">
                <Skeleton className="h-6 w-32 rounded-md" />
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-6 w-40 rounded-md" />
              </div>
            </div>

            {/* Lane 2 */}
            <div className="relative border-b border-border/30 py-4" style={{ height: 80 }}>
              <Skeleton className="h-4 w-32 mb-2" />
              <div className="ml-[160px] flex gap-2">
                <Skeleton className="h-6 w-28 rounded-md" />
                <Skeleton className="h-6 w-36 rounded-md" />
              </div>
            </div>

            {/* Lane 3 */}
            <div className="relative border-b border-border/30 py-4" style={{ height: 80 }}>
              <Skeleton className="h-4 w-28 mb-2" />
              <div className="ml-[160px] flex gap-2">
                <Skeleton className="h-6 w-48 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar skeleton */}
      <div className="sticky bottom-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="h-3 w-3 rounded-sm" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
