'use client';

import { useState } from 'react';
import { Shield, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTeamAuditLogs } from '@/hooks/useTeamHistory';

interface TeamAuditLogsProps {
  teamId: string;
}

const ACTION_LABELS: Record<string, string> = {
  'member.invited': 'Invited member',
  'member.removed': 'Removed member',
  'member.role_changed': 'Changed member role',
  'terminal.shared': 'Shared terminal',
  'terminal.unshared': 'Unshared terminal',
  'workspace.shared': 'Shared workspace',
  'workspace.unshared': 'Unshared workspace',
  'snippet.created': 'Created snippet',
  'snippet.deleted': 'Deleted snippet',
  'server.created': 'Added server',
  'server.deleted': 'Deleted server',
  'task.created': 'Created task',
  'task.updated': 'Updated task',
  'task.deleted': 'Deleted task',
  'team.updated': 'Updated team settings',
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  invited: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  removed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  deleted: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  updated: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  shared: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  unshared: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export function TeamAuditLogs({ teamId }: TeamAuditLogsProps) {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const { logs, loading, error, refetch } = useTeamAuditLogs(teamId);

  const filteredLogs = actionFilter !== 'all'
    ? logs.filter((log) => log.action.startsWith(actionFilter))
    : logs;

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getActionColor = (action: string): string => {
    const actionType = action.split('.')[1] || '';
    return ACTION_COLORS[actionType] || 'bg-gray-100 text-gray-800';
  };

  if (loading && logs.length === 0) {
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'member', 'terminal', 'workspace', 'snippet', 'server', 'task'].map((filter) => (
          <Button
            key={filter}
            variant={actionFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActionFilter(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Button>
        ))}
      </div>

      {/* Audit Log List */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No audit logs</h3>
          <p className="text-sm text-muted-foreground text-center">
            Team activity will be logged here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-4 p-4 rounded-lg border bg-card"
            >
              <div
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium"
              >
                {log.user?.name?.charAt(0).toUpperCase() || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm">{log.user?.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                </div>
                {log.details && (
                  <p className="text-sm text-muted-foreground">
                    {typeof log.details === 'object'
                      ? JSON.stringify(log.details)
                      : String(log.details)}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTime(log.createdAt)}
                  {log.resource && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{log.resource}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
