'use client';

import { Plus, CheckSquare, Settings } from 'lucide-react';
import { useState } from 'react';
import { PageLayout, PageHeader, PageContent } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { PersonalTaskBoard as TaskBoardComponent } from '@/components/tasks/PersonalTaskBoard';
import { PersonalTaskCreateModal } from '@/components/tasks/PersonalTaskCreateModal';
import { PersonalTaskDetailModal } from '@/components/tasks/PersonalTaskDetailModal';
import { WorkspaceTabs } from '@/components/tasks/WorkspaceTabs';
import { usePersonalTasks } from '@/hooks/usePersonalTasks';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { TaskPriority, PersonalTask } from '@/lib/api';
import { BlankAreaContextMenu } from '@/components/ui/BlankAreaContextMenu';
import { MobileTaskList } from '@/components/mobile';

export default function TasksPage() {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInStatus, setCreateInStatus] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [selectedTask, setSelectedTask] = useState<PersonalTask | null>(null);

  const { workspaces, loadingWorkspaces } = useWorkspace();

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
    reorderStatuses,
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
    const finalWorkspaceId = data.workspaceId !== undefined
      ? data.workspaceId
      : selectedWorkspaceId === 'independent'
        ? null
        : selectedWorkspaceId;

    const result = await createTask({
      ...data,
      status: createInStatus || 'todo',
      workspaceId: finalWorkspaceId,
    });

    // Reset the status after creating
    setCreateInStatus(null);
    return result;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Only show on blank area (not on interactive elements)
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"], [data-no-context-menu]')) {
      return;
    }
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const totalTasks = Object.values(tasksByStatus()).flat().length;

  if (loading) {
    return (
      <>
        {/* Mobile loading */}
        <div className="md:hidden h-full">
          <MobileTaskList
            tasksByStatus={tasksByStatus()}
            statuses={statuses}
            isLoading={true}
          />
        </div>
        {/* Desktop loading */}
        <div className="hidden md:block">
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
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile View - Optimized for touch */}
      <div className="md:hidden h-full">
        <MobileTaskList
          tasksByStatus={tasksByStatus()}
          statuses={statuses}
          onTaskClick={(task) => setSelectedTask(task)}
          onCreateTask={() => setCreateModalOpen(true)}
          onCreateTaskInStatus={(statusId) => {
            setCreateInStatus(statusId);
            setCreateModalOpen(true);
          }}
          onRefresh={fetchTasks}
          onUpdateTaskStatus={async (taskId, newStatus) => {
            await updateTask(taskId, { status: newStatus });
          }}
          isLoading={loading}
        />
      </div>

      {/* Desktop View - Full Kanban board */}
      <div className="hidden md:block">
        <PageLayout>
          <PageHeader
            title="My Tasks"
            description="Manage your personal tasks"
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                  className="gap-2"
                >
                  <Settings size={16} />
                  Customize Columns
                </Button>
                <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
                  <Plus size={16} />
                  New Task
                </Button>
              </div>
            }
          />
          <PageContent>
            <div onContextMenu={handleContextMenu} className="min-h-[calc(100vh-220px)]">
              {/* Workspace Tabs */}
              <WorkspaceTabs
                workspaces={workspaces}
                selectedWorkspaceId={selectedWorkspaceId}
                onSelectWorkspace={setSelectedWorkspaceId}
              />

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
                  workspaces={workspaces}
                  onCreateTask={createTask}
                  onUpdateTask={updateTask}
                  onDeleteTask={deleteTask}
                  onReorderTasks={reorderTasks}
                  onReorderStatuses={reorderStatuses}
                  onStatusesChange={() => {
                    refetchStatuses();
                    fetchTasks();
                  }}
                  settingsOpen={settingsOpen}
                  onSettingsOpenChange={setSettingsOpen}
                />
              )}
            </div>
          </PageContent>

          {/* Context Menu */}
          {contextMenu && (
            <BlankAreaContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onAction={() => setCreateModalOpen(true)}
              actionLabel="New Task"
            />
          )}
        </PageLayout>
      </div>

      {/* Create Task Modal - Available on both mobile and desktop */}
      <PersonalTaskCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreateTask}
        workspaces={workspaces}
        defaultWorkspaceId={selectedWorkspaceId === 'independent' ? null : selectedWorkspaceId}
      />

      {/* Task Detail Modal - For viewing/editing tasks */}
      {selectedTask && (
        <PersonalTaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (id, data) => {
            const result = await updateTask(id, data);
            if (result) {
              setSelectedTask(null);
            }
            return result;
          }}
          onDelete={async (id) => {
            const result = await deleteTask(id);
            if (result) {
              setSelectedTask(null);
            }
            return result;
          }}
          workspaces={workspaces}
        />
      )}
    </>
  );
}
