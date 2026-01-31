'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Layout, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { workspacesApi, Workspace } from '@/lib/api';

interface ShareWorkspaceWithTeamModalProps {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (workspaceId: string) => Promise<void>;
}

export function ShareWorkspaceWithTeamModal({
  teamId,
  open,
  onOpenChange,
  onShare,
}: ShareWorkspaceWithTeamModalProps) {
  const { data: session } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open && session?.accessToken) {
      setLoading(true);
      workspacesApi
        .list(session.accessToken)
        .then((response) => {
          if (response.success && response.data) {
            setWorkspaces(response.data.workspaces);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, session?.accessToken]);

  const filteredWorkspaces = workspaces.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedWorkspaceId) return;

    setSubmitting(true);
    try {
      await onShare(selectedWorkspaceId);
      setSelectedWorkspaceId(null);
      setSearch('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold mb-4">Share Workspace with Team</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Search Workspaces</label>
            <Input
              placeholder="Search your workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredWorkspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search ? 'No workspaces found' : 'No workspaces available'}
              </p>
            ) : (
              filteredWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  onClick={() => setSelectedWorkspaceId(workspace.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedWorkspaceId === workspace.id
                      ? 'bg-primary/10 border border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Layout className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{workspace.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {workspace.terminalCount || 0} terminals
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedWorkspaceId || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Share Workspace
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
