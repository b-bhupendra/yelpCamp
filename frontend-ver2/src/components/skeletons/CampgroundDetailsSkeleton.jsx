import React from 'react';

export default function CampgroundDetailsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading campsite details"
      className="min-h-screen bg-background text-fg relative animate-pulse"
    >
      <div className="pt-32 sm:pt-40 pb-24 px-4 sm:px-8 md:px-12 lg:px-16 max-w-7xl mx-auto space-y-10">
        
        {/* Story Bar Skeleton */}
        <div className="glass-obsidian rounded-3xl p-6 border border-border/70 h-28 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-2 shrink-0" />
          <div className="w-16 h-16 rounded-full bg-surface-2 shrink-0" />
          <div className="w-16 h-16 rounded-full bg-surface-2 shrink-0 hidden sm:block" />
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Bento Photo Skeleton & Overview */}
          <div className="lg:col-span-7 space-y-8">
            {/* Bento Gallery Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 sm:grid-rows-2 gap-2.5 h-[340px] sm:h-[420px] rounded-3xl overflow-hidden border border-border/80 bg-surface p-1">
              <div className="col-span-2 row-span-2 rounded-2xl bg-surface-2" />
              <div className="col-span-1 row-span-1 rounded-2xl bg-surface-2" />
              <div className="col-span-1 row-span-1 rounded-2xl bg-surface-2" />
              <div className="col-span-1 row-span-1 rounded-2xl bg-surface-2 hidden sm:block" />
              <div className="col-span-1 row-span-1 rounded-2xl bg-surface-2 hidden sm:block" />
            </div>

            {/* Overview Card */}
            <div className="glass-obsidian rounded-3xl p-8 space-y-6 border border-border/70">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2 w-2/3">
                  <div className="w-28 h-3.5 bg-border rounded-full" />
                  <div className="w-full h-8 bg-border rounded-xl" />
                </div>
                <div className="w-20 h-8 bg-border rounded-xl" />
              </div>

              <div className="h-20 bg-surface-2/60 rounded-2xl" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
                <div className="h-16 bg-surface-2 rounded-2xl" />
                <div className="h-16 bg-surface-2 rounded-2xl" />
                <div className="h-16 bg-surface-2 rounded-2xl" />
                <div className="h-16 bg-surface-2 rounded-2xl" />
              </div>
            </div>
          </div>

          {/* Right Column: Discussion & Booking */}
          <div className="lg:col-span-5 space-y-8">
            <div className="glass-obsidian rounded-3xl p-8 space-y-6 border border-border/70">
              <div className="w-36 h-6 bg-border rounded-xl" />
              <div className="h-28 bg-surface-2/70 rounded-2xl" />
              <div className="space-y-4 pt-4">
                <div className="h-20 bg-surface-2 rounded-2xl" />
                <div className="h-20 bg-surface-2 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
