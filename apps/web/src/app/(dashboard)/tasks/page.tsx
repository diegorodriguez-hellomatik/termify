'use client';

import { Plus, CheckSquare } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { PageLayout, PageHeader, PageContent } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { PersonalTaskBoard as TaskBoardComponent } from '@/components/tasks/PersonalTaskBoard';
import { PersonalTaskCreateModal } from '@/components/tasks/PersonalTaskCreateModal';
import { WorkspaceTabs } from '@/components/tasks/WorkspaceTabs';
import { usePersonalTasks } from '@/hooks/usePersonalTasks';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { TaskPriority } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function TasksPage() {
  // null = all tasks, 'independent' = tasks without workspace, string = specific workspace
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const prevWorkspaceRef = useRef<string | null>(null);

  const { workspaces, loadingWorkspaces } = useWorkspace();

  // Handle workspace change with transition
  const handleWorkspaceChange = (workspaceId: string | null) => {
    if (workspaceId === selectedWorkspaceId) return;

    setIsTransitioning(true);

    // Small delay to allow fade out
    setTimeout(() => {
      setSelectedWorkspaceId(workspaceId);
      prevWorkspaceRef.current = workspaceId;
    }, 150);
  };

  // Reset transition state when tasks load
  useEffect(() => {
    if (!isTransitioning) return;

    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedWorkspaceId]);

  // Convert selectedWorkspaceId for the hook:
  // null -> undefined (all tasks)
  // 'independent' -> null (tasks without workspace)
  // string -> string (specific workspace)
  const workspaceIdForHook = selectedWorkspaceId === null
    ? undefined
    : selectedWorkspaceId === 'independent'
      ? null
      : selectedWorkspaceId;

  const {
    loading: tasksLoading,
    tasksByStatus,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    fetchTasks,
  } = usePersonalTasks({ workspaceId: workspaceIdForHook });

  const {
    statuses,
    isLoading: statusesLoading,
    refetch: refetchStatuses,
  } = useTaskStatuses();

  const loading = loadingWorkspaces || tasksLoading || statusesLoading;

  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string | null;
    workspaceId?: string | null;
    commands?: string[] | null;
  }) => {
    // If creating from a specific workspace tab, use that workspace
    const finalWorkspaceId = data.workspaceId !== undefined
      ? data.workspaceId
      : selectedWorkspaceId === 'independent'
        ? null
        : selectedWorkspaceId;

    return createTask({
      ...data,
      status: 'TODO',
      workspaceId: finalWorkspaceId,
    });
  };

  const totalTasks = Object.values(tasksByStatus()).flat().length;

  if (loading) {
    return (
      <PageLayout>
        <PageHeader
          title="My Tasks"
          description="Manage your personal tasks"
        />
        <PageContent>
          <div className="flex items-center justify-center py-16">
            <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="My Tasks"
        description="Manage your personal tasks"
        actions={
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            New Task
          </Button>
        }
      />
      <PageContent>
        {/* Workspace Tabs */}
        <WorkspaceTabs
          workspaces={workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          onSelectWorkspace={handleWorkspaceChange}
        />

        {/* Content with transition */}
        <div
          className={cn(
            'transition-all duration-200 ease-out',
            isTransitioning
              ? 'opacity-0 translate-y-2'
              : 'opacity-100 translate-y-0'
          )}
        >
          {totalTasks === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CheckSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No tasks yet</h3>
              <p className="text-sm text-muted-foreground text-center">
                {selectedWorkspaceId === 'independent'
                  ? 'Create an independent task to get started.'
                  : selectedWorkspaceId
                    ? 'Create a task in this workspace to get started.'
                    : 'Create a task to get started organizing your work.'}
              </p>
            </div>
          ) : (
            <TaskBoardComponent
              tasksByStatus={tasksByStatus()}
              statuses={statuses}
              onCreateTask={createTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onReorderTasks={reorderTasks}
              onStatusesChange={() => {
                refetchStatuses();
                fetchTasks();
              }}
            />
          )}
        </div>
      </PageContent>

      {/* Create Task Modal */}
      <PersonalTaskCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreateTask}
        workspaces={workspaces}
        defaultWorkspaceId={selectedWorkspaceId === 'independent' ? null : selectedWorkspaceId}
      />
    </PageLayout>
  );
}
