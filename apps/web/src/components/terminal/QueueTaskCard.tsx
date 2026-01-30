'use client';

import { useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TerminalTaskQueue, QueueStatus } from '@/lib/api';
import { QueueCommandItem } from './QueueCommandItem';
import { formatDistanceToNow } from 'date-fns';

interface QueueTaskCardProps {
  queue: TerminalTaskQueue;
  onStart: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isStarting?: boolean;
  isCancelling?: boolean;
}

const STATUS_CONFIG: Record<
  QueueStatus,
  {
    icon: React.FC<{ className?: string }>;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  PENDING: {
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Pending',
  },
  RUNNING: {
    icon: Loader2,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'Running',
  },
  COMPLETED: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Completed',
  },
  FAILED: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Failed',
  },
  CANCELLED: {
    icon: Ban,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Cancelled',
  },
};

export function QueueTaskCard({
  queue,
  onStart,
  onCancel,
  onDelete,
  isStarting,
  isCancelling,
}: QueueTaskCardProps) {
  const [expanded, setExpanded] = useState(queue.status === 'RUNNING');
  const config = STATUS_CONFIG[queue.status];
  const Icon = config.icon;

  const completedCommands = queue.commands.filter(
    (c) => c.status === 'COMPLETED'
  ).length;
  const totalCommands = queue.commands.length;

  const canStart = queue.status === 'PENDING';
  const canCancel = queue.status === 'RUNNING';
  const canDelete = queue.status !== 'RUNNING';

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-colors',
        config.bgColor
      )}
    >
      {/* Header */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-start gap-2 flex-1 text-left"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium line-clamp-1">{queue.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Icon
                  className={cn(
                    'h-3 w-3',
                    config.color,
                    queue.status === 'RUNNING' && 'animate-spin'
                  )}
                />
                <span className={cn('text-xs', config.color)}>
                  {config.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {completedCommands}/{totalCommands} commands
                </span>
              </div>
            </div>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {canStart && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onStart}
                disabled={isStarting}
                className="h-7 w-7"
                title="Start queue"
              >
                {isStarting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                disabled={isCancelling}
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Cancel queue"
              >
                {isCancelling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Delete queue"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar for running queues */}
        {queue.status === 'RUNNING' && (
          <div className="mt-2">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all duration-300"
                style={{
                  width: `${(completedCommands / totalCommands) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>
            Created {formatDistanceToNow(new Date(queue.createdAt), { addSuffix: true })}
          </span>
          {queue.completedAt && (
            <span>
              Finished {formatDistanceToNow(new Date(queue.completedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Commands list */}
      {expanded && (
        <div className="border-t border-border bg-background/50">
          <div className="divide-y divide-border">
            {queue.commands.map((command, index) => (
              <QueueCommandItem
                key={command.id}
                command={command}
                position={index}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
