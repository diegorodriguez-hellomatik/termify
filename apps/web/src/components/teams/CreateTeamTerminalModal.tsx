'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Terminal, Server, Database, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { teamServersApi, TeamServer } from '@/lib/api';
import { useSession } from 'next-auth/react';

type TerminalType = 'LOCAL' | 'SSH' | 'FROM_SERVER';

interface CreateTeamTerminalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onCreate: (data: {
    name: string;
    type?: 'LOCAL' | 'SSH';
    sshHost?: string;
    sshPort?: number;
    sshUsername?: string;
  }) => Promise<any>;
}

export function CreateTeamTerminalModal({
  open,
  onOpenChange,
  teamId,
  onCreate,
}: CreateTeamTerminalModalProps) {
  const { data: session } = useSession();
  const [name, setName] = useState('');
  const [type, setType] = useState<TerminalType>('LOCAL');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Server selection state
  const [servers, setServers] = useState<TeamServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);

  // Fetch servers when modal opens
  useEffect(() => {
    if (open && teamId && session?.accessToken) {
      setLoadingServers(true);
      teamServersApi.list(teamId, session.accessToken)
        .then(response => {
          if (response.success && response.data) {
            setServers(response.data.servers || []);
          }
        })
        .catch(err => {
          console.error('Failed to fetch team servers:', err);
        })
        .finally(() => {
          setLoadingServers(false);
        });
    }
  }, [open, teamId, session?.accessToken]);

  // When a server is selected, populate the SSH fields
  const handleServerSelect = (server: TeamServer) => {
    setSelectedServerId(server.id);
    setName(server.name);
    setSshHost(server.host);
    setSshPort(server.port.toString());
    setSshUsername(server.username || '');
    setServerDropdownOpen(false);
  };

  const selectedServer = servers.find(s => s.id === selectedServerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate SSH or FROM_SERVER types
    const isSSHType = type === 'SSH' || type === 'FROM_SERVER';
    if (isSSHType) {
      if (!sshHost.trim()) {
        setError('Host is required for SSH');
        return;
      }
      if (type === 'FROM_SERVER' && !selectedServerId) {
        setError('Please select a server');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // FROM_SERVER creates an SSH terminal with the server's config
      const terminalType = type === 'FROM_SERVER' ? 'SSH' : type;
      const data: any = { name: name.trim(), type: terminalType };
      if (isSSHType) {
        data.sshHost = sshHost.trim();
        data.sshPort = parseInt(sshPort, 10) || 22;
        if (sshUsername.trim()) {
          data.sshUsername = sshUsername.trim();
        }
      }

      const result = await onCreate(data);
      if (result.success) {
        handleClose();
      } else {
        setError(result.error || 'Failed to create terminal');
      }
    } catch (err) {
      setError('Failed to create terminal');
    } finally {
      setLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleClose = () => {
    setName('');
    setType('LOCAL');
    setSshHost('');
    setSshPort('22');
    setSshUsername('');
    setError('');
    setSelectedServerId(null);
    setServerDropdownOpen(false);
    onOpenChange(false);
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-semibold mb-4">Create Team Terminal</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Terminal Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production Server"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Type</label>
            <div className={cn(
              'grid gap-2',
              servers.length > 0 ? 'grid-cols-3' : 'grid-cols-2'
            )}>
              <button
                type="button"
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors',
                  type === 'LOCAL'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                )}
                onClick={() => {
                  setType('LOCAL');
                  setSelectedServerId(null);
                }}
                disabled={loading}
              >
                <Terminal className="h-5 w-5" />
                <span className="font-medium">Local</span>
              </button>
              <button
                type="button"
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors',
                  type === 'SSH'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                )}
                onClick={() => {
                  setType('SSH');
                  setSelectedServerId(null);
                }}
                disabled={loading}
              >
                <Server className="h-5 w-5" />
                <span className="font-medium">SSH</span>
              </button>
              {servers.length > 0 && (
                <button
                  type="button"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors',
                    type === 'FROM_SERVER'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  )}
                  onClick={() => setType('FROM_SERVER')}
                  disabled={loading}
                >
                  <Database className="h-5 w-5" />
                  <span className="font-medium">Server</span>
                </button>
              )}
            </div>
          </div>

          {type === 'FROM_SERVER' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Select Server</label>
              <div className="relative">
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left',
                    serverDropdownOpen ? 'border-primary' : 'border-border',
                    'hover:bg-muted/50'
                  )}
                  onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
                  disabled={loading || loadingServers}
                >
                  {loadingServers ? (
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading servers...
                    </span>
                  ) : selectedServer ? (
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{selectedServer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {selectedServer.host}:{selectedServer.port}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Choose a server...</span>
                  )}
                  <ChevronDown className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    serverDropdownOpen && 'rotate-180'
                  )} />
                </button>
                {serverDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setServerDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                      {servers.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                          No servers configured
                        </div>
                      ) : (
                        servers.map(server => (
                          <button
                            key={server.id}
                            type="button"
                            className={cn(
                              'w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2',
                              selectedServerId === server.id && 'bg-primary/10'
                            )}
                            onClick={() => handleServerSelect(server)}
                          >
                            <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{server.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {server.host}:{server.port}
                                {server.username && ` (${server.username})`}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              {selectedServer && (
                <p className="text-xs text-muted-foreground mt-2">
                  SSH connection will be configured using this server&apos;s settings.
                </p>
              )}
            </div>
          )}

          {(type === 'SSH' || (type === 'FROM_SERVER' && selectedServer)) && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Host</label>
                <Input
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="192.168.1.100"
                  disabled={loading || type === 'FROM_SERVER'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Port
                  </label>
                  <Input
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
                    placeholder="22"
                    disabled={loading || type === 'FROM_SERVER'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Username
                  </label>
                  <Input
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    placeholder="root"
                    disabled={loading || type === 'FROM_SERVER'}
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Terminal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
