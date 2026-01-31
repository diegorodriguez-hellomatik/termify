'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Calendar,
  User,
  UserPlus,
  UserMinus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { Task, TaskStatus, TaskPriority, TeamMember } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskDetailModalProps {
  task: Task;
  teamMembers: TeamMember[];
  onClose: () => void;
  onUpdate: (id: string, data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
  }) => Promise<Task | null>;
  onDelete: (id: string) => Promise<boolean>;
  onAssign: (taskId: string, teamMemberId: string) => Promise<any>;
  onUnassign: (taskId: string, assigneeId: string) => Promise<boolean>;
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

export function TaskDetailModal({
  task,
  teamMembers,
  onClose,
  onUpdate,
  onDelete,
  onAssign,
  onUnassign,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '');
  const [assignees, setAssignees] = useState(task.assignees || []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assigningMember, setAssigningMember] = useState<string | null>(null);
  const [showAssigneeSelector, setShowAssigneeSelector] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Sync assignees when task changes
  useEffect(() => {
    setAssignees(task.assignees || []);
  }, [task.assignees]);

  const assignedMemberIds = new Set(
    assignees.map((a) => a.teamMemberId)
  );

  const availableMembers = teamMembers.filter(
    (m) => !assignedMemberIds.has(m.id)
  );

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

  const handleAssign = async (memberId: string) => {
    setAssigningMember(memberId);
    try {
      const result = await onAssign(task.id, memberId);
      if (result) {
        // Add the new assignee to local state
        setAssignees((prev) => [...prev, result]);
      }
    } finally {
      setAssigningMember(null);
      setShowAssigneeSelector(false);
    }
  };

  const handleUnassign = async (assigneeId: string) => {
    setAssigningMember(assigneeId);
    try {
      const success = await onUnassign(task.id, assigneeId);
      if (success) {
        // Remove the assignee from local state
        setAssignees((prev) => prev.filter((a) => a.id !== assigneeId));
      }
    } finally {
      setAssigningMember(null);
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-2xl p-6 z-[101] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Close button - absolute positioned */}
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3">
          <X className="h-4 w-4" />
        </Button>

        <div className="space-y-6">
          {/* Title + Overdue indicator */}
          <div className="pr-10">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold border-0 px-0 focus-visible:ring-0"
              placeholder="Task title"
            />
            {isOverdue && (
              <div className="flex items-center gap-1 text-red-500 text-sm mt-1">
                <AlertCircle className="h-4 w-4" />
                Overdue
              </div>
            )}
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

          {/* Assignees */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium">
                <User className="h-4 w-4 inline mr-1.5" />
                Assignees
              </label>
              {availableMembers.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAssigneeSelector(!showAssigneeSelector)}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Assign
                </Button>
              )}
            </div>

            {/* Current assignees */}
            <div className="flex flex-wrap gap-2 mb-2">
              {assignees.map((assignee) => (
                <div
                  key={assignee.id}
                  className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted"
                >
                  <div className="w-5 h-5 rounded-full bg-background flex items-center justify-center text-xs">
                    {assignee.teamMember?.user?.image ? (
                      <img
                        src={assignee.teamMember.user.image}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      (assignee.teamMember?.user?.name ||
                        assignee.teamMember?.user?.email ||
                        '?'
                      )
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>
                  <span className="text-sm">
                    {assignee.teamMember?.user?.name ||
                      assignee.teamMember?.user?.email}
                  </span>
                  <button
                    onClick={() => handleUnassign(assignee.id)}
                    disabled={assigningMember === assignee.id}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {assigningMember === assignee.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <UserMinus className="h-3 w-3" />
                    )}
                  </button>
                </div>
              ))}
              {assignees.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  No assignees
                </span>
              )}
            </div>

            {/* Assignee selector */}
            {showAssigneeSelector && availableMembers.length > 0 && (
              <div className="border rounded-lg p-2 space-y-1">
                {availableMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleAssign(member.id)}
                    disabled={assigningMember === member.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                      {member.image ? (
                        <img
                          src={member.image}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        (member.name || member.email).charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-sm">{member.name || member.email}</span>
                    {assigningMember === member.id && (
                      <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            Created {format(new Date(task.createdAt), 'MMM d, yyyy')}
            {task.createdBy && ` by ${task.createdBy.name || task.createdBy.email}`}
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
          description="This will permanently remove the task and its assignments."
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
