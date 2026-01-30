'use client';

import { Loader2, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/hooks/useTasks';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { TaskBoard } from './TaskBoard';
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
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ListTodo className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No tasks yet</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Create tasks to track your team&apos;s work and collaborate effectively.
        </p>
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
