'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers,
  Plus,
  Trash2,
  MoreHorizontal,
  Loader2,
  Users,
  Terminal as TerminalIcon,
  Folder,
  Briefcase,
  Wrench,
  Rocket,
  Home,
  Settings,
  Laptop,
  Globe,
  Star,
  Flame,
  Lightbulb,
  Code,
  Database,
  Server,
  Cloud,
  Box,
  Zap,
  Shield,
  Lock,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTeamWorkspaces } from '@/hooks/useTeamWorkspaces';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { ShareWorkspaceWithTeamModal } from './ShareWorkspaceWithTeamModal';
import { CreateTeamWorkspaceModal } from './CreateTeamWorkspaceModal';
import { TeamWorkspace } from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

// Icon mapping for workspaces
const WORKSPACE_ICONS: Record<string, React.FC<{ className?: string; size?: number; style?: React.CSSProperties }>> = {
  folder: Folder,
  briefcase: Briefcase,
  wrench: Wrench,
  rocket: Rocket,
  home: Home,
  settings: Settings,
  laptop: Laptop,
  globe: Globe,
  star: Star,
  flame: Flame,
  lightbulb: Lightbulb,
  code: Code,
  database: Database,
  server: Server,
  cloud: Cloud,
  terminal: TerminalIcon,
  box: Box,
  zap: Zap,
  shield: Shield,
  lock: Lock,
  key: Key,
};

const getWorkspaceIcon = (iconName: string | null | undefined) => {
  if (!iconName) return null;
  return WORKSPACE_ICONS[iconName] || null;
};

const getWorkspaceColor = (ws: TeamWorkspace) => ws.color || '#6366f1';

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
  const { isDark } = useTheme();
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canManage) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"], [data-no-context-menu]')) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

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
      <div className="flex flex-col items-center justify-center py-16 px-4 min-h-[300px]" onContextMenu={handleContextMenu}>
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Layers className="h-8 w-8 text-muted-foreground" />
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
        {contextMenu && typeof document !== 'undefined' && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
            <div
              className="fixed z-[9999] min-w-[160px] py-1 rounded-lg shadow-xl border border-border bg-popover overflow-hidden animate-in fade-in zoom-in-95 duration-100"
              style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 100) }}
            >
              <button
                onClick={() => { setCreateModalOpen(true); setContextMenu(null); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              >
                <Plus size={16} className="text-primary" />
                <span>New Workspace</span>
              </button>
              <button
                onClick={() => { setShareModalOpen(true); setContextMenu(null); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              >
                <Users size={16} className="text-muted-foreground" />
                <span>Share Existing</span>
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 min-h-[300px]" onContextMenu={handleContextMenu}>
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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            className={cn(
              'group relative rounded-xl border cursor-pointer flex flex-col',
              'hover:shadow-lg transition-shadow transition-border duration-200',
              isDark
                ? 'bg-card border-border hover:border-muted-foreground/30'
                : 'bg-white border-gray-200 hover:border-gray-300'
            )}
            onClick={() => onOpen?.(workspace.id)}
          >
            {/* Color bar */}
            <div
              className="h-2 rounded-t-xl flex-shrink-0"
              style={{ backgroundColor: getWorkspaceColor(workspace) }}
            />

            {/* Content */}
            <div className="p-5 flex flex-col flex-1">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: getWorkspaceColor(workspace) + '20' }}
                  >
                    {(() => {
                      const IconComp = getWorkspaceIcon(workspace.icon);
                      return IconComp ? (
                        <IconComp size={24} style={{ color: getWorkspaceColor(workspace) }} />
                      ) : (
                        <Layers size={24} style={{ color: getWorkspaceColor(workspace) }} />
                      );
                    })()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{workspace.name}</h3>
                    {workspace.isTeamDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        team default
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === workspace.id ? null : workspace.id);
                    }}
                    className="p-1.5 rounded-md hover:bg-muted transition-all"
                  >
                    <MoreHorizontal size={16} className="text-muted-foreground" />
                  </button>
                  {canManage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(workspace);
                      }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-all"
                      title="Remove from team"
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </button>
                  )}
                </div>
              </div>

              {/* Description - with min height to maintain card size */}
              <div className="flex-1 min-h-[40px] mb-4">
                {workspace.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {workspace.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">
                    No description
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-auto pt-3 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <TerminalIcon size={14} />
                  <span>{workspace.terminalCount || 0} terminals</span>
                </div>
              </div>
            </div>

            {/* Context menu */}
            {menuOpenId === workspace.id && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(null);
                  }}
                />
                <div className="absolute right-2 top-14 w-48 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(null);
                      onOpen?.(workspace.id);
                    }}
                  >
                    <Layers className="h-4 w-4" />
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
                      <Star className="h-4 w-4" />
                      Set as Team Default
                    </button>
                  )}
                  {canManage && (
                    <>
                      <div className="border-t border-border my-1" />
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

      {contextMenu && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-[9999] min-w-[160px] py-1 rounded-lg shadow-xl border border-border bg-popover overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 100) }}
          >
            <button
              onClick={() => { setCreateModalOpen(true); setContextMenu(null); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              <Plus size={16} className="text-primary" />
              <span>New Workspace</span>
            </button>
            <button
              onClick={() => { setShareModalOpen(true); setContextMenu(null); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              <Users size={16} className="text-muted-foreground" />
              <span>Share Existing</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
