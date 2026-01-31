'use client';

import Link from 'next/link';
import { Terminal as TerminalIcon, Star, StarOff, Trash2, Play, Folder } from 'lucide-react';
import { TerminalStatus } from '@termify/shared';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

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
  isWorking?: boolean;
  category?: { id: string; name: string; color: string; icon?: string } | null;
}

const STATUS_COLORS: Record<TerminalStatus, string> = {
  [TerminalStatus.STOPPED]: 'bg-gray-500',
  [TerminalStatus.STARTING]: 'bg-yellow-500',
  [TerminalStatus.RUNNING]: 'bg-green-500',
  [TerminalStatus.CRASHED]: 'bg-red-500',
};

const STATUS_TEXT_COLORS: Record<TerminalStatus, string> = {
  [TerminalStatus.STOPPED]: 'text-gray-500',
  [TerminalStatus.STARTING]: 'text-yellow-500',
  [TerminalStatus.RUNNING]: 'text-green-500',
  [TerminalStatus.CRASHED]: 'text-red-500',
};

interface TerminalListViewProps {
  terminals: TerminalData[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  isDark: boolean;
}

export function TerminalListView({
  terminals,
  onDelete,
  onToggleFavorite,
  isDark,
}: TerminalListViewProps) {
  if (terminals.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr
            className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
            style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
          >
            <th className="px-4 py-3 rounded-tl-lg">Name</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Size</th>
            <th className="px-4 py-3">Last Active</th>
            <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {terminals.map((terminal) => (
            <tr
              key={terminal.id}
              className={cn(
                'transition-colors group',
                isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
              )}
            >
              {/* Name */}
              <td className="px-4 py-3">
                <Link
                  href={`/terminals/${terminal.id}`}
                  className="flex items-center gap-3"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: terminal.category?.color
                        ? `${terminal.category.color}20`
                        : isDark
                        ? '#333'
                        : '#f0f0f0',
                    }}
                  >
                    <TerminalIcon
                      size={16}
                      style={{
                        color: terminal.category?.color || (isDark ? '#888' : '#666'),
                      }}
                    />
                  </div>
                  <span className="font-medium hover:text-primary transition-colors">
                    {terminal.name}
                  </span>
                </Link>
              </td>

              {/* Category */}
              <td className="px-4 py-3">
                {terminal.category ? (
                  <div
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${terminal.category.color}20`,
                      color: terminal.category.color,
                    }}
                  >
                    <Folder size={10} />
                    {terminal.category.name}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn('w-2 h-2 rounded-full', STATUS_COLORS[terminal.status])}
                  />
                  <span
                    className={cn('text-sm capitalize', STATUS_TEXT_COLORS[terminal.status])}
                  >
                    {terminal.status.toLowerCase()}
                  </span>
                </div>
              </td>

              {/* Size */}
              <td className="px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {terminal.cols}x{terminal.rows}
                </span>
              </td>

              {/* Last Active */}
              <td className="px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {terminal.lastActiveAt
                    ? formatRelativeTime(terminal.lastActiveAt)
                    : formatRelativeTime(terminal.createdAt)}
                </span>
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {/* Favorite button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleFavorite(terminal.id, !terminal.isFavorite);
                    }}
                    className={cn(
                      'p-1.5 rounded-md transition-all',
                      terminal.isFavorite
                        ? 'text-yellow-500 hover:bg-yellow-500/10'
                        : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted'
                    )}
                    title={terminal.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {terminal.isFavorite ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
                  </button>

                  {/* Open button */}
                  <Link
                    href={`/terminals/${terminal.id}`}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    title="Open terminal"
                  >
                    <Play size={16} />
                  </Link>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(terminal.id);
                    }}
                    className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete terminal"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
