'use client';

import { useState } from 'react';
import { Monitor, Plus, Trash2, MoreVertical, Loader2, Eye, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTeamTerminals } from '@/hooks/useTeamTerminals';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { ShareTerminalWithTeamModal } from './ShareTerminalWithTeamModal';
import { TeamTerminalShare, SharePermission } from '@/lib/api';

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
    updatePermission,
    removeTerminal,
  } = useTeamTerminals(teamId);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<TeamTerminalShare | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleShare = async (terminalId: string, permission: SharePermission) => {
    await shareTerminal(terminalId, permission);
    setShareModalOpen(false);
  };

  const handleUnshare = async () => {
    if (!selectedTerminal) return;
    await removeTerminal(selectedTerminal.terminalId);
    setDeleteModalOpen(false);
    setSelectedTerminal(null);
  };

  const handleDeleteClick = (terminal: TeamTerminalShare) => {
    setMenuOpenId(null);
    setSelectedTerminal(terminal);
    setDeleteModalOpen(true);
  };

  const handlePermissionChange = async (terminal: TeamTerminalShare, permission: SharePermission) => {
    setMenuOpenId(null);
    await updatePermission(terminal.terminalId, permission);
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

  if (terminals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Monitor className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No shared terminals</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Share terminals with your team for collaboration.
        </p>
        {canManage && (
          <Button onClick={() => setShareModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Share Terminal
          </Button>
        )}
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
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setShareModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Share Terminal
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {terminals.map((share) => (
          <Card
            key={share.id}
            className="hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => onOpen?.(share.terminalId)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Monitor className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{share.terminal?.name || 'Terminal'}</h4>
                    <p className="text-xs text-muted-foreground">
                      {share.terminal?.type || 'Unknown'}
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
                      setMenuOpenId(menuOpenId === share.id ? null : share.id);
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  {menuOpenId === share.id && (
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
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 ${
                            share.permission === 'VIEW' ? 'bg-muted' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePermissionChange(share, 'VIEW');
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          View Only
                        </button>
                        <button
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 ${
                            share.permission === 'CONTROL' ? 'bg-muted' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePermissionChange(share, 'CONTROL');
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                          Can Control
                        </button>
                        {canManage && (
                          <>
                            <div className="border-t my-1" />
                            <button
                              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(share);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-medium bg-muted rounded flex items-center gap-1">
                  {share.permission === 'VIEW' ? (
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ShareTerminalWithTeamModal
        teamId={teamId}
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        onShare={handleShare}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Remove Terminal"
        itemName={selectedTerminal?.terminal?.name || 'terminal'}
        itemType="terminal share"
        description="This will remove the terminal from the team. The terminal will still exist but won't be shared."
        onConfirm={handleUnshare}
        onCancel={() => {
          setDeleteModalOpen(false);
          setSelectedTerminal(null);
        }}
      />
    </div>
  );
}
