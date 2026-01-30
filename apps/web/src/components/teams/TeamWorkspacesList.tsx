'use client';

import { useState } from 'react';
import { Layout, Plus, Trash2, MoreVertical, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTeamWorkspaces } from '@/hooks/useTeamWorkspaces';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { ShareWorkspaceWithTeamModal } from './ShareWorkspaceWithTeamModal';
import { CreateTeamWorkspaceModal } from './CreateTeamWorkspaceModal';
import { TeamWorkspace } from '@/lib/api';

interface TeamWorkspacesListProps {
  teamId: string;
  canManage: boolean;
  onOpen?: (workspaceId: string) => void;
}

export function TeamWorkspacesList({
  teamId,
  canManage,
  onOpen,
}: TeamWorkspacesListProps) {
  const {
    workspaces,
    loading,
    error,
    refetch,
    shareWorkspace,
    createWorkspace,
    updateWorkspace,
    removeWorkspace,
  } = useTeamWorkspaces(teamId);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<TeamWorkspace | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleShare = async (workspaceId: string) => {
    await shareWorkspace(workspaceId);
    setShareModalOpen(false);
  };

  const handleCreate = async (data: {
    name: string;
    description?: string;
    isTeamDefault?: boolean;
  }) => {
    const result = await createWorkspace(data);
    if (result.success) {
      setCreateModalOpen(false);
    }
    return result;
  };

  const handleRemove = async () => {
    if (!selectedWorkspace) return;
    await removeWorkspace(selectedWorkspace.id);
    setDeleteModalOpen(false);
    setSelectedWorkspace(null);
  };

  const handleSetDefault = async (workspaceId: string) => {
    setMenuOpenId(null);
    await updateWorkspace(workspaceId, { isTeamDefault: true });
  };

  const handleDeleteClick = (workspace: TeamWorkspace) => {
    setMenuOpenId(null);
    setSelectedWorkspace(workspace);
    setDeleteModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Layout className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No team workspaces</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Create a workspace for your team or share an existing one.
        </p>
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
              <Plus size={16} />
              Create Workspace
            </Button>
            <Button variant="outline" onClick={() => setShareModalOpen(true)} className="gap-2">
              <Users size={16} />
              Share Existing
            </Button>
          </div>
        )}
        <ShareWorkspaceWithTeamModal
          teamId={teamId}
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          onShare={handleShare}
        />
        <CreateTeamWorkspaceModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onCreate={handleCreate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end gap-2">
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Create Workspace
          </Button>
          <Button variant="outline" onClick={() => setShareModalOpen(true)} className="gap-2">
            <Users size={16} />
            Share Existing
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((workspace) => (
          <Card
            key={workspace.id}
            className="hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => onOpen?.(workspace.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Layout className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{workspace.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {workspace.terminalCount || 0} terminals
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === workspace.id ? null : workspace.id);
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  {menuOpenId === workspace.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                        }}
                      />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-background border rounded-md shadow-lg z-50 py-1">
                        <button
                          className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen?.(workspace.id);
                          }}
                        >
                          <Layout className="h-4 w-4" />
                          Open Workspace
                        </button>
                        {canManage && !workspace.isTeamDefault && (
                          <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(workspace.id);
                            }}
                          >
                            <Users className="h-4 w-4" />
                            Set as Default
                          </button>
                        )}
                        {canManage && (
                          <>
                            <div className="border-t my-1" />
                            <button
                              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(workspace);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove from Team
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {workspace.isTeamDefault && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-muted rounded">
                    Team Default
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ShareWorkspaceWithTeamModal
        teamId={teamId}
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        onShare={handleShare}
      />

      <CreateTeamWorkspaceModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreate}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Remove Workspace"
        itemName={selectedWorkspace?.name || ''}
        itemType="workspace"
        description="The workspace will still exist but won't be shared with the team."
        onConfirm={handleRemove}
        onCancel={() => {
          setDeleteModalOpen(false);
          setSelectedWorkspace(null);
        }}
      />
    </div>
  );
}
