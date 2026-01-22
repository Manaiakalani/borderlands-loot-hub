import { memo, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Skeleton loading card that mimics the CodeCard layout
 */
export const SkeletonCard = memo(function SkeletonCard({ className, style }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border border-border/50 bg-card animate-pulse",
        className
      )}
      style={style}
    >
      {/* Top row: Game & Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-12 rounded skeleton" />
          <div className="h-4 w-20 rounded skeleton" />
        </div>
        <div className="h-5 w-16 rounded skeleton" />
      </div>

      {/* Code */}
      <div className="mb-3">
        <div className="h-7 w-full rounded skeleton" />
      </div>

      {/* Reward */}
      <div className="h-4 w-3/4 rounded skeleton mb-4" />

      {/* Bottom Row */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="space-y-1.5">
          <div className="h-3 w-24 rounded skeleton" />
          <div className="h-3 w-32 rounded skeleton" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-16 rounded skeleton" />
          <div className="h-8 w-16 rounded skeleton" />
        </div>
      </div>
    </div>
  );
});

interface SkeletonGridProps {
  count?: number;
}

/**
 * Grid of skeleton cards for loading state
 */
export const SkeletonGrid = memo(function SkeletonGrid({ count = 6 }: SkeletonGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` } as React.CSSProperties} />
      ))}
    </div>
  );
});
