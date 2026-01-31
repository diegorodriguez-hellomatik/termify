'use client';

import { useState, useCallback } from 'react';
import {
  Key,
  Trash2,
  Activity,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiKey } from '@/lib/api';
import { MobileContentHeader } from './MobileContentHeader';

interface MobileApiKeyListProps {
  apiKeys: ApiKey[];
  onCreateKey?: () => void;
  onRevokeKey?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

function MobileApiKeyCard({
  apiKey,
  onRevoke,
}: {
  apiKey: ApiKey;
  onRevoke?: (id: string) => void;
}) {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpiringSoon = apiKey.expiresAt &&
    new Date(apiKey.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className={cn(
      'py-3 px-4 bg-card',
      'active:bg-muted transition-colors',
      'touch-manipulation'
    )}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Key size={20} className="text-primary" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">{apiKey.name}</p>
            {isExpiringSoon && (
              <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            {apiKey.keyPrefix}...
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {/* Permissions */}
            <div className="flex gap-1">
              {apiKey.permissions.map((perm) => (
                <span
                  key={perm}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium',
                    perm === 'admin'
                      ? 'bg-red-500/10 text-red-500'
                      : perm === 'write'
                      ? 'bg-yellow-500/10 text-yellow-600'
                      : 'bg-green-500/10 text-green-600'
                  )}
                >
                  {perm}
                </span>
              ))}
            </div>
            {/* Last used */}
            {apiKey.lastUsedAt && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Activity size={10} />
                {formatDate(apiKey.lastUsedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Revoke button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRevoke?.(apiKey.id);
          }}
          className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

export function MobileApiKeyList({
  apiKeys,
  onCreateKey,
  onRevokeKey,
  onRefresh,
  isLoading = false,
}: MobileApiKeyListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  return (
    <div className="flex flex-col h-full">
      <MobileContentHeader
        title="API Keys"
        subtitle={`${apiKeys.length} key${apiKeys.length !== 1 ? 's' : ''}`}
        onCreateClick={onCreateKey}
        onRefreshClick={handleRefresh}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
      />

      {/* API Key List */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          // Loading skeleton
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 px-4 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
                <div className="w-10 h-10 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : apiKeys.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
            <Key size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No API keys yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create an API key to access Termify programmatically
            </p>
          </div>
        ) : (
          // API Key cards
          <div className="divide-y divide-border">
            {apiKeys.map((apiKey) => (
              <MobileApiKeyCard
                key={apiKey.id}
                apiKey={apiKey}
                onRevoke={onRevokeKey}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Reference Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield size={14} />
          <span>Use keys with Authorization: Bearer &lt;key&gt;</span>
        </div>
      </div>
    </div>
  );
}
