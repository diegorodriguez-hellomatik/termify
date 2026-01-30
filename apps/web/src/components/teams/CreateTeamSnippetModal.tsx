'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TeamSnippet } from '@/lib/api';

interface CreateTeamSnippetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    command: string;
    description?: string;
    category?: string;
    tags?: string[];
  }) => Promise<{ success: boolean; data?: TeamSnippet; error?: string | unknown[] }>;
  editingSnippet?: TeamSnippet | null;
  onUpdate?: (id: string, data: {
    name?: string;
    command?: string;
    description?: string | null;
    category?: string | null;
    tags?: string[];
  }) => Promise<{ success: boolean; error?: string | unknown[] }>;
}

export function CreateTeamSnippetModal({
  open,
  onOpenChange,
  onCreate,
  editingSnippet,
  onUpdate,
}: CreateTeamSnippetModalProps) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (editingSnippet) {
      setName(editingSnippet.name);
      setCommand(editingSnippet.command);
      setDescription(editingSnippet.description || '');
      setCategory(editingSnippet.category || '');
      setTagsInput(editingSnippet.tags?.join(', ') || '');
    } else {
      setName('');
      setCommand('');
      setDescription('');
      setCategory('');
      setTagsInput('');
    }
  }, [editingSnippet, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Snippet name is required');
      return;
    }
    if (!command.trim()) {
      setError('Command is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (editingSnippet && onUpdate) {
        const result = await onUpdate(editingSnippet.id, {
          name: name.trim(),
          command: command.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          tags,
        });
        if (result.success) {
          handleClose();
        } else {
          const errMsg = Array.isArray(result.error) ? result.error.join(', ') : result.error;
          setError(errMsg || 'Failed to update snippet');
        }
      } else {
        const result = await onCreate({
          name: name.trim(),
          command: command.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        });
        if (result.success) {
          handleClose();
        } else {
          const errMsg = Array.isArray(result.error) ? result.error.join(', ') : result.error;
          setError(errMsg || 'Failed to create snippet');
        }
      }
    } catch (err) {
      setError('Failed to save snippet');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setCommand('');
    setDescription('');
    setCategory('');
    setTagsInput('');
    setError('');
    onOpenChange(false);
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-semibold mb-4">
          {editingSnippet ? 'Edit Snippet' : 'Create Team Snippet'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Snippet Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deploy to production"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Command
            </label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="git push origin main && npm run deploy"
              disabled={loading}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description (optional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deploys the latest changes to production server"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Category (optional)
              </label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Deployment"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Tags (optional)
              </label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="git, deploy, prod"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate with commas
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !command.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSnippet ? 'Save Changes' : 'Create Snippet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
