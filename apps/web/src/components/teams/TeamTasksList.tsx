'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ListTodo, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/hooks/useTasks';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { TaskBoard } from './TaskBoard';
import { TaskCreateModal } from './TaskCreateModal';
import { Team, TeamMember } from '@/lib/api';

interface TeamTasksListProps {
  teamId: string;
  teamMembers: TeamMember[];
  canManage: boolean;
}

export function TeamTasksList({
  teamId,
  teamMembers,
  canManage,
}: TeamTasksListProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"], [data-no-context-menu]')) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    assignTask,
    unassignTask,
    reorderTasks,
    tasksByStatus,
  } = useTasks(teamId);

  const {
    statuses,
    isLoading: statusesLoading,
    error: statusesError,
    refetch: refetchStatuses,
  } = useTaskStatuses({ teamId });

  const loading = tasksLoading || statusesLoading;
  const error = tasksError || statusesError;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => { fetchTasks(); refetchStatuses(); }} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (tasks.length === 0 && statuses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 min-h-[300px]" onContextMenu={handleContextMenu}>
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ListTodo className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No tasks yet</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Create tasks to track your team&apos;s work and collaborate effectively.
        </p>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus size={16} />
          Create Task
        </Button>
        <TaskCreateModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onCreate={async (data) => {
            const result = await createTask({ ...data, status: 'todo' });
            if (result) setCreateModalOpen(false);
            return result;
          }}
          teamMembers={teamMembers}
        />
        {contextMenu && typeof document !== 'undefined' && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
            <div
              className="fixed z-[9999] min-w-[160px] py-1 rounded-lg shadow-xl border border-border bg-popover overflow-hidden animate-in fade-in zoom-in-95 duration-100"
              style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 100) }}
            >
              <button
                onClick={() => { setCreateModalOpen(true); setContextMenu(null); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              >
                <Plus size={16} className="text-primary" />
                <span>New Task</span>
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  }

  return (
    <TaskBoard
      tasksByStatus={tasksByStatus()}
      statuses={statuses}
      teamId={teamId}
      teamMembers={teamMembers}
      canManageStatuses={canManage}
      onCreateTask={createTask}
      onUpdateTask={updateTask}
      onDeleteTask={deleteTask}
      onAssignTask={assignTask}
      onUnassignTask={unassignTask}
      onReorderTasks={reorderTasks}
      onStatusesChange={refetchStatuses}
    />
  );
}
