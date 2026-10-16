import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      className="min-h-screen bg-background text-fg relative animate-pulse pt-36 pb-24 px-4 sm:px-8 max-w-6xl mx-auto space-y-10"
    >
      {/* User Header Profile Skeleton */}
      <div className="glass-obsidian rounded-3xl p-8 border border-border/70 flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-surface-2 shrink-0" />
        <div className="space-y-3 w-full sm:w-1/2 text-center sm:text-left">
          <div className="w-32 h-6 bg-border rounded-xl mx-auto sm:mx-0" />
          <div className="w-48 h-4 bg-border/70 rounded-full mx-auto sm:mx-0" />
        </div>
      </div>

      {/* Metrics Row (3 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="h-28 rounded-2xl bg-surface/70 border border-border p-6" />
        <div className="h-28 rounded-2xl bg-surface/70 border border-border p-6" />
        <div className="h-28 rounded-2xl bg-surface/70 border border-border p-6" />
      </div>

      {/* Tabs & Items Skeleton */}
      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="w-28 h-10 rounded-full bg-surface-2" />
          <div className="w-28 h-10 rounded-full bg-surface-2" />
          <div className="w-28 h-10 rounded-full bg-surface-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-64 rounded-3xl bg-surface/60 border border-border" />
          <div className="h-64 rounded-3xl bg-surface/60 border border-border" />
          <div className="h-64 rounded-3xl bg-surface/60 border border-border" />
        </div>
      </div>
    </div>
  );
}
