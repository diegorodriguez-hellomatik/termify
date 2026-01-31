'use client';

import { useState, useCallback, useMemo } from 'react';
import { TerminalStatus } from '@termify/shared';
import { RefreshCw, Terminal as TerminalIcon, Star, Activity, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileTerminalCard } from './MobileTerminalCard';
import { MobileContentHeader } from './MobileContentHeader';
import { useTerminalStatuses } from '@/hooks/useTerminalStatuses';

interface TerminalData {
  id: string;
  name: string;
  status: TerminalStatus;
  cols: number;
  rows: number;
  createdAt: string;
  lastActiveAt: string | null;
  categoryId: string | null;
  position: number;
  isFavorite?: boolean;
  category?: { id: string; name: string; color: string; icon?: string } | null;
}

interface CategoryData {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

interface MobileTerminalListProps {
  terminals: TerminalData[];
  categories?: CategoryData[];
  onRefresh?: () => Promise<void>;
  onCreateTerminal?: () => void;
  isLoading?: boolean;
}

type StatusFilter = TerminalStatus | null;
type TabFilter = 'all' | 'favorites' | 'working' | string; // string for custom category IDs

const STATUS_BUTTON_COLORS: Record<TerminalStatus, { bg: string; text: string; activeBg: string }> = {
  [TerminalStatus.RUNNING]: {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    activeBg: 'bg-green-500',
  },
  [TerminalStatus.CRASHED]: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    activeBg: 'bg-red-500',
  },
  [TerminalStatus.STOPPED]: {
    bg: 'bg-zinc-400/10',
    text: 'text-zinc-400',
    activeBg: 'bg-zinc-400',
  },
  [TerminalStatus.STARTING]: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    activeBg: 'bg-yellow-500',
  },
};

export function MobileTerminalList({
  terminals,
  categories = [],
  onRefresh,
  onCreateTerminal,
  isLoading = false,
}: MobileTerminalListProps) {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>(null);
  const [selectedTab, setSelectedTab] = useState<TabFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { summary, filterByStatus } = useTerminalStatuses(terminals);

  // Count special categories
  const favoritesCount = useMemo(() =>
    terminals.filter(t => t.isFavorite).length, [terminals]);

  const workingCount = useMemo(() =>
    terminals.filter(t => t.category?.name?.toLowerCase() === 'working').length, [terminals]);

  const handleStatusFilter = useCallback((status: StatusFilter) => {
    setSelectedStatus((prev) => (prev === status ? null : status));
  }, []);

  const handleTabFilter = useCallback((tab: TabFilter) => {
    setSelectedTab(tab);
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

  // Filter by status first
  let filteredTerminals = filterByStatus(terminals, selectedStatus);

  // Then filter by tab
  if (selectedTab === 'favorites') {
    filteredTerminals = filteredTerminals.filter(t => t.isFavorite);
  } else if (selectedTab === 'working') {
    filteredTerminals = filteredTerminals.filter(t => t.category?.name?.toLowerCase() === 'working');
  } else if (selectedTab !== 'all') {
    // Custom category ID
    filteredTerminals = filteredTerminals.filter(t => t.categoryId === selectedTab);
  }

  // Sort: favorites first, then by last activity
  const sortedTerminals = [...filteredTerminals].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    const aTime = a.lastActiveAt || a.createdAt;
    const bTime = b.lastActiveAt || b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return (
    <div className="flex flex-col h-full">
      <MobileContentHeader
        title="Terminals"
        subtitle={`${terminals.length} terminal${terminals.length !== 1 ? 's' : ''}`}
        onCreateClick={onCreateTerminal}
      />

      {/* Category Tabs - horizontal scroll */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {/* All tab */}
          <button
            onClick={() => handleTabFilter('all')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              'min-h-[36px]',
              selectedTab === 'all'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            All
            <span className="opacity-70">({terminals.length})</span>
          </button>

          {/* Favorites tab */}
          {favoritesCount > 0 && (
            <button
              onClick={() => handleTabFilter('favorites')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[36px]',
                selectedTab === 'favorites'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-500/10 text-yellow-600'
              )}
            >
              <Star size={14} className={selectedTab === 'favorites' ? 'fill-white' : 'fill-yellow-500'} />
              Favorites
              <span className="opacity-70">({favoritesCount})</span>
            </button>
          )}

          {/* Working tab */}
          {workingCount > 0 && (
            <button
              onClick={() => handleTabFilter('working')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[36px]',
                selectedTab === 'working'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-500/10 text-blue-500'
              )}
            >
              <Activity size={14} />
              Working
              <span className="opacity-70">({workingCount})</span>
            </button>
          )}

          {/* Custom categories */}
          {categories.filter(c => c.name.toLowerCase() !== 'working').map((category) => {
            const count = terminals.filter(t => t.categoryId === category.id).length;
            if (count === 0) return null;
            return (
              <button
                key={category.id}
                onClick={() => handleTabFilter(category.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  'min-h-[36px]',
                  selectedTab === category.id
                    ? 'text-white'
                    : ''
                )}
                style={{
                  backgroundColor: selectedTab === category.id
                    ? category.color
                    : `${category.color}20`,
                  color: selectedTab === category.id ? 'white' : category.color,
                }}
              >
                {category.name}
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Summary Bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
          {/* All filter */}
          <button
            onClick={() => handleStatusFilter(null)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              'min-h-[36px]',
              selectedStatus === null
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            All
            <span className="opacity-70">{summary.total}</span>
          </button>

          {/* Running filter */}
          {summary.running > 0 && (
            <button
              onClick={() => handleStatusFilter(TerminalStatus.RUNNING)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[36px]',
                selectedStatus === TerminalStatus.RUNNING
                  ? 'bg-green-500 text-white'
                  : 'bg-green-500/10 text-green-500'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  selectedStatus === TerminalStatus.RUNNING
                    ? 'bg-white'
                    : 'bg-green-500'
                )}
              />
              {summary.running}
            </button>
          )}

          {/* Crashed filter */}
          {summary.crashed > 0 && (
            <button
              onClick={() => handleStatusFilter(TerminalStatus.CRASHED)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[36px]',
                selectedStatus === TerminalStatus.CRASHED
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/10 text-red-500'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  selectedStatus === TerminalStatus.CRASHED
                    ? 'bg-white'
                    : 'bg-red-500'
                )}
              />
              {summary.crashed}
            </button>
          )}

          {/* Starting filter */}
          {summary.starting > 0 && (
            <button
              onClick={() => handleStatusFilter(TerminalStatus.STARTING)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[36px]',
                selectedStatus === TerminalStatus.STARTING
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-500/10 text-yellow-500'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full animate-pulse',
                  selectedStatus === TerminalStatus.STARTING
                    ? 'bg-white'
                    : 'bg-yellow-500'
                )}
              />
              {summary.starting}
            </button>
          )}

          {/* Stopped filter */}
          {summary.stopped > 0 && (
            <button
              onClick={() => handleStatusFilter(TerminalStatus.STOPPED)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                'min-h-[36px]',
                selectedStatus === TerminalStatus.STOPPED
                  ? 'bg-zinc-400 text-white'
                  : 'bg-zinc-400/10 text-zinc-400'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  selectedStatus === TerminalStatus.STOPPED
                    ? 'bg-white'
                    : 'bg-zinc-400'
                )}
              />
              {summary.stopped}
            </button>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className={cn(
                'ml-auto p-2 rounded-full transition-all',
                'min-h-[36px] min-w-[36px] flex items-center justify-center',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'disabled:opacity-50'
              )}
            >
              <RefreshCw
                size={18}
                className={cn((isRefreshing || isLoading) && 'animate-spin')}
              />
            </button>
          )}
        </div>
      </div>

      {/* Terminal List */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          // Loading skeleton
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 px-4 flex items-center gap-3 animate-pulse">
                <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted rounded mb-1" />
                  <div className="h-3 w-20 bg-muted rounded" />
                </div>
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : sortedTerminals.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
            <TerminalIcon size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {selectedStatus
                ? `No ${selectedStatus.toLowerCase()} terminals`
                : 'No terminals yet'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {selectedStatus
                ? 'Try selecting a different filter'
                : 'Create a terminal from desktop to get started'}
            </p>
          </div>
        ) : (
          // Terminal cards
          <div className="divide-y divide-border">
            {sortedTerminals.map((terminal) => (
              <MobileTerminalCard key={terminal.id} terminal={terminal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
