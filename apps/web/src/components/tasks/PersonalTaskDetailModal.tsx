'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Calendar, Trash2, AlertCircle, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { PersonalTask, TaskStatus, TaskPriority, Workspace } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface PersonalTaskDetailModalProps {
  task: PersonalTask;
  onClose: () => void;
  onUpdate: (id: string, data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
    workspaceId?: string | null;
  }) => Promise<PersonalTask | null>;
  onDelete: (id: string) => Promise<boolean>;
  workspaces?: Workspace[];
}

const STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'BACKLOG', label: 'Backlog', color: 'bg-gray-500' },
  { value: 'TODO', label: 'To Do', color: 'bg-blue-500' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-500' },
  { value: 'DONE', label: 'Done', color: 'bg-green-500' },
];

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-500' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-500' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-500' },
];

export function PersonalTaskDetailModal({
  task,
  onClose,
  onUpdate,
  onDelete,
  workspaces = [],
}: PersonalTaskDetailModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '');
  const [workspaceId, setWorkspaceId] = useState<string | null>(task.workspaceId || null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      await onUpdate(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate || null,
        workspaceId,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const success = await onDelete(task.id);
      if (success) {
        onClose();
      }
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-2xl p-6 z-[101] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isOverdue && (
              <div className="flex items-center gap-1 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                Overdue
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold border-0 px-0 focus-visible:ring-0"
              placeholder="Task title"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                      status === s.value
                        ? 'border border-primary bg-primary/10'
                        : 'border border-muted hover:border-muted-foreground'
                    )}
                    onClick={() => setStatus(s.value)}
                  >
                    <div className={cn('w-1.5 h-1.5 rounded-full', s.color)} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Priority</label>
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                      priority === p.value
                        ? 'border border-primary bg-primary/10'
                        : 'border border-muted hover:border-muted-foreground'
                    )}
                    onClick={() => setPriority(p.value)}
                  >
                    <div className={cn('w-1.5 h-1.5 rounded-full', p.color)} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Workspace */}
          {workspaces.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <FolderKanban className="h-4 w-4 inline mr-1.5" />
                Workspace
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={cn(
                    'px-2.5 py-1 rounded text-xs transition-colors border',
                    workspaceId === null
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-muted-foreground'
                  )}
                  onClick={() => setWorkspaceId(null)}
                >
                  Independent
                </button>
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    type="button"
                    className={cn(
                      'px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1',
                      workspaceId === workspace.id
                        ? 'text-white'
                        : 'border border-muted hover:border-muted-foreground'
                    )}
                    style={{
                      backgroundColor: workspaceId === workspace.id ? (workspace.color || '#6366f1') : undefined,
                    }}
                    onClick={() => setWorkspaceId(workspace.id)}
                  >
                    {workspace.icon && <span>{workspace.icon}</span>}
                    {workspace.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              <Calendar className="h-4 w-4 inline mr-1.5" />
              Due Date
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Meta info */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            Created {format(new Date(task.createdAt), 'MMM d, yyyy')}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
          >
            {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>

        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete Task"
          itemName={task.title}
          itemType="task"
          description="This will permanently remove the task."
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
