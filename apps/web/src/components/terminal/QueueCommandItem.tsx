'use client';

import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalQueueCommand, CommandStatus } from '@/lib/api';

interface QueueCommandItemProps {
  command: TerminalQueueCommand;
  position: number;
}

const STATUS_CONFIG: Record<
  CommandStatus,
  {
    icon: React.FC<{ className?: string }>;
    color: string;
    label: string;
  }
> = {
  PENDING: {
    icon: Circle,
    color: 'text-muted-foreground',
    label: 'Pending',
  },
  RUNNING: {
    icon: Loader2,
    color: 'text-yellow-500',
    label: 'Running',
  },
  COMPLETED: {
    icon: CheckCircle2,
    color: 'text-green-500',
    label: 'Completed',
  },
  FAILED: {
    icon: XCircle,
    color: 'text-red-500',
    label: 'Failed',
  },
  SKIPPED: {
    icon: SkipForward,
    color: 'text-muted-foreground',
    label: 'Skipped',
  },
};

export function QueueCommandItem({ command, position }: QueueCommandItemProps) {
  const config = STATUS_CONFIG[command.status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 rounded-md transition-colors',
        command.status === 'RUNNING' && 'bg-yellow-500/10',
        command.status === 'FAILED' && 'bg-red-500/10',
        command.status === 'COMPLETED' && 'opacity-60'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 mt-0.5 flex-shrink-0',
          config.color,
          command.status === 'RUNNING' && 'animate-spin'
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] text-muted-foreground font-mono">
            #{position + 1}
          </span>
          <span
            className={cn(
              'text-[10px] uppercase font-medium',
              config.color
            )}
          >
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Terminal className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <code className="text-xs font-mono text-foreground/90 break-all">
            {command.command}
          </code>
        </div>
        {command.exitCode !== null && command.exitCode !== undefined && (
          <div className="mt-1">
            <span
              className={cn(
                'text-[10px] font-mono',
                command.exitCode === 0
                  ? 'text-green-500'
                  : 'text-red-500'
              )}
            >
              Exit code: {command.exitCode}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
