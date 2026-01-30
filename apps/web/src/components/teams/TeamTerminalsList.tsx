'use client';

import { useState } from 'react';
import {
  Monitor,
  Plus,
  Trash2,
  MoreVertical,
  Loader2,
  Eye,
  Edit3,
  ChevronDown,
  Upload,
  Share2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTeamTerminals } from '@/hooks/useTeamTerminals';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { ShareTerminalWithTeamModal } from './ShareTerminalWithTeamModal';
import { CreateTeamTerminalModal } from './CreateTeamTerminalModal';
import { TeamTerminalShare, SharePermission } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ExtendedTeamTerminalShare extends TeamTerminalShare {
  isOwned?: boolean;
}

interface TeamTerminalsListProps {
  teamId: string;
  canManage: boolean;
  onOpen?: (terminalId: string) => void;
}

export function TeamTerminalsList({
  teamId,
  canManage,
  onOpen,
}: TeamTerminalsListProps) {
  const {
    terminals,
    loading,
    error,
    refetch,
    shareTerminal,
    createTerminal,
    updatePermission,
    removeTerminal,
  } = useTeamTerminals(teamId);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<ExtendedTeamTerminalShare | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleShare = async (terminalId: string, permission: SharePermission) => {
    await shareTerminal(terminalId, permission);
    setShareModalOpen(false);
  };

  const handleCreate = async (data: {
    name: string;
    type?: 'LOCAL' | 'SSH';
    sshHost?: string;
    sshPort?: number;
    sshUsername?: string;
  }) => {
    const result = await createTerminal(data);
    if (result.success) {
      setCreateModalOpen(false);
    }
    return result;
  };

  const handleUnshare = async () => {
    if (!selectedTerminal) return;
    await removeTerminal(selectedTerminal.terminalId);
    setDeleteModalOpen(false);
    setSelectedTerminal(null);
  };

  const handleDeleteClick = (terminal: ExtendedTeamTerminalShare) => {
    setMenuOpenId(null);
    setSelectedTerminal(terminal);
    setDeleteModalOpen(true);
  };

  const handlePermissionChange = async (terminal: ExtendedTeamTerminalShare, permission: SharePermission) => {
    setMenuOpenId(null);
    if (!terminal.isOwned) {
      await updatePermission(terminal.terminalId, permission);
    }
  };

  // Separate owned and shared terminals
  const ownedTerminals = (terminals as ExtendedTeamTerminalShare[]).filter(t => t.isOwned);
  const sharedTerminals = (terminals as ExtendedTeamTerminalShare[]).filter(t => !t.isOwned);

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

  if (terminals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Monitor className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No team terminals</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Create a new terminal or share existing ones with your team.
        </p>
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
              <Plus size={16} />
              Create Terminal
            </Button>
            <Button variant="outline" onClick={() => setShareModalOpen(true)} className="gap-2">
              <Upload size={16} />
              Import
            </Button>
          </div>
        )}
        <CreateTeamTerminalModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          teamId={teamId}
          onCreate={handleCreate}
        />
        <ShareTerminalWithTeamModal
          teamId={teamId}
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          onShare={handleShare}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end relative">
          <div className="relative">
            <Button onClick={() => setDropdownOpen(!dropdownOpen)} className="gap-2">
              <Plus size={16} />
              Add Terminal
              <ChevronDown size={14} className={cn('transition-transform', dropdownOpen && 'rotate-180')} />
            </Button>
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-56 bg-background border rounded-md shadow-lg z-50 py-1">
                  <button
                    className="w-full px-3 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2"
                    onClick={() => {
                      setDropdownOpen(false);
                      setCreateModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Create New</div>
                      <div className="text-xs text-muted-foreground">Create a terminal for the team</div>
                    </div>
                  </button>
                  <button
                    className="w-full px-3 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2"
                    onClick={() => {
                      setDropdownOpen(false);
                      setShareModalOpen(true);
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Import Personal</div>
                      <div className="text-xs text-muted-foreground">Share an existing terminal</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Team Owned Terminals */}
      {ownedTerminals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Terminals ({ownedTerminals.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ownedTerminals.map((terminal) => (
              <TerminalCard
                key={terminal.id}
                terminal={terminal}
                canManage={canManage}
                menuOpenId={menuOpenId}
                setMenuOpenId={setMenuOpenId}
                onOpen={onOpen}
                onPermissionChange={handlePermissionChange}
                onDelete={handleDeleteClick}
                isOwned={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Shared Terminals */}
      {sharedTerminals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Shared Terminals ({sharedTerminals.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sharedTerminals.map((share) => (
              <TerminalCard
                key={share.id}
                terminal={share}
                canManage={canManage}
                menuOpenId={menuOpenId}
                setMenuOpenId={setMenuOpenId}
                onOpen={onOpen}
                onPermissionChange={handlePermissionChange}
                onDelete={handleDeleteClick}
                isOwned={false}
              />
            ))}
          </div>
        </div>
      )}

      <CreateTeamTerminalModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        teamId={teamId}
        onCreate={handleCreate}
      />

      <ShareTerminalWithTeamModal
        teamId={teamId}
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        onShare={handleShare}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title={selectedTerminal?.isOwned ? 'Delete Terminal' : 'Remove Terminal'}
        itemName={selectedTerminal?.terminal?.name || 'terminal'}
        itemType={selectedTerminal?.isOwned ? 'terminal' : 'terminal share'}
        description={
          selectedTerminal?.isOwned
            ? 'This will permanently delete the terminal.'
            : "This will remove the terminal from the team. The terminal will still exist in the owner's account."
        }
        onConfirm={handleUnshare}
        onCancel={() => {
          setDeleteModalOpen(false);
          setSelectedTerminal(null);
        }}
      />
    </div>
  );
}

// Terminal Card Component
interface TerminalCardProps {
  terminal: ExtendedTeamTerminalShare;
  canManage: boolean;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onOpen?: (terminalId: string) => void;
  onPermissionChange: (terminal: ExtendedTeamTerminalShare, permission: SharePermission) => void;
  onDelete: (terminal: ExtendedTeamTerminalShare) => void;
  isOwned: boolean;
}

function TerminalCard({
  terminal,
  canManage,
  menuOpenId,
  setMenuOpenId,
  onOpen,
  onPermissionChange,
  onDelete,
  isOwned,
}: TerminalCardProps) {
  return (
    <Card
      className="hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => onOpen?.(terminal.terminalId)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isOwned ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Monitor className={cn('h-5 w-5', isOwned ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div>
              <h4 className="font-medium">{terminal.terminal?.name || 'Terminal'}</h4>
              <p className="text-xs text-muted-foreground">
                {terminal.terminal?.type || 'Unknown'}
                {!isOwned && terminal.terminal?.owner && (
                  <> &middot; by {terminal.terminal.owner.name || terminal.terminal.owner.email}</>
                )}
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
                setMenuOpenId(menuOpenId === terminal.id ? null : terminal.id);
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {menuOpenId === terminal.id && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(null);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-background border rounded-md shadow-lg z-50 py-1">
                  {!isOwned && (
                    <>
                      <button
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 ${
                          terminal.permission === 'VIEW' ? 'bg-muted' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPermissionChange(terminal, 'VIEW');
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        View Only
                      </button>
                      <button
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 ${
                          terminal.permission === 'CONTROL' ? 'bg-muted' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPermissionChange(terminal, 'CONTROL');
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                        Can Control
                      </button>
                    </>
                  )}
                  {canManage && (
                    <>
                      {!isOwned && <div className="border-t my-1" />}
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(terminal);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {isOwned ? 'Delete' : 'Remove'}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwned ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded flex items-center gap-1">
              <Users className="h-3 w-3" />
              Team Owned
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium bg-muted rounded flex items-center gap-1">
              {terminal.permission === 'VIEW' ? (
                <>
                  <Eye className="h-3 w-3" />
                  View Only
                </>
              ) : (
                <>
                  <Edit3 className="h-3 w-3" />
                  Can Control
                </>
              )}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
