'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Plus, Trash2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PersonalTask, TaskPriority, PersonalTaskBoard } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PersonalTaskCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string | null;
    boardId?: string | null;
    commands?: string[] | null;
  }) => Promise<PersonalTask | null>;
  boards?: PersonalTaskBoard[];
  defaultBoardId?: string | null;
}

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-500' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-500' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-500' },
];

export function PersonalTaskCreateModal({
  open,
  onOpenChange,
  onCreate,
  boards = [],
  defaultBoardId,
}: PersonalTaskCreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [boardId, setBoardId] = useState<string | null>(defaultBoardId ?? null);
  const [commands, setCommands] = useState<string[]>([]);
  const [newCommand, setNewCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showCommands, setShowCommands] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open) {
      setBoardId(defaultBoardId ?? null);
    }
  }, [open, defaultBoardId]);

  const handleAddCommand = () => {
    if (newCommand.trim()) {
      setCommands((prev) => [...prev, newCommand.trim()]);
      setNewCommand('');
    }
  };

  const handleRemoveCommand = (index: number) => {
    setCommands((prev) => prev.filter((_, i) => i !== index));
  };

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
        boardId,
        commands: commands.length > 0 ? commands : null,
      });

      if (task) {
        setTitle('');
        setDescription('');
        setPriority('MEDIUM');
        setDueDate('');
        setBoardId(null);
        setCommands([]);
        setNewCommand('');
        setShowCommands(false);
        onOpenChange(false);
      } else {
        setError('Failed to create task');
      }
    } catch {
      setError('Failed to create task');
    } finally {
      setLoading(false);
    }
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

            {/* Board selection */}
            {boards.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Board</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      boardId === null
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-muted-foreground'
                    )}
                    onClick={() => setBoardId(null)}
                    disabled={loading}
                  >
                    No Board
                  </button>
                  {boards.map((board) => (
                    <button
                      key={board.id}
                      type="button"
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1',
                        boardId === board.id
                          ? 'text-white'
                          : 'border border-muted hover:border-muted-foreground'
                      )}
                      style={{
                        backgroundColor: boardId === board.id ? board.color : undefined,
                      }}
                      onClick={() => setBoardId(board.id)}
                      disabled={loading}
                    >
                      {board.icon && <span>{board.icon}</span>}
                      {board.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {/* Commands section */}
            <div>
              <button
                type="button"
                onClick={() => setShowCommands(!showCommands)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <Terminal className="h-4 w-4" />
                Terminal Commands
                {commands.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-primary/10 rounded text-xs">
                    {commands.length}
                  </span>
                )}
              </button>

              {showCommands && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Add commands to execute when you drag this task to a terminal.
                  </p>

                  {/* Commands list */}
                  {commands.length > 0 && (
                    <div className="space-y-1">
                      {commands.map((cmd, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-muted rounded font-mono text-xs"
                        >
                          <span className="text-muted-foreground">{index + 1}.</span>
                          <span className="flex-1 truncate">{cmd}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCommand(index)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add command input */}
                  <div className="flex gap-2">
                    <Input
                      value={newCommand}
                      onChange={(e) => setNewCommand(e.target.value)}
                      placeholder="npm install, git pull, etc."
                      className="font-mono text-sm"
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCommand();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddCommand}
                      disabled={loading || !newCommand.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

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
