'use client';

import { useState, useCallback } from 'react';
import { Server, RefreshCw, Wifi, WifiOff, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { Server as ServerType, ServerStatus } from '@/lib/api';
import { MobileContentHeader } from './MobileContentHeader';

interface MobileServerListProps {
  servers: ServerType[];
  onServerClick?: (server: ServerType) => void;
  onServerConnect?: (serverId: string) => void;
  onCreateServer?: () => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

type StatusFilter = ServerStatus | 'ALL';

const STATUS_CONFIG: Record<ServerStatus | 'UNKNOWN', { color: string; icon: typeof Wifi; label: string }> = {
  ONLINE: { color: 'text-green-500', icon: Wifi, label: 'Online' },
  OFFLINE: { color: 'text-red-500', icon: WifiOff, label: 'Offline' },
  UNKNOWN: { color: 'text-gray-500', icon: Server, label: 'Unknown' },
};

function MobileServerCard({
  server,
  onClick,
  onConnect,
}: {
  server: ServerType;
  onClick?: () => void;
  onConnect?: () => void;
}) {
  // For AGENT type servers (localhost), they're always available
  const status = server.authMethod === 'AGENT'
    ? 'ONLINE'
    : (server.lastStatus || 'UNKNOWN');
  const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.UNKNOWN;
  const StatusIcon = statusConfig.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3',
        'py-3 px-4',
        'bg-card',
        'active:bg-muted transition-colors',
        'touch-manipulation cursor-pointer'
      )}
    >
      {/* Server icon with status */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Server size={20} className="text-primary" />
        </div>
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card',
            status === 'ONLINE' && 'bg-green-500',
            status === 'OFFLINE' && 'bg-red-500',
            status === 'UNKNOWN' && 'bg-gray-500'
          )}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground truncate">{server.name}</p>
          {server.isDefault && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
              Default
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {server.username && `${server.username}@`}
          {server.host}:{server.port}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-xs font-medium', statusConfig.color)}>
            {statusConfig.label}
          </span>
          {server.lastCheckedAt && (
            <>
              <span className="text-muted-foreground text-xs">&bull;</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(server.lastCheckedAt)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Connect button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onConnect?.();
        }}
        className={cn(
          'w-10 h-10 rounded-full bg-primary/10 text-primary',
          'flex items-center justify-center',
          'active:scale-95 transition-transform'
        )}
      >
        <Play size={16} />
      </button>
    </div>
  );
}

export function MobileServerList({
  servers,
  onServerClick,
  onServerConnect,
  onCreateServer,
  onRefresh,
  isLoading = false,
}: MobileServerListProps) {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleStatusFilter = useCallback((status: StatusFilter) => {
    setSelectedStatus(status);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing]);

  // Count servers by status
  const statusCounts = {
    ONLINE: servers.filter((s) => s.authMethod === 'AGENT' || s.lastStatus === 'ONLINE').length,
    OFFLINE: servers.filter((s) => s.authMethod !== 'AGENT' && s.lastStatus === 'OFFLINE').length,
    UNKNOWN: servers.filter((s) => s.authMethod !== 'AGENT' && (!s.lastStatus || s.lastStatus === 'UNKNOWN')).length,
  };

  // Filter servers
  const filteredServers = selectedStatus === 'ALL'
    ? servers
    : servers.filter((s) => {
        const status = s.authMethod === 'AGENT' ? 'ONLINE' : (s.lastStatus || 'UNKNOWN');
        return status === selectedStatus;
      });

  return (
    <div className="flex flex-col h-full">
      <MobileContentHeader
        title="Servers"
        subtitle="Manage SSH connections"
        onCreateClick={onCreateServer}
        onRefreshClick={handleRefresh}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
      />

      {/* Status Filters */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-2 p-3 overflow-x-auto scrollbar-hide">
          {/* All filter */}
          <button
            onClick={() => handleStatusFilter('ALL')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              'min-h-[44px] min-w-[44px]',
              selectedStatus === 'ALL'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            All
            <span className="opacity-70">{servers.length}</span>
          </button>

          {/* Online filter */}
          {statusCounts.ONLINE > 0 && (
            <button
              onClick={() => handleStatusFilter('ONLINE')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[44px] min-w-[44px]',
                selectedStatus === 'ONLINE'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-500/10 text-green-500'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  selectedStatus === 'ONLINE' ? 'bg-white' : 'bg-green-500'
                )}
              />
              {statusCounts.ONLINE}
            </button>
          )}

          {/* Offline filter */}
          {statusCounts.OFFLINE > 0 && (
            <button
              onClick={() => handleStatusFilter('OFFLINE')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[44px] min-w-[44px]',
                selectedStatus === 'OFFLINE'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/10 text-red-500'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  selectedStatus === 'OFFLINE' ? 'bg-white' : 'bg-red-500'
                )}
              />
              {statusCounts.OFFLINE}
            </button>
          )}

          {/* Unknown filter */}
          {statusCounts.UNKNOWN > 0 && (
            <button
              onClick={() => handleStatusFilter('UNKNOWN')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[44px] min-w-[44px]',
                selectedStatus === 'UNKNOWN'
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-500/10 text-gray-500'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  selectedStatus === 'UNKNOWN' ? 'bg-white' : 'bg-gray-500'
                )}
              />
              {statusCounts.UNKNOWN}
            </button>
          )}
        </div>
      </div>

      {/* Server List */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          // Loading skeleton
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 px-4 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
                <div className="w-10 h-10 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredServers.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
            <Server size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {selectedStatus !== 'ALL'
                ? `No ${selectedStatus.toLowerCase()} servers`
                : 'No servers yet'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {selectedStatus !== 'ALL'
                ? 'Try selecting a different filter'
                : 'Add a server to get started'}
            </p>
          </div>
        ) : (
          // Server cards
          <div className="divide-y divide-border">
            {filteredServers.map((server) => (
              <MobileServerCard
                key={server.id}
                server={server}
                onClick={() => onServerClick?.(server)}
                onConnect={() => onServerConnect?.(server.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
