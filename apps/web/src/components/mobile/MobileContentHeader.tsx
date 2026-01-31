'use client';

import { ReactNode } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileContentHeaderProps {
  title: string;
  subtitle?: string;
  onCreateClick?: () => void;
  onRefreshClick?: () => void;
  isRefreshing?: boolean;
  isLoading?: boolean;
  /** Custom actions to render instead of default create/refresh buttons */
  actions?: ReactNode;
  /** Additional class names for the container */
  className?: string;
}

export function MobileContentHeader({
  title,
  subtitle,
  onCreateClick,
  onRefreshClick,
  isRefreshing = false,
  isLoading = false,
  actions,
  className,
}: MobileContentHeaderProps) {
  return (
    <div className={cn('px-4 pt-10 pb-3 flex items-center justify-between', className)}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {actions ? (
        actions
      ) : (
        <div className="flex items-center gap-2">
          {onRefreshClick && (
            <button
              onClick={onRefreshClick}
              disabled={isRefreshing || isLoading}
              className={cn(
                'w-10 h-10 rounded-full',
                'flex items-center justify-center',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'disabled:opacity-50 transition-all'
              )}
            >
              <RefreshCw
                size={18}
                className={cn((isRefreshing || isLoading) && 'animate-spin')}
              />
            </button>
          )}
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className={cn(
                'w-10 h-10 rounded-full bg-primary text-primary-foreground',
                'flex items-center justify-center',
                'active:scale-95 transition-transform',
                'shadow-lg'
              )}
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
