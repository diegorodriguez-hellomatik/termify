'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateTeamWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    description?: string;
    isTeamDefault?: boolean;
  }) => Promise<{ success: boolean; error?: string | unknown }>;
}

export function CreateTeamWorkspaceModal({
  open,
  onOpenChange,
  onCreate,
}: CreateTeamWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setIsDefault(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        isTeamDefault: isDefault,
      });

      if (result.success) {
        onOpenChange(false);
      } else {
        const errorMsg = typeof result.error === 'string' ? result.error : 'Failed to create workspace';
        setError(errorMsg);
      }
    } catch (err) {
      setError('Failed to create workspace');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold mb-4">Create Team Workspace</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Workspace Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Enter workspace name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Description
            </label>
            <textarea
              placeholder="Optional description..."
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              disabled={submitting}
              className="rounded border-border"
            />
            <label htmlFor="isDefault" className="text-sm text-muted-foreground">
              Set as team default workspace
            </label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
