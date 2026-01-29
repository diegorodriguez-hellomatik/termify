'use client';

import { useState } from 'react';
import { Server, Plus, Trash2, MoreVertical, Loader2, RefreshCw, Terminal, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTeamServers } from '@/hooks/useTeamServers';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { TeamServer, ServerStatus } from '@/lib/api';

interface TeamServersListProps {
  teamId: string;
  canManage: boolean;
  onConnect?: (terminalId: string) => void;
}

export function TeamServersList({
  teamId,
  canManage,
  onConnect,
}: TeamServersListProps) {
  const {
    servers,
    loading,
    error,
    refetch,
    createServer,
    deleteServer,
    checkServer,
    connectToServer,
  } = useTeamServers(teamId);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<TeamServer | null>(null);
  const [checkingServer, setCheckingServer] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleCheck = async (serverId: string) => {
    setMenuOpenId(null);
    setCheckingServer(serverId);
    await checkServer(serverId);
    setCheckingServer(null);
  };

  const handleDelete = async () => {
    if (!selectedServer) return;
    await deleteServer(selectedServer.id);
    setDeleteModalOpen(false);
    setSelectedServer(null);
  };

  const handleDeleteClick = (server: TeamServer) => {
    setMenuOpenId(null);
    setSelectedServer(server);
    setDeleteModalOpen(true);
  };

  const getStatusColor = (status: ServerStatus | null) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-green-500';
      case 'OFFLINE':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: ServerStatus | null) => {
    switch (status) {
      case 'ONLINE':
        return 'Online';
      case 'OFFLINE':
        return 'Offline';
      default:
        return 'Unknown';
    }
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

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Server className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No team servers</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Add SSH servers for quick team access.
        </p>
        {canManage && (
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Add Server
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Add Server
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {servers.map((server) => (
          <Card key={server.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{server.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {server.host}:{server.port}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMenuOpenId(menuOpenId === server.id ? null : server.id)}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  {menuOpenId === server.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-background border rounded-md shadow-lg z-50 py-1">
                        <button
                          className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                          onClick={() => handleCheck(server.id)}
                          disabled={checkingServer === server.id}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              checkingServer === server.id ? 'animate-spin' : ''
                            }`}
                          />
                          Check Status
                        </button>
                        <button
                          className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                          onClick={() => setMenuOpenId(null)}
                        >
                          <Terminal className="h-4 w-4" />
                          Connect
                        </button>
                        {server.documentation && (
                          <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            View Docs
                          </button>
                        )}
                        {canManage && (
                          <>
                            <div className="border-t my-1" />
                            <button
                              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                              onClick={() => handleDeleteClick(server)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${getStatusColor(server.lastStatus)}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {getStatusLabel(server.lastStatus)}
                  </span>
                </div>
                <span className="px-2 py-0.5 text-xs font-medium border rounded">
                  {server.authMethod}
                </span>
              </div>

              {server.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                  {server.description}
                </p>
              )}

              {server.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {server.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-muted rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Server"
        itemName={selectedServer?.name || ''}
        itemType="server"
        description="This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setSelectedServer(null);
        }}
      />
    </div>
  );
}
