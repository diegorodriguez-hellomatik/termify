'use client';

import { Plus, CheckSquare, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageLayout, PageHeader, PageContent } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { PersonalTaskBoard as TaskBoardComponent } from '@/components/tasks/PersonalTaskBoard';
import { PersonalTaskCreateModal } from '@/components/tasks/PersonalTaskCreateModal';
import { BoardTabs } from '@/components/tasks/BoardTabs';
import { BoardCreateModal } from '@/components/tasks/BoardCreateModal';
import { usePersonalTasks } from '@/hooks/usePersonalTasks';
import { usePersonalTaskBoards } from '@/hooks/usePersonalTaskBoards';
import { TaskPriority, PersonalTaskBoard } from '@/lib/api';

export default function TasksPage() {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<PersonalTaskBoard | null>(null);
  const [deleteConfirmBoard, setDeleteConfirmBoard] = useState<PersonalTaskBoard | null>(null);

  const {
    boards,
    loading: boardsLoading,
    createBoard,
    updateBoard,
    deleteBoard,
  } = usePersonalTaskBoards();

  const {
    loading: tasksLoading,
    tasksByStatus,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    fetchTasks,
  } = usePersonalTasks({ boardId: selectedBoardId });

  const loading = boardsLoading || tasksLoading;

  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string | null;
    boardId?: string | null;
    commands?: string[] | null;
  }) => {
    return createTask({
      ...data,
      status: 'TODO',
      boardId: data.boardId ?? selectedBoardId,
    });
  };

  const handleEditBoard = (board: PersonalTaskBoard) => {
    setEditingBoard(board);
    setBoardModalOpen(true);
  };

  const handleDeleteBoard = (board: PersonalTaskBoard) => {
    setDeleteConfirmBoard(board);
  };

  const confirmDeleteBoard = async () => {
    if (deleteConfirmBoard) {
      const success = await deleteBoard(deleteConfirmBoard.id);
      if (success && selectedBoardId === deleteConfirmBoard.id) {
        setSelectedBoardId(null);
      }
      setDeleteConfirmBoard(null);
    }
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
        {/* Board Tabs */}
        <BoardTabs
          boards={boards}
          selectedBoardId={selectedBoardId}
          onSelectBoard={setSelectedBoardId}
          onCreateBoard={() => {
            setEditingBoard(null);
            setBoardModalOpen(true);
          }}
          onEditBoard={handleEditBoard}
          onDeleteBoard={handleDeleteBoard}
        />

        {totalTasks === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CheckSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No tasks yet</h3>
            <p className="text-sm text-muted-foreground text-center">
              {selectedBoardId
                ? 'Create a task in this board to get started.'
                : 'Create a task to get started organizing your work.'}
            </p>
          </div>
        ) : (
          <TaskBoardComponent
            tasksByStatus={tasksByStatus()}
            onCreateTask={createTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onReorderTasks={reorderTasks}
          />
        )}
      </PageContent>

      {/* Create Task Modal */}
      <PersonalTaskCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreateTask}
        boards={boards}
        defaultBoardId={selectedBoardId}
      />

      {/* Create/Edit Board Modal */}
      <BoardCreateModal
        open={boardModalOpen}
        onOpenChange={(open) => {
          setBoardModalOpen(open);
          if (!open) setEditingBoard(null);
        }}
        onCreate={createBoard}
        editBoard={editingBoard}
        onUpdate={updateBoard}
      />

      {/* Delete Board Confirmation */}
      {deleteConfirmBoard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmBoard(null)}
          />
          <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-sm p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold">Delete Board</h3>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete &quot;{deleteConfirmBoard.name}&quot;?
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Tasks in this board will be kept but unassigned from the board.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmBoard(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteBoard}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
