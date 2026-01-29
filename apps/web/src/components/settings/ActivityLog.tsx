'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  History,
  Terminal,
  Plus,
  Trash2,
  Star,
  Settings,
  Code,
  User,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { auditlogsApi, AuditLog } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ITEMS_PER_PAGE = 20;

const ACTION_ICONS: Record<string, typeof Terminal> = {
  create: Plus,
  delete: Trash2,
  update: Settings,
  favorite: Star,
  login: User,
  snippet: Code,
};

const RESOURCE_LABELS: Record<string, string> = {
  terminal: 'Terminal',
  snippet: 'Snippet',
  profile: 'Profile',
  category: 'Category',
  session: 'Session',
  settings: 'Settings',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

function getActionColor(action: string): string {
  switch (action) {
    case 'create':
      return 'text-green-500';
    case 'delete':
      return 'text-red-500';
    case 'update':
      return 'text-blue-500';
    case 'favorite':
      return 'text-yellow-500';
    default:
      return 'text-muted-foreground';
  }
}

interface ActivityLogProps {
  className?: string;
}

export function ActivityLog({ className }: ActivityLogProps) {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'terminal' | 'snippet' | 'profile'>('all');

  const loadLogs = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      setLoading(true);
      const response = await auditlogsApi.list(session.accessToken, {
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE,
        resource: filter !== 'all' ? filter : undefined,
      });

      if (response.success && response.data) {
        setLogs(response.data.logs);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, page, filter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClear = async () => {
    if (!session?.accessToken) return;
    if (!confirm('Are you sure you want to clear all activity logs?')) return;

    try {
      await auditlogsApi.clear(session.accessToken);
      setLogs([]);
      setTotal(0);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Activity Log</h3>
            <p className="text-sm text-muted-foreground">
              Recent actions in your account
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'terminal', 'snippet', 'profile'] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Logs list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <History size={32} className="mb-2 opacity-50" />
            <p>No activity yet</p>
          </div>
        ) : (
          logs.map((log) => {
            const Icon = ACTION_ICONS[log.action] || Terminal;
            return (
              <div
                key={log.id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center bg-background',
                    getActionColor(log.action)
                  )}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="capitalize font-medium">{log.action}</span>
                    {' '}
                    <span className="text-muted-foreground">
                      {RESOURCE_LABELS[log.resource] || log.resource}
                    </span>
                    {log.details?.name && (
                      <span className="font-medium"> "{log.details.name}"</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(log.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
