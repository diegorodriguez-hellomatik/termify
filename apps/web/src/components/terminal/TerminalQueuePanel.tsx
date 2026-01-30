'use client';

import { useState, useEffect } from 'react';
import {
  ListTodo,
  Plus,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTerminalQueue } from '@/hooks/useTerminalQueue';
import { QueueTaskCard } from './QueueTaskCard';
import { AddToQueueModal } from './AddToQueueModal';

interface TerminalQueuePanelProps {
  terminalId: string;
  className?: string;
}

type SectionKey = 'running' | 'pending' | 'completed';

export function TerminalQueuePanel({
  terminalId,
  className,
}: TerminalQueuePanelProps) {
  const {
    runningQueue,
    pendingQueues,
    completedQueues,
    loading,
    error,
    fetchQueues,
    createQueue,
    deleteQueue,
    startQueue,
    cancelQueue,
  } = useTerminalQueue({ terminalId });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    running: false,
    pending: false,
    completed: true,
  });
  const [actionLoading, setActionLoading] = useState<Record<string, string>>(
    {}
  );

  const toggleSection = (key: SectionKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreate = async (data: {
    name: string;
    commands: Array<{ command: string; position?: number }>;
  }) => {
    const queue = await createQueue(data.name, data.commands);
    return queue !== null;
  };

  const handleStart = async (queueId: string) => {
    setActionLoading((prev) => ({ ...prev, [queueId]: 'starting' }));
    try {
      await startQueue(queueId);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[queueId];
        return next;
      });
    }
  };

  const handleCancel = async (queueId: string) => {
    setActionLoading((prev) => ({ ...prev, [queueId]: 'cancelling' }));
    try {
      await cancelQueue(queueId);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[queueId];
        return next;
      });
    }
  };

  const handleDelete = async (queueId: string) => {
    await deleteQueue(queueId);
  };

  const totalQueues =
    (runningQueue ? 1 : 0) + pendingQueues.length + completedQueues.length;

  if (loading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-8 px-4',
          className
        )}
      >
        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Loading queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-8 px-4',
          className
        )}
      >
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchQueues}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Task Queue</span>
          {totalQueues > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {totalQueues}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchQueues}
            className="h-7 w-7"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAddModalOpen(true)}
            className="h-7 w-7"
            title="Add to queue"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {totalQueues === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <ListTodo className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium mb-1">No tasks in queue</h3>
            <p className="text-xs text-muted-foreground text-center mb-3">
              Add tasks to execute commands sequentially
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </Button>
          </div>
        ) : (
          <>
            {/* Running */}
            {runningQueue && (
              <div>
                <button
                  onClick={() => toggleSection('running')}
                  className="w-full flex items-center gap-2 px-1 py-1 text-xs font-medium text-yellow-500 hover:bg-muted/50 rounded-md"
                >
                  {collapsed.running ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  RUNNING
                </button>
                {!collapsed.running && (
                  <div className="mt-2">
                    <QueueTaskCard
                      queue={runningQueue}
                      onStart={() => handleStart(runningQueue.id)}
                      onCancel={() => handleCancel(runningQueue.id)}
                      onDelete={() => handleDelete(runningQueue.id)}
                      isStarting={actionLoading[runningQueue.id] === 'starting'}
                      isCancelling={
                        actionLoading[runningQueue.id] === 'cancelling'
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* Pending */}
            {pendingQueues.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('pending')}
                  className="w-full flex items-center gap-2 px-1 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-md"
                >
                  {collapsed.pending ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  PENDING ({pendingQueues.length})
                </button>
                {!collapsed.pending && (
                  <div className="mt-2 space-y-2">
                    {pendingQueues.map((queue) => (
                      <QueueTaskCard
                        key={queue.id}
                        queue={queue}
                        onStart={() => handleStart(queue.id)}
                        onCancel={() => handleCancel(queue.id)}
                        onDelete={() => handleDelete(queue.id)}
                        isStarting={actionLoading[queue.id] === 'starting'}
                        isCancelling={actionLoading[queue.id] === 'cancelling'}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Completed */}
            {completedQueues.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('completed')}
                  className="w-full flex items-center gap-2 px-1 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-md"
                >
                  {collapsed.completed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  COMPLETED ({completedQueues.length})
                </button>
                {!collapsed.completed && (
                  <div className="mt-2 space-y-2">
                    {completedQueues.map((queue) => (
                      <QueueTaskCard
                        key={queue.id}
                        queue={queue}
                        onStart={() => handleStart(queue.id)}
                        onCancel={() => handleCancel(queue.id)}
                        onDelete={() => handleDelete(queue.id)}
                        isStarting={actionLoading[queue.id] === 'starting'}
                        isCancelling={actionLoading[queue.id] === 'cancelling'}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Modal */}
      <AddToQueueModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}
