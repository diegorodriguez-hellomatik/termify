'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AddToQueueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    commands: Array<{ command: string; position?: number }>;
  }) => Promise<boolean>;
}

interface CommandInput {
  id: string;
  command: string;
}

export function AddToQueueModal({
  open,
  onOpenChange,
  onCreate,
}: AddToQueueModalProps) {
  const [name, setName] = useState('');
  const [commands, setCommands] = useState<CommandInput[]>([
    { id: crypto.randomUUID(), command: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Queue name is required');
      return;
    }

    const validCommands = commands.filter((c) => c.command.trim());
    if (validCommands.length === 0) {
      setError('At least one command is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onCreate({
        name: name.trim(),
        commands: validCommands.map((c, index) => ({
          command: c.command.trim(),
          position: index,
        })),
      });

      if (success) {
        setName('');
        setCommands([{ id: crypto.randomUUID(), command: '' }]);
        onOpenChange(false);
      } else {
        setError('Failed to create queue');
      }
    } catch (err) {
      setError('Failed to create queue');
    } finally {
      setLoading(false);
    }
  };

  const addCommand = () => {
    setCommands([...commands, { id: crypto.randomUUID(), command: '' }]);
  };

  const removeCommand = (id: string) => {
    if (commands.length === 1) return;
    setCommands(commands.filter((c) => c.id !== id));
  };

  const updateCommand = (id: string, value: string) => {
    setCommands(
      commands.map((c) => (c.id === id ? { ...c, command: value } : c))
    );
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg p-6 z-[101] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add to Queue</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                Queue Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Deploy to production"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Commands
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Commands will be executed sequentially in order.
              </p>
              <div className="space-y-2">
                {commands.map((cmd, index) => (
                  <div key={cmd.id} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />
                    <span className="text-xs text-muted-foreground font-mono w-6">
                      {index + 1}.
                    </span>
                    <Input
                      value={cmd.command}
                      onChange={(e) => updateCommand(cmd.id, e.target.value)}
                      placeholder="Enter command..."
                      disabled={loading}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCommand(cmd.id)}
                      disabled={loading || commands.length === 1}
                      className="h-9 w-9 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCommand}
                disabled={loading}
                className="mt-2 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Command
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to Queue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
