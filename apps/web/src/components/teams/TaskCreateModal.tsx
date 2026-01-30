'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Task, TaskPriority, TeamMember } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TaskCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string;
    assigneeIds?: string[];
  }) => Promise<Task | null>;
  teamMembers: TeamMember[];
}

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-500' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-500' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-500' },
];

export function TaskCreateModal({
  open,
  onOpenChange,
  onCreate,
  teamMembers,
}: TaskCreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const task = await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
        assigneeIds: selectedAssignees.length > 0 ? selectedAssignees : undefined,
      });

      if (task) {
        setTitle('');
        setDescription('');
        setPriority('MEDIUM');
        setDueDate('');
        setSelectedAssignees([]);
        onOpenChange(false);
      } else {
        setError('Failed to create task');
      }
    } catch (err) {
      setError('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignee = (memberId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg p-6 z-[101] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Task</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1.5">
                Title
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1.5">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                disabled={loading}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                      priority === p.value
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-muted-foreground'
                    )}
                    onClick={() => setPriority(p.value)}
                    disabled={loading}
                  >
                    <div className={cn('w-2 h-2 rounded-full', p.color)} />
                    <span className="text-sm">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium mb-1.5">
                Due Date (optional)
              </label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading}
              />
            </div>

            {teamMembers.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Assignees (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                        selectedAssignees.includes(member.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-muted hover:border-muted-foreground'
                      )}
                      onClick={() => toggleAssignee(member.id)}
                      disabled={loading}
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
                      {selectedAssignees.includes(member.id) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
