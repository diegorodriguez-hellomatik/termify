'use client';

import Link from 'next/link';
import { TerminalStatus } from '@termify/shared';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';

interface TerminalData {
  id: string;
  name: string;
  status: TerminalStatus;
  lastActiveAt: string | null;
  createdAt: string;
  category?: { id: string; name: string; color: string } | null;
}

interface MobileTerminalCardProps {
  terminal: TerminalData;
}

const STATUS_COLORS: Record<TerminalStatus, string> = {
  [TerminalStatus.RUNNING]: 'bg-green-500',
  [TerminalStatus.CRASHED]: 'bg-red-500',
  [TerminalStatus.STARTING]: 'bg-yellow-500',
  [TerminalStatus.STOPPED]: 'bg-zinc-400',
};

const STATUS_TEXT_COLORS: Record<TerminalStatus, string> = {
  [TerminalStatus.RUNNING]: 'text-green-500',
  [TerminalStatus.CRASHED]: 'text-red-500',
  [TerminalStatus.STARTING]: 'text-yellow-500',
  [TerminalStatus.STOPPED]: 'text-zinc-400',
};

export function MobileTerminalCard({ terminal }: MobileTerminalCardProps) {
  const timeAgo = terminal.lastActiveAt
    ? formatRelativeTime(terminal.lastActiveAt)
    : formatRelativeTime(terminal.createdAt);

  const statusLabel = terminal.status.charAt(0) + terminal.status.slice(1).toLowerCase();

  return (
    <Link href={`/terminals/${terminal.id}`}>
      <div
        className={cn(
          'flex items-center gap-3',
          'py-3 px-4',
          'bg-card',
          'active:bg-muted transition-colors',
          'touch-manipulation'
        )}
      >
        {/* Status indicator */}
        <div
          className={cn(
            'w-2.5 h-2.5 rounded-full flex-shrink-0',
            STATUS_COLORS[terminal.status],
            terminal.status === TerminalStatus.RUNNING && 'animate-pulse'
          )}
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-foreground truncate">{terminal.name}</p>
            <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-xs font-medium', STATUS_TEXT_COLORS[terminal.status])}>
              {statusLabel}
            </span>
            {terminal.category && (
              <>
                <span className="text-muted-foreground text-xs">&bull;</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${terminal.category.color}20`,
                    color: terminal.category.color,
                  }}
                >
                  {terminal.category.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg
          className="w-4 h-4 text-muted-foreground flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
