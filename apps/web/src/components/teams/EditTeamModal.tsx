'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Team } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EditTeamModalProps {
  team: Team | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTeam: (teamId: string, data: { name?: string; description?: string; color?: string; icon?: string }) => Promise<Team | null>;
}

const TEAM_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export function EditTeamModal({
  team,
  open,
  onOpenChange,
  onUpdateTeam,
}: EditTeamModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync form with team data when modal opens
  useEffect(() => {
    if (team && open) {
      setName(team.name);
      setDescription(team.description || '');
      setColor(team.color || TEAM_COLORS[0]);
      setError('');
    }
  }, [team, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    if (!name.trim()) {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updatedTeam = await onUpdateTeam(team.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });

      if (updatedTeam) {
        onOpenChange(false);
      } else {
        setError('Failed to update team');
      }
    } catch (err) {
      setError('Failed to update team');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !team) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold mb-4">Edit Team</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                Team Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Team"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1.5">
                Description (optional)
              </label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this team for?"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      color === c && 'ring-2 ring-offset-2 ring-offset-background ring-primary'
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
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
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
