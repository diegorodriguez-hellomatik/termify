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
          'flex items-center justify-between',
          'h-16 px-4',
          'bg-card border-b border-border',
          'active:bg-muted transition-colors',
          'touch-manipulation'
        )}
      >
        {/* Left side: Status dot + Name */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full flex-shrink-0',
              STATUS_COLORS[terminal.status]
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">{terminal.name}</p>
            <p className={cn('text-xs', STATUS_TEXT_COLORS[terminal.status])}>
              {statusLabel}
              {terminal.category && (
                <span className="text-muted-foreground">
                  {' '}&bull; {terminal.category.name}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right side: Time ago */}
        <div className="flex-shrink-0 ml-3">
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
      </div>
    </Link>
  );
}
