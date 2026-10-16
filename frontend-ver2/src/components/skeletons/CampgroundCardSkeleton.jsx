import React from 'react';

export function CampgroundCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bento-card p-0 overflow-hidden relative h-full rounded-3xl border border-border/80 bg-surface/60 backdrop-blur-md animate-pulse"
    >
      <div className="relative aspect-[4/5] bg-surface-2/70 overflow-hidden">
        {/* Subtle shimmer gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]" />
        
        {/* Bottom card content skeleton */}
        <div className="absolute bottom-5 left-5 right-5 space-y-3">
          <div className="flex justify-between items-end gap-4">
            <div className="flex-1 space-y-2">
              <div className="w-16 h-3.5 bg-border/80 rounded-full" />
              <div className="w-3/4 h-6 bg-border rounded-xl" />
            </div>
            <div className="w-12 h-6 bg-border rounded-xl" />
          </div>
        </div>
      </div>

      {/* Bottom stats bar skeleton */}
      <div className="px-5 py-3.5 flex justify-between items-center bg-surface-2/60 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-3.5 bg-border rounded-full" />
          <div className="w-8 h-3.5 bg-border rounded-full" />
        </div>
        <div className="w-20 h-3.5 bg-border rounded-full" />
      </div>
    </div>
  );
}

export function CampgroundGridSkeleton({ count = 8 }) {
  return (
    <div
      role="status"
      aria-label="Loading campsites"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 md:gap-8"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CampgroundCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default CampgroundGridSkeleton;
