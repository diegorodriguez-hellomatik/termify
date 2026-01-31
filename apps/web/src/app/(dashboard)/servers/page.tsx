'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Server as ServerIcon,
  Search,
  X,
  Wifi,
  WifiOff,
  HelpCircle,
  Pencil,
  Trash2,
  Play,
  RefreshCw,
  FileText,
  Tag,
  Cpu,
  HardDrive,
  MemoryStick,
} from 'lucide-react';
import { serversApi, Server, ServerStatus } from '@/lib/api';
import { ServerStats } from '@/context/ServerStatsContext';
import { Button } from '@/components/ui/button';
import { PageLayout, PageHeader, PageContent } from '@/components/ui/page-layout';
import { BlankAreaContextMenu } from '@/components/ui/BlankAreaContextMenu';
import { useTheme } from '@/context/ThemeContext';
import { useServerStatsManager } from '@/context/ServerStatsContext';
import { formatRelativeTime, cn } from '@/lib/utils';
import { CreateServerModal } from '@/components/servers/CreateServerModal';
import { ServerDetailsModal } from '@/components/servers/ServerDetailsModal';
import { MobileServerList } from '@/components/mobile';

const STATUS_COLORS: Record<ServerStatus | 'null', string> = {
  ONLINE: 'bg-green-500',
  OFFLINE: 'bg-red-500',
  UNKNOWN: 'bg-gray-500',
  null: 'bg-gray-500',
};

const STATUS_LABELS: Record<ServerStatus | 'null', string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  UNKNOWN: 'Unknown',
  null: 'Unknown',
};

// Helper to format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Mini stats preview component
function MiniStatsPreview({ stats }: { stats: ServerStats | null }) {
  if (!stats) {
    return (
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Cpu size={12} className="opacity-50" />
          <span className="opacity-50">--</span>
        </span>
        <span className="flex items-center gap-1">
          <MemoryStick size={12} className="opacity-50" />
          <span className="opacity-50">--</span>
        </span>
        <span className="flex items-center gap-1">
          <HardDrive size={12} className="opacity-50" />
          <span className="opacity-50">--</span>
        </span>
      </div>
    );
  }

  const cpuPercent = Math.round(stats.cpuAvg);
  const memPercent = stats.memory.total > 0
    ? Math.round((stats.memory.used / stats.memory.total) * 100)
    : 0;
  const mainDisk = stats.disks?.[0];
  const diskPercent = mainDisk && mainDisk.total > 0
    ? Math.round(((mainDisk.total - mainDisk.available) / mainDisk.total) * 100)
    : 0;

  const getColorClass = (percent: number) => {
    if (percent >= 90) return 'text-red-500';
    if (percent >= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="flex items-center gap-4 text-xs">
      {/* CPU */}
      <div className="flex items-center gap-1.5">
        <Cpu size={12} className={getColorClass(cpuPercent)} />
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getColorClass(cpuPercent).replace('text-', 'bg-'))}
              style={{ width: `${cpuPercent}%` }}
            />
          </div>
          <span className={cn('w-8 text-right', getColorClass(cpuPercent))}>{cpuPercent}%</span>
        </div>
      </div>

      {/* Memory */}
      <div className="flex items-center gap-1.5">
        <MemoryStick size={12} className={getColorClass(memPercent)} />
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getColorClass(memPercent).replace('text-', 'bg-'))}
              style={{ width: `${memPercent}%` }}
            />
          </div>
          <span className={cn('w-8 text-right', getColorClass(memPercent))}>{memPercent}%</span>
        </div>
      </div>

      {/* Disk */}
      <div className="flex items-center gap-1.5">
        <HardDrive size={12} className={getColorClass(diskPercent)} />
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getColorClass(diskPercent).replace('text-', 'bg-'))}
              style={{ width: `${diskPercent}%` }}
            />
          </div>
          <span className={cn('w-8 text-right', getColorClass(diskPercent))}>{diskPercent}%</span>
        </div>
      </div>
    </div>
  );
}

function ServerCard({
  server,
  onCheck,
  onConnect,
  onClick,
  onDelete,
  isChecking,
  isDark,
  stats,
  terminalCount,
}: {
  server: Server;
  onCheck: (id: string) => void;
  onConnect: (id: string) => void;
  onClick: (server: Server) => void;
  onDelete: (id: string) => void;
  isChecking: boolean;
  isDark: boolean;
  stats: ServerStats | null;
  terminalCount: number;
}) {
  // For AGENT type servers (localhost), they're always available - no SSH check needed
  const status = server.authMethod === 'AGENT'
    ? 'ONLINE'
    : (server.lastStatus || 'UNKNOWN');

  return (
    <div
      onClick={() => onClick(server)}
      className={cn(
        'group relative bg-card border border-border rounded-xl overflow-hidden cursor-pointer',
        'transition-all duration-200 hover:border-primary/50 hover:shadow-md'
      )}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isDark ? 'bg-primary/20' : 'bg-primary/10'
              )}
            >
              <ServerIcon size={20} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{server.name}</h3>
                {server.isDefault && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {server.host}:{server.port}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                STATUS_COLORS[status as keyof typeof STATUS_COLORS]
              )}
              title={STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
            />
          </div>
        </div>

        {/* Auth method */}
        <div className="text-xs text-muted-foreground mb-3">
          {server.username && <span>{server.username}@</span>}
          <span className="capitalize">{server.authMethod.toLowerCase()}</span>
        </div>

        {/* Tags */}
        {server.tags && server.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {server.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground"
              >
                <Tag size={10} />
                {tag}
              </span>
            ))}
            {server.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{server.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {server.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {server.description}
          </p>
        )}

        {/* Mini Stats Preview */}
        {status === 'ONLINE' && (
          <div className="mb-3 py-2 px-3 bg-muted/50 rounded-lg">
            <MiniStatsPreview stats={stats} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <span>
            {server.lastCheckedAt
              ? `Checked ${formatRelativeTime(server.lastCheckedAt)}`
              : 'Never checked'}
          </span>
          {terminalCount > 0 && (
            <span className="text-green-600 dark:text-green-400 font-medium">
              {terminalCount} active {terminalCount === 1 ? 'terminal' : 'terminals'}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCheck(server.id);
            }}
            disabled={isChecking}
            className={cn(
              'flex-1 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm',
              isChecking && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshCw size={14} className={cn(isChecking && 'animate-spin')} />
            Check
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConnect(server.id);
            }}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Play size={14} />
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { isDark } = useTheme();
  const { subscribeMany, getServerStats } = useServerStatsManager();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [checkingServers, setCheckingServers] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"], [data-no-context-menu]')) {
      return;
    }
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const loadServers = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      const response = await serversApi.list(session.accessToken);
      if (response.success && response.data) {
        setServers(response.data.servers);

        // Subscribe to stats for online servers (persistent WebSocket connection)
        const onlineServerIds = response.data.servers
          .filter((s: Server) => s.lastStatus === 'ONLINE' || s.authMethod === 'AGENT')
          .map((s: Server) => s.id);

        if (onlineServerIds.length > 0) {
          subscribeMany(onlineServerIds);
        }
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, subscribeMany]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleCheckServer = async (id: string) => {
    if (!session?.accessToken || checkingServers.has(id)) return;

    setCheckingServers((prev) => new Set(prev).add(id));

    try {
      const response = await serversApi.test(id, session.accessToken);
      if (response.success && response.data) {
        // Update server status in list
        setServers((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  lastStatus: response.data!.status,
                  lastCheckedAt: response.data!.checkedAt,
                }
              : s
          )
        );
      }
    } catch (error) {
      console.error('Failed to check server:', error);
    } finally {
      setCheckingServers((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleConnectServer = (id: string) => {
    // Navigate to ephemeral terminal page - credentials will be asked there if needed
    router.push(`/servers/${id}/terminal`);
  };

  const handleDeleteServer = async (id: string) => {
    if (!session?.accessToken) return;

    try {
      const response = await serversApi.delete(id, session.accessToken);
      if (response.success) {
        setServers((prev) => prev.filter((s) => s.id !== id));
        setSelectedServer(null);
      }
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
  };

  const handleServerCreated = (server: Server) => {
    setServers((prev) => [...prev, server]);
    setShowCreateModal(false);
  };

  const handleServerUpdated = (updatedServer: Server) => {
    setServers((prev) =>
      prev.map((s) => (s.id === updatedServer.id ? updatedServer : s))
    );
  };

  // Filter servers by search
  const filteredServers = servers.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.host.toLowerCase().includes(query) ||
      s.description?.toLowerCase().includes(query) ||
      s.tags?.some((t) => t.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <>
        {/* Mobile loading */}
        <div className="md:hidden h-full">
          <MobileServerList
            servers={[]}
            isLoading={true}
          />
        </div>
        {/* Desktop loading */}
        <div className="hidden md:block">
          <PageLayout>
            <PageHeader title="Servers" description="Manage your SSH server connections" />
            <PageContent>
              <div className="animate-pulse space-y-4">
                <div className="h-10 w-64 bg-muted rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 bg-muted rounded-xl" />
                  ))}
                </div>
              </div>
            </PageContent>
          </PageLayout>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden h-full">
        <MobileServerList
          servers={filteredServers}
          onServerClick={setSelectedServer}
          onServerConnect={handleConnectServer}
          onCreateServer={() => setShowCreateModal(true)}
          onRefresh={loadServers}
          isLoading={loading}
        />
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <PageLayout>
          <PageHeader
            title="Servers"
            description="Manage your SSH server connections"
            actions={
              <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={16} />
                New Server
              </Button>
            }
          />
          <PageContent>
            <div onContextMenu={handleContextMenu} className="min-h-[calc(100vh-220px)]">
            {/* Search bar */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search servers..."
                  className="w-full h-9 pl-10 pr-8 text-sm rounded-md border border-border bg-background focus:outline-none focus:border-primary focus:shadow-sm transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Server grid */}
            {filteredServers.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <ServerIcon size={32} className="text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">
                  {searchQuery ? 'No servers found' : 'No servers yet'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Add your first server to get started.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServers.map((server, index) => (
                  <div
                    key={server.id}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                      animationDelay: `${Math.min(index * 30, 300)}ms`,
                      animationFillMode: 'both',
                    }}
                  >
                    <ServerCard
                      server={server}
                      onCheck={handleCheckServer}
                      onConnect={handleConnectServer}
                      onClick={setSelectedServer}
                      onDelete={handleDeleteServer}
                      isChecking={checkingServers.has(server.id)}
                      isDark={isDark}
                      stats={getServerStats(server.id).stats}
                      terminalCount={getServerStats(server.id).terminalCount}
                    />
                  </div>
                ))}
              </div>
            )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
              <BlankAreaContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                onAction={() => setShowCreateModal(true)}
                actionLabel="New Server"
              />
            )}
          </PageContent>
        </PageLayout>
      </div>

      {/* Modals - Available on both mobile and desktop */}
      <CreateServerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleServerCreated}
        isDark={isDark}
        token={session?.accessToken}
      />

      {/* Server Details Modal */}
      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          isOpen={true}
          onClose={() => setSelectedServer(null)}
          onConnect={handleConnectServer}
          onDelete={handleDeleteServer}
          onUpdated={handleServerUpdated}
          isDark={isDark}
          token={session?.accessToken}
        />
      )}
    </>
  );
}
