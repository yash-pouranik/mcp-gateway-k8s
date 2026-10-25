import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-zinc-850/80 rounded ${className}`} />
);

/** Full Page Initializing Skeleton */
export const AppSkeleton: React.FC = () => (
  <div className="min-h-screen bg-black flex flex-col text-zinc-100">
    {/* Navbar Skeleton */}
    <header className="border-b border-zinc-850 bg-black/90 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-850 animate-pulse" />
            <div className="h-4 w-24 bg-zinc-850 rounded animate-pulse" />
          </div>
          <div className="hidden md:flex items-center space-x-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-7 w-20 bg-zinc-900 rounded-md animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="h-7 w-32 bg-zinc-900 rounded-md animate-pulse" />
          <div className="h-7 w-7 rounded-full bg-zinc-850 animate-pulse" />
        </div>
      </div>
    </header>

    {/* Main Content Area Skeleton */}
    <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-850">
        <div className="space-y-2">
          <div className="h-5 w-44 bg-zinc-850 rounded animate-pulse" />
          <div className="h-3.5 w-72 bg-zinc-900 rounded animate-pulse" />
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-8 w-20 bg-zinc-900 rounded-md animate-pulse" />
          <div className="h-8 w-28 bg-zinc-850 rounded-md animate-pulse" />
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-4 animate-pulse"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-zinc-850 rounded" />
                <div className="h-3 w-16 bg-zinc-900 rounded" />
              </div>
              <div className="h-3 w-12 bg-zinc-900 rounded-full" />
            </div>
            <div className="h-8 bg-zinc-900 rounded border border-zinc-850" />
            <div className="flex items-center justify-between pt-2 border-t border-zinc-850">
              <div className="h-3 w-16 bg-zinc-900 rounded" />
              <div className="h-6 w-20 bg-zinc-850 rounded" />
            </div>
          </div>
        ))}
      </div>
    </main>
  </div>
);

/** Servers View Grid Skeleton */
export const ServersGridSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 sm:p-4 flex flex-col justify-between space-y-3 sm:space-y-4 animate-pulse"
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-zinc-850 rounded" />
              <div className="h-3 w-20 bg-zinc-900 rounded" />
            </div>
            <div className="h-3.5 w-16 bg-zinc-900 rounded-full" />
          </div>

          {/* Endpoint box */}
          <div className="p-2 rounded bg-zinc-900/60 border border-zinc-850 flex items-center justify-between">
            <div className="h-3 w-3/4 bg-zinc-850 rounded" />
            <div className="h-4 w-4 bg-zinc-800 rounded" />
          </div>

          {/* Tools count & auth badge */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="h-3 w-24 bg-zinc-900 rounded" />
            <div className="h-4 w-14 bg-zinc-900 rounded" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="pt-3 border-t border-zinc-850 flex items-center justify-between">
          <div className="h-6 w-12 bg-zinc-850 rounded-full" />
          <div className="flex items-center space-x-1.5">
            <div className="h-6 w-16 bg-zinc-900 rounded" />
            <div className="h-6 w-12 bg-zinc-900 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/** Tools List inside Inspect Modal Skeleton */
export const ToolsListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="space-y-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="p-3 bg-zinc-900/50 border border-zinc-850 rounded space-y-2 animate-pulse"
      >
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 bg-zinc-850 rounded" />
          <div className="h-3 w-24 bg-zinc-900 rounded" />
        </div>
        <div className="h-3 w-full bg-zinc-850/60 rounded" />
        <div className="h-3 w-2/3 bg-zinc-900 rounded" />
      </div>
    ))}
  </div>
);

/** Table Rows Skeleton for Desktop Tables */
export const TableRowsSkeleton: React.FC<{ cols?: number; rows?: number }> = ({
  cols = 5,
  rows = 5,
}) => (
  <>
    {Array.from({ length: rows }).map((_, rIdx) => (
      <tr key={rIdx} className="border-b border-zinc-850 animate-pulse">
        {Array.from({ length: cols }).map((_, cIdx) => (
          <td key={cIdx} className="px-4 py-3.5">
            <div
              className="h-3.5 bg-zinc-850 rounded"
              style={{
                width: cIdx === 0 ? '70%' : cIdx === cols - 1 ? '40%' : `${50 + ((rIdx + cIdx) % 4) * 12}%`,
              }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/** Mobile Cards Skeleton */
export const MobileCardsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="divide-y divide-zinc-850">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-3.5 space-y-2.5 animate-pulse bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-32 bg-zinc-850 rounded" />
          <div className="h-4 w-16 bg-zinc-900 rounded-full" />
        </div>
        <div className="h-3 w-48 bg-zinc-900 rounded" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-3 w-20 bg-zinc-900 rounded" />
          <div className="h-3 w-24 bg-zinc-900 rounded" />
        </div>
      </div>
    ))}
  </div>
);

/** OAuth Clients List Skeleton */
export const OAuthClientsSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3 animate-pulse"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-36 bg-zinc-850 rounded" />
              <div className="h-3.5 w-14 bg-zinc-900 rounded-full" />
            </div>
            <div className="h-3 w-48 bg-zinc-900 rounded" />
          </div>
          <div className="h-6 w-14 bg-zinc-900 rounded" />
        </div>
        <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-850 flex items-center justify-between">
          <div className="h-3 w-2/3 bg-zinc-850 rounded" />
          <div className="h-4 w-4 bg-zinc-850 rounded" />
        </div>
        <div className="flex items-center space-x-2 pt-1">
          <div className="h-4 w-16 bg-zinc-900 rounded" />
          <div className="h-4 w-16 bg-zinc-900 rounded" />
          <div className="h-4 w-20 bg-zinc-900 rounded" />
        </div>
      </div>
    ))}
  </div>
);

/** Members Team Roster Skeleton */
export const MembersGridSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="p-3 sm:p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3 animate-pulse"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded bg-zinc-850" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 bg-zinc-850 rounded" />
              <div className="h-3 w-32 bg-zinc-900 rounded" />
            </div>
          </div>
          <div className="h-4 w-14 bg-zinc-900 rounded-full" />
        </div>
        <div className="pt-2 border-t border-zinc-850 flex items-center justify-between">
          <div className="h-3 w-20 bg-zinc-900 rounded" />
          <div className="h-5 w-14 bg-zinc-900 rounded" />
        </div>
      </div>
    ))}
  </div>
);

/** Chat Session Sidebar Skeleton */
export const ChatSessionsSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-1.5 px-2">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="p-2.5 rounded-xl bg-[#242424]/60 border border-[#353535]/50 flex items-center justify-between animate-pulse"
      >
        <div className="flex items-center space-x-2 w-full">
          <div className="w-3.5 h-3.5 rounded bg-zinc-700/60 shrink-0" />
          <div
            className="h-3 bg-zinc-700/60 rounded"
            style={{ width: `${60 + (i % 3) * 15}%` }}
          />
        </div>
      </div>
    ))}
  </div>
);
