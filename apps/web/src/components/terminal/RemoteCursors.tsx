'use client';

import { useMemo } from 'react';

export interface CursorPosition {
  userId: string;
  userName?: string;
  userImage?: string | null;
  row: number;
  col: number;
}

interface RemoteCursorsProps {
  cursors: CursorPosition[];
  currentUserId: string;
  cellWidth: number;
  cellHeight: number;
}

const CURSOR_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

function getCursorColor(userId: string): string {
  // Generate a consistent color based on user ID
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export function RemoteCursors({
  cursors,
  currentUserId,
  cellWidth,
  cellHeight,
}: RemoteCursorsProps) {
  // Filter out current user and dedupe by user
  const remoteCursors = useMemo(() => {
    const seen = new Set<string>();
    return cursors
      .filter((cursor) => cursor.userId !== currentUserId)
      .filter((cursor) => {
        if (seen.has(cursor.userId)) return false;
        seen.add(cursor.userId);
        return true;
      });
  }, [cursors, currentUserId]);

  if (remoteCursors.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {remoteCursors.map((cursor) => {
        const color = getCursorColor(cursor.userId);
        const x = cursor.col * cellWidth;
        const y = cursor.row * cellHeight;

        return (
          <div
            key={cursor.userId}
            className="absolute transition-all duration-75"
            style={{
              transform: `translate(${x}px, ${y}px)`,
            }}
          >
            {/* Cursor line */}
            <div
              className="absolute w-0.5 animate-pulse"
              style={{
                height: cellHeight,
                backgroundColor: color,
              }}
            />
            {/* User label */}
            <div
              className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {cursor.userName || 'User'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CursorIndicatorProps {
  color: string;
  name: string;
}

export function CursorIndicator({ color, name }: CursorIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

interface ActiveCollaboratorsProps {
  cursors: CursorPosition[];
  currentUserId: string;
}

export function ActiveCollaborators({
  cursors,
  currentUserId,
}: ActiveCollaboratorsProps) {
  const collaborators = useMemo(() => {
    const seen = new Map<string, CursorPosition>();
    cursors
      .filter((c) => c.userId !== currentUserId)
      .forEach((c) => {
        if (!seen.has(c.userId)) {
          seen.set(c.userId, c);
        }
      });
    return Array.from(seen.values());
  }, [cursors, currentUserId]);

  if (collaborators.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-2 py-1 bg-muted/50 rounded-md">
      <span className="text-xs text-muted-foreground">
        {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        {collaborators.slice(0, 5).map((c) => (
          <CursorIndicator
            key={c.userId}
            color={getCursorColor(c.userId)}
            name={c.userName || 'User'}
          />
        ))}
        {collaborators.length > 5 && (
          <span className="text-xs text-muted-foreground">
            +{collaborators.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}

export { getCursorColor };
