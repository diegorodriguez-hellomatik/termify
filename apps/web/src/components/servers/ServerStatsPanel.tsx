'use client';

import { useMemo } from 'react';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Activity,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useServerStats, formatBytes, formatPercent } from '@/hooks/useServerStats';
import { cn } from '@/lib/utils';

interface ServerStatsPanelProps {
  serverId: string;
  className?: string;
}

export function ServerStatsPanel({ serverId, className }: ServerStatsPanelProps) {
  const { stats, isConnected, isConnecting, error, history } = useServerStats(serverId);

  // CPU chart data (last 30 points)
  const cpuHistory = useMemo(() => {
    return history.slice(-30).map((s) => s.cpuAvg);
  }, [history]);

  // Memory usage percentage
  const memoryPercent = useMemo(() => {
    if (!stats?.memory) return 0;
    return formatPercent(stats.memory.used, stats.memory.total);
  }, [stats]);

  // Swap usage percentage
  const swapPercent = useMemo(() => {
    if (!stats?.memory || stats.memory.swapTotal === 0) return 0;
    return formatPercent(stats.memory.swapUsed, stats.memory.swapTotal);
  }, [stats]);

  if (isConnecting) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <Loader2 size={32} className="animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Connecting to server...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <AlertCircle size={32} className="text-red-500 mb-3" />
        <p className="text-sm text-red-500 font-medium">Connection Error</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <Activity size={32} className="text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Waiting for stats...</p>
        <p className="text-xs text-muted-foreground mt-1">
          Make sure stats-agent is installed on the server
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Connection status */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi size={14} className="text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Live</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Disconnected</span>
            </>
          )}
        </div>
        {stats.os && (
          <span className="text-xs text-muted-foreground">
            {stats.os.name} {stats.os.version}
          </span>
        )}
      </div>

      {/* CPU */}
      <div className="p-4 rounded-lg bg-muted/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-blue-500" />
            <span className="text-sm font-medium">CPU</span>
          </div>
          <span className="text-lg font-bold">{stats.cpuAvg.toFixed(1)}%</span>
        </div>

        {/* Mini chart */}
        <div className="h-10 flex items-end gap-0.5">
          {cpuHistory.map((value, i) => (
            <div
              key={i}
              className="flex-1 rounded-t transition-all duration-300"
              style={{
                height: `${Math.max(value, 2)}%`,
                backgroundColor:
                  value > 80
                    ? 'rgb(239 68 68)'
                    : value > 60
                    ? 'rgb(234 179 8)'
                    : 'rgb(59 130 246)',
                opacity: 0.3 + (i / cpuHistory.length) * 0.7,
              }}
            />
          ))}
        </div>

        {/* Per-core usage */}
        {stats.cpu.length > 1 && (
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
            {stats.cpu.slice(0, 8).map((usage, i) => (
              <div key={i} className="text-center">
                <div className="text-[10px] text-muted-foreground mb-1">Core {i}</div>
                <div
                  className={cn(
                    'text-xs font-medium',
                    usage > 80
                      ? 'text-red-500'
                      : usage > 60
                      ? 'text-yellow-500'
                      : 'text-foreground'
                  )}
                >
                  {usage.toFixed(0)}%
                </div>
              </div>
            ))}
            {stats.cpu.length > 8 && (
              <div className="text-center text-xs text-muted-foreground col-span-4">
                +{stats.cpu.length - 8} more cores
              </div>
            )}
          </div>
        )}
      </div>

      {/* Memory */}
      <div className="p-4 rounded-lg bg-muted/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MemoryStick size={16} className="text-purple-500" />
            <span className="text-sm font-medium">Memory</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}
          </span>
        </div>

        {/* RAM bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">RAM</span>
            <span className={cn(
              'font-medium',
              memoryPercent > 90 ? 'text-red-500' : memoryPercent > 70 ? 'text-yellow-500' : ''
            )}>
              {memoryPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                memoryPercent > 90
                  ? 'bg-red-500'
                  : memoryPercent > 70
                  ? 'bg-yellow-500'
                  : 'bg-purple-500'
              )}
              style={{ width: `${memoryPercent}%` }}
            />
          </div>
        </div>

        {/* Swap bar */}
        {stats.memory.swapTotal > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Swap</span>
              <span className="text-muted-foreground">
                {formatBytes(stats.memory.swapUsed)} / {formatBytes(stats.memory.swapTotal)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-500/50 transition-all duration-500"
                style={{ width: `${swapPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Disks */}
      {stats.disks.length > 0 && (
        <div className="p-4 rounded-lg bg-muted/50 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-green-500" />
            <span className="text-sm font-medium">Disks</span>
          </div>

          <div className="space-y-3">
            {stats.disks.map((disk, i) => {
              const used = disk.total - disk.available;
              const usedPercent = formatPercent(used, disk.total);
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-mono">{disk.name || 'disk'}</span>
                    <span className="text-muted-foreground">
                      {formatBytes(used)} / {formatBytes(disk.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        usedPercent > 90
                          ? 'bg-red-500'
                          : usedPercent > 80
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      )}
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Network */}
      {stats.network.length > 0 && (
        <div className="p-4 rounded-lg bg-muted/50 space-y-3">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-orange-500" />
            <span className="text-sm font-medium">Network</span>
          </div>

          <div className="space-y-2">
            {stats.network.slice(0, 3).map((iface, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">{iface.interface}</span>
                <div className="flex items-center gap-4">
                  <span className="text-green-600 dark:text-green-400">
                    ↓ {formatBytes(iface.rxBytes)}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    ↑ {formatBytes(iface.txBytes)}
                  </span>
                </div>
              </div>
            ))}
            {stats.network.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{stats.network.length - 3} more interfaces
              </p>
            )}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-[10px] text-muted-foreground text-center">
        Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
}
