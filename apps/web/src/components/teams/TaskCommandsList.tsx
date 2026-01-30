'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  GripVertical,
  Play,
  Loader2,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTaskCommands } from '@/hooks/useTaskCommands';
import { TaskCommand } from '@/lib/api';

interface TaskCommandsListProps {
  taskId: string;
  onExecute?: (command: string) => Promise<number>;
}

export function TaskCommandsList({ taskId, onExecute }: TaskCommandsListProps) {
  const {
    commands,
    loading,
    error,
    createCommand,
    updateCommand,
    deleteCommand,
    executeCommand,
    toggleComplete,
    completedCount,
    totalCount,
  } = useTaskCommands(taskId);
  const [newCommand, setNewCommand] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newCommand.trim()) return;

    await createCommand({
      command: newCommand.trim(),
      description: newDescription.trim() || undefined,
    });

    setNewCommand('');
    setNewDescription('');
    setShowAddForm(false);
  };

  const handleExecute = async (cmd: TaskCommand) => {
    if (!onExecute || cmd.isCompleted) return;

    setExecutingId(cmd.id);
    try {
      const exitCode = await onExecute(cmd.command);
      await executeCommand(cmd.id, exitCode);
    } finally {
      setExecutingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Command Checklist
        </h4>
        {totalCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount} completed
          </span>
        )}
      </div>

      {totalCount > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{
              width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        {commands.map((cmd) => (
          <div
            key={cmd.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              cmd.isCompleted ? 'bg-muted/50' : 'bg-background'
            }`}
          >
            <button
              onClick={() => toggleComplete(cmd.id)}
              className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
            >
              {cmd.isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div
                className={`font-mono text-sm ${
                  cmd.isCompleted ? 'line-through text-muted-foreground' : ''
                }`}
              >
                {cmd.command}
              </div>
              {cmd.description && (
                <p className="text-xs text-muted-foreground mt-1">{cmd.description}</p>
              )}
              {cmd.exitCode !== null && (
                <span
                  className={`inline-flex items-center gap-1 text-xs mt-1 ${
                    cmd.exitCode === 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  Exit code: {cmd.exitCode}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {onExecute && !cmd.isCompleted && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleExecute(cmd)}
                  disabled={executingId === cmd.id}
                >
                  {executingId === cmd.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteCommand(cmd.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showAddForm ? (
        <div className="space-y-2 p-3 rounded-lg border bg-muted/50">
          <Input
            placeholder="Enter command..."
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            className="font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Input
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewCommand('');
                setNewDescription('');
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!newCommand.trim()}>
              Add Command
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4" />
          Add Command
        </Button>
      )}
    </div>
  );
}
