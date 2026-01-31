'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { OnlineMember } from '@termify/shared';
import { cn } from '@/lib/utils';

interface WorkspacePresenceAvatarsProps {
  users: OnlineMember[];
  currentUserId: string;
  maxVisible?: number;
  className?: string;
}

export function WorkspacePresenceAvatars({
  users,
  currentUserId,
  maxVisible = 4,
  className,
}: WorkspacePresenceAvatarsProps) {
  const [showAll, setShowAll] = useState(false);

  // Filter out current user and deduplicate by visitorId
  const otherUsers = users.filter((u) => u.userId !== currentUserId);
  const uniqueUsers = Array.from(
    new Map(otherUsers.map((u) => [u.visitorId, u])).values()
  );

  if (uniqueUsers.length === 0) {
    return null;
  }

  const visibleUsers = uniqueUsers.slice(0, maxVisible);
  const remainingCount = uniqueUsers.length - maxVisible;

  return (
    <>
      <div className={cn('flex items-center -space-x-2', className)}>
        {visibleUsers.map((user, index) => (
          <div
            key={user.visitorId}
            className="relative group"
            style={{ zIndex: visibleUsers.length - index }}
          >
            {/* Avatar */}
            <div
              className={cn(
                'w-8 h-8 rounded-full border-2 border-background overflow-hidden',
                'ring-2 ring-green-500 ring-offset-1 ring-offset-background',
                'transition-transform hover:scale-110 hover:z-50'
              )}
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || user.email}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xs font-medium text-white"
                  style={{
                    backgroundColor: getColorFromString(user.userId),
                  }}
                >
                  {getInitials(user.name || user.email)}
                </div>
              )}
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {user.name || user.email}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
            </div>
          </div>
        ))}

        {/* Remaining count badge */}
        {remainingCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className={cn(
              'w-8 h-8 rounded-full border-2 border-background',
              'bg-muted flex items-center justify-center',
              'text-xs font-medium text-muted-foreground',
              'hover:bg-muted/80 transition-colors'
            )}
          >
            +{remainingCount}
          </button>
        )}
      </div>

      {/* Modal showing all users */}
      {showAll && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAll(false)}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-background border rounded-lg shadow-xl w-full max-w-sm p-4 pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold mb-3">
                {uniqueUsers.length} {uniqueUsers.length === 1 ? 'person' : 'people'} in this workspace
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uniqueUsers.map((user) => (
                  <div
                    key={user.visitorId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full overflow-hidden flex-shrink-0',
                        'ring-2 ring-green-500 ring-offset-1 ring-offset-background'
                      )}
                    >
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || user.email}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-sm font-medium text-white"
                          style={{
                            backgroundColor: getColorFromString(user.userId),
                          }}
                        >
                          {getInitials(user.name || user.email)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {user.name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowAll(false)}
                className="mt-4 w-full py-2 px-4 text-sm font-medium bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// Helper functions
function getInitials(name: string): string {
  const parts = name.split(/[\s@]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getColorFromString(str: string): string {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
