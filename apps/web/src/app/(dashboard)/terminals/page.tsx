'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Terminal as TerminalIcon,
  Trash2,
  Play,
  Folder,
  FolderPlus,
  X,
  Pencil,
  Check,
  Copy,
  Star,
  StarOff,
  LayoutGrid,
  Grid3x3,
  List,
  Search,
  Keyboard,
  Users,
  Share2,
  Eye,
  Edit3,
  User,
} from 'lucide-react';
import { TerminalStatus } from '@termify/shared';
import { terminalsApi, categoriesApi, shareApi, SharedTerminal } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { TerminalListView } from '@/components/terminals/TerminalListView';
import { TerminalThemeSelector } from '@/components/settings/TerminalThemeSelector';
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import { ShortcutsHelpModalWithContext } from '@/components/ui/ShortcutsHelpModal';
import { CreateTerminalModal, SSHConfig } from '@/components/terminals/CreateTerminalModal';
import { ShareTerminalModal } from '@/components/terminals/ShareTerminalModal';
import { MobileTerminalList } from '@/components/mobile/MobileTerminalList';
import { cn } from '@/lib/utils';

// Context Menu Component
function ContextMenu({
  x,
  y,
  terminal,
  onClose,
  onConnect,
  onRename,
  onShare,
  onDelete,
  isDark,
}: {
  x: number;
  y: number;
  terminal: TerminalData;
  onClose: () => void;
  onConnect: () => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
  isDark: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 200);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] py-1 rounded-lg shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: adjustedX,
        top: adjustedY,
        backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
      }}
    >
      <button
        onClick={() => {
          onConnect();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
      >
        <Play size={16} className="text-green-500" />
        <span>Connect</span>
      </button>
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
      >
        <Pencil size={16} className="text-blue-500" />
        <span>Rename</span>
      </button>
      <button
        onClick={() => {
          onShare();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
      >
        <Share2 size={16} className="text-purple-500" />
        <span>Share</span>
      </button>
      <div className="h-px bg-border my-1" />
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-destructive/10 transition-colors text-left text-destructive"
      >
        <Trash2 size={16} />
        <span>Delete</span>
      </button>
    </div>,
    document.body
  );
}

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
  position: number;
  terminalCount: number;
}

const STATUS_COLORS: Record<TerminalStatus, string> = {
  [TerminalStatus.STOPPED]: 'bg-gray-500',
  [TerminalStatus.STARTING]: 'bg-yellow-500',
  [TerminalStatus.RUNNING]: 'bg-green-500',
  [TerminalStatus.CRASHED]: 'bg-red-500',
};

// Draggable Terminal Card Component - Smooth free movement
function DraggableTerminalCard({
  terminal,
  onDelete,
  onRename,
  onToggleFavorite,
  onContextMenu,
  onConnect,
  isRenaming,
  onRenameComplete,
  isDark,
  isCompact,
}: {
  terminal: TerminalData;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onContextMenu?: (e: React.MouseEvent, terminal: TerminalData) => void;
  onConnect?: (id: string) => void;
  isRenaming?: boolean;
  onRenameComplete?: () => void;
  isDark: boolean;
  isCompact?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(terminal.name);

  // Trigger edit mode from external prop
  useEffect(() => {
    if (isRenaming && !isEditing) {
      setIsEditing(true);
      setEditName(terminal.name);
    }
  }, [isRenaming, isEditing, terminal.name]);

  const handleFinishEditing = (save: boolean) => {
    if (save && editName !== terminal.name) {
      onRename(terminal.id, editName);
    } else {
      setEditName(terminal.name);
    }
    setIsEditing(false);
    onRenameComplete?.();
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: terminal.id,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  // Combine dnd-kit transition with hover transitions for border/shadow
  const baseTransition = 'border-color 200ms, box-shadow 200ms';
  const combinedTransition = isDragging ? undefined : (transition ? `${transition}, ${baseTransition}` : baseTransition);

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition: combinedTransition,
    zIndex: isDragging ? 1000 : 1,
  };

  if (isCompact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          if (!isDragging) {
            onConnect?.(terminal.id);
          }
        }}
        onContextMenu={(e) => {
          if (onContextMenu) {
            e.preventDefault();
            onContextMenu(e, terminal);
          }
        }}
        className={cn(
          'group relative bg-card border border-border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing',
          !isDragging && 'transition-shadow transition-border duration-200 hover:border-primary/50 hover:shadow-md',
          isDragging && 'shadow-2xl ring-2 ring-primary/50'
        )}
      >
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: terminal.category?.color
                    ? `${terminal.category.color}20`
                    : isDark
                    ? '#333'
                    : '#f0f0f0',
                }}
              >
                <TerminalIcon
                  size={14}
                  style={{ color: terminal.category?.color || (isDark ? '#888' : '#666') }}
                />
              </div>

              <span className="font-medium text-sm truncate max-w-[120px]">{terminal.name}</span>
              <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[terminal.status])} />
            </div>

            <div className="flex items-center gap-1">
              {/* Favorite button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(terminal.id, !terminal.isFavorite);
                }}
                className={cn(
                  'p-1 rounded transition-all',
                  terminal.isFavorite
                    ? 'text-yellow-500'
                    : 'text-muted-foreground hover:text-yellow-500'
                )}
              >
                {terminal.isFavorite ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onConnect?.(terminal.id);
                }}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <Play size={14} />
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(terminal.id);
                }}
                className="p-1 hover:bg-destructive/10 rounded transition-all"
              >
                <Trash2 size={12} className="text-destructive" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          onConnect?.(terminal.id);
        }
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, terminal);
        }
      }}
      className={cn(
        'group relative bg-card border border-border rounded-xl overflow-hidden cursor-grab active:cursor-grabbing',
        !isDragging && 'transition-shadow transition-border duration-200 hover:border-primary/50 hover:shadow-md',
        isDragging && 'shadow-2xl ring-2 ring-primary/50'
      )}
    >
      <div className="p-5">
        {/* Header row with terminal info and action buttons */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: terminal.category?.color
                  ? `${terminal.category.color}20`
                  : isDark
                  ? '#333'
                  : '#f0f0f0',
              }}
            >
              <TerminalIcon
                size={20}
                style={{ color: terminal.category?.color || (isDark ? '#888' : '#666') }}
              />
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2 py-1 text-sm font-semibold rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary w-32"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleFinishEditing(true);
                      }
                      if (e.key === 'Escape') {
                        handleFinishEditing(false);
                      }
                    }}
                    onBlur={() => handleFinishEditing(true)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-foreground">{terminal.name}</h3>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                  >
                    <Pencil size={12} className="text-muted-foreground" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {terminal.cols}x{terminal.rows}
              </p>
            </div>
          </div>
          {/* Status and action buttons */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[terminal.status]}`} />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(terminal.id, !terminal.isFavorite);
              }}
              className={cn(
                'p-1.5 rounded-md transition-all',
                terminal.isFavorite
                  ? 'text-yellow-500 bg-yellow-500/10'
                  : 'text-muted-foreground hover:text-yellow-500 hover:bg-muted'
              )}
              title={terminal.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {terminal.isFavorite ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(terminal.id);
              }}
              className="p-1.5 hover:bg-destructive/10 rounded-md transition-all"
              title="Delete terminal"
            >
              <Trash2 size={16} className="text-destructive" />
            </button>
          </div>
        </div>

        {/* Category badge - fixed height to keep cards uniform */}
        <div className="h-7 mb-3">
          {terminal.category && (
            <div
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${terminal.category.color}20`,
                color: terminal.category.color,
              }}
            >
              <Folder size={12} />
              {terminal.category.name}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <span>
            {terminal.lastActiveAt
              ? `Active ${formatRelativeTime(terminal.lastActiveAt)}`
              : `Created ${formatRelativeTime(terminal.createdAt)}`}
          </span>
          <span className="capitalize">{terminal.status.toLowerCase()}</span>
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onConnect?.(terminal.id);
          }}
          className="w-full py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2 font-medium text-sm"
        >
          {terminal.status === TerminalStatus.RUNNING ? (
            <>
              <Play size={14} />
              Connect
            </>
          ) : (
            <>
              <TerminalIcon size={14} />
              Open
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Shared Terminal Card Component
function SharedTerminalCard({
  terminal,
  onConnect,
  isDark,
  isCompact,
  hideOwner,
}: {
  terminal: SharedTerminal;
  onConnect?: (id: string) => void;
  isDark: boolean;
  isCompact?: boolean;
  hideOwner?: boolean;
}) {
  const STATUS_COLORS_SHARED: Record<string, string> = {
    STOPPED: 'bg-gray-500',
    STARTING: 'bg-yellow-500',
    RUNNING: 'bg-green-500',
    CRASHED: 'bg-red-500',
  };

  if (isCompact) {
    return (
      <div
        className={cn(
          'group relative bg-card border border-border rounded-lg overflow-hidden cursor-pointer',
          'transition-all duration-200 hover:border-primary/50 hover:shadow-md'
        )}
        onClick={() => onConnect?.(terminal.id)}
      >
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: terminal.category?.color
                    ? `${terminal.category.color}20`
                    : isDark
                    ? '#333'
                    : '#f0f0f0',
                }}
              >
                <TerminalIcon
                  size={14}
                  style={{ color: terminal.category?.color || (isDark ? '#888' : '#666') }}
                />
              </div>
              <span className="font-medium text-sm truncate max-w-[120px]">{terminal.name}</span>
              <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS_SHARED[terminal.status] || 'bg-gray-500')} />
            </div>
            <div className="flex items-center gap-1">
              {/* Permission badge */}
              <span
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                  terminal.share.permission === 'CONTROL'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-blue-500/10 text-blue-500'
                )}
              >
                {terminal.share.permission === 'CONTROL' ? (
                  <Edit3 size={10} />
                ) : (
                  <Eye size={10} />
                )}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConnect?.(terminal.id);
                }}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <Play size={14} />
              </button>
            </div>
          </div>
          {/* Owner info - hidden when grouped by owner */}
          {!hideOwner && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <User size={10} />
              <span className="truncate">{terminal.user.name || terminal.user.email}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative bg-card border border-border rounded-xl overflow-hidden cursor-pointer',
        'transition-all duration-200 hover:border-primary/50 hover:shadow-md'
      )}
      onClick={() => onConnect?.(terminal.id)}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: terminal.category?.color
                  ? `${terminal.category.color}20`
                  : isDark
                  ? '#333'
                  : '#f0f0f0',
              }}
            >
              <TerminalIcon
                size={20}
                style={{ color: terminal.category?.color || (isDark ? '#888' : '#666') }}
              />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{terminal.name}</h3>
              <p className="text-xs text-muted-foreground">
                {terminal.cols}x{terminal.rows}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Permission Badge */}
            <span
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                terminal.share.permission === 'CONTROL'
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-blue-500/10 text-blue-500'
              )}
            >
              {terminal.share.permission === 'CONTROL' ? (
                <>
                  <Edit3 size={12} />
                  Control
                </>
              ) : (
                <>
                  <Eye size={12} />
                  View
                </>
              )}
            </span>
            <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS_SHARED[terminal.status] || 'bg-gray-500')} />
          </div>
        </div>

        {/* Owner info - hidden when grouped by owner */}
        {!hideOwner && (
          <div
            className="flex items-center gap-2 py-2 px-3 rounded-lg mb-4"
            style={{ backgroundColor: isDark ? '#262626' : '#f5f5f5' }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: isDark ? '#444' : '#ddd' }}
            >
              {terminal.user.image ? (
                <img
                  src={terminal.user.image}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <User size={12} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: isDark ? '#ccc' : '#444' }}>
                {terminal.user.name || terminal.user.email}
              </p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">Owner</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <span>Shared {formatRelativeTime(new Date(terminal.share.createdAt))}</span>
          <span className="capitalize">{terminal.status.toLowerCase()}</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onConnect?.(terminal.id);
          }}
          className="w-full py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2 font-medium text-sm"
        >
          {terminal.status === 'RUNNING' ? (
            <>
              <Play size={14} />
              Connect
            </>
          ) : (
            <>
              <TerminalIcon size={14} />
              Open
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  terminal,
  onConfirm,
  onCancel,
  isDark,
}: {
  terminal: TerminalData;
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [copied, setCopied] = useState(false);
  const canDelete = confirmText === terminal.name;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(terminal.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-xl shadow-2xl scale-in overflow-hidden"
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
            >
              <Trash2 size={20} className="text-red-500" />
            </div>
            <div>
              <h3
                className="text-lg font-semibold"
                style={{ color: isDark ? '#fff' : '#1a1a1a' }}
              >
                Delete Terminal
              </h3>
              <p
                className="text-sm"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                This action cannot be undone
              </p>
            </div>
          </div>

          {/* Content */}
          <p
            className="text-sm mb-3"
            style={{ color: isDark ? '#ccc' : '#444' }}
          >
            To confirm deletion, type the terminal name below:
          </p>

          {/* Terminal name with copy button */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg mb-4"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
          >
            <span className="font-mono font-semibold text-red-500">
              {terminal.name}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
              title="Copy name"
            >
              {copied ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <Copy size={16} className="text-red-500" />
              )}
            </button>
          </div>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type terminal name to confirm"
            className="w-full px-4 py-3 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
            style={{
              backgroundColor: isDark ? '#0a0a0a' : '#f9f9f9',
              borderColor: isDark ? '#333' : '#e0e0e0',
              color: isDark ? '#fff' : '#1a1a1a',
            }}
            autoFocus
          />

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
              style={{
                backgroundColor: isDark ? '#333' : '#f0f0f0',
                color: isDark ? '#fff' : '#1a1a1a',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canDelete}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: canDelete ? '#ef4444' : isDark ? '#333' : '#ccc',
                color: '#fff',
              }}
            >
              Delete Terminal
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Droppable Category Component
function DroppableCategory({
  id,
  children,
  isOver,
}: {
  id: string;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 ${
        isOver ? 'scale-110 ring-2 ring-primary ring-offset-2 rounded-full' : ''
      }`}
    >
      {children}
    </div>
  );
}

// View Mode Toggle
function ViewModeToggle({
  viewMode,
  onChange,
  isDark,
}: {
  viewMode: 'grid' | 'compact' | 'list';
  onChange: (mode: 'grid' | 'compact' | 'list') => void;
  isDark: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg border border-border"
      style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
    >
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'p-1.5 rounded transition-all',
          viewMode === 'grid'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title="Grid view"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        onClick={() => onChange('compact')}
        className={cn(
          'p-1.5 rounded transition-all',
          viewMode === 'compact'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title="Compact view"
      >
        <Grid3x3 size={16} />
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn(
          'p-1.5 rounded transition-all',
          viewMode === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title="List view"
      >
        <List size={16} />
      </button>
    </div>
  );
}

// Inner component that uses keyboard shortcuts
function TerminalsPageContent({ triggerCreate }: { triggerCreate?: boolean }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { isDark, viewMode, setViewMode } = useTheme();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [terminals, setTerminals] = useState<TerminalData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Navigate to terminal with transition
  const navigateToTerminal = useCallback((terminalId: string) => {
    setIsNavigating(true);
    setTimeout(() => {
      router.push(`/terminals/${terminalId}`);
    }, 100);
  }, [router]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSharedOnly, setShowSharedOnly] = useState(false);
  const [sharedTerminals, setSharedTerminals] = useState<SharedTerminal[]>([]);
  const [terminalToDelete, setTerminalToDelete] = useState<TerminalData | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    terminal: TerminalData;
  } | null>(null);
  const [terminalToShare, setTerminalToShare] = useState<TerminalData | null>(null);
  const [terminalToRename, setTerminalToRename] = useState<string | null>(null);

  const { setShowHelp } = useKeyboardShortcuts();

  // DnD sensors - minimal distance for responsive drag (same as workspaces)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      const [terminalsRes, categoriesRes, sharedRes] = await Promise.all([
        terminalsApi.list(session.accessToken),
        categoriesApi.list(session.accessToken),
        shareApi.getSharedWithMe(session.accessToken),
      ]);

      if (terminalsRes.success && terminalsRes.data) {
        setTerminals(terminalsRes.data.terminals);
      }
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data.categories);
      }
      if (sharedRes.success && sharedRes.data) {
        setSharedTerminals(sharedRes.data.terminals);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal when triggered by keyboard shortcut
  useEffect(() => {
    if (triggerCreate) {
      setShowCreateModal(true);
    }
  }, [triggerCreate]);

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
  };

  const handleCreateLocalTerminal = async () => {
    if (!session?.accessToken) return;

    setShowCreateModal(false);
    setCreating(true);
    try {
      const response = await terminalsApi.create(
        {
          name: `Terminal ${terminals.length + 1}`,
          categoryId: selectedCategory || undefined,
        },
        session.accessToken
      );

      if (response.success && response.data) {
        // Redirect immediately to terminal page (spinner will show there)
        navigateToTerminal(response.data.id);
      }
    } catch (error) {
      console.error('Failed to create terminal:', error);
      setCreating(false);
    }
  };

  const handleCreateSSHTerminal = async (config: SSHConfig) => {
    // The modal now creates the terminal via API
    // Just reload data and navigate
    setShowCreateModal(false);
    setCreating(true);

    // Reload the terminal list to get the new SSH terminal
    await loadData();

    // Find the newest terminal (should be the SSH one just created)
    if (session?.accessToken) {
      try {
        const response = await terminalsApi.list(session.accessToken);
        const terminalsList = response.data?.terminals;
        if (response.success && terminalsList && terminalsList.length > 0) {
          // Find the SSH terminal we just created by name
          const sshTerminal = terminalsList.find(
            (t: any) => t.name === (config.name || `${config.username}@${config.host}`)
          );
          if (sshTerminal) {
            navigateToTerminal(sshTerminal.id);
            return;
          }
          // Fallback to the most recent terminal
          const newest = [...terminalsList].sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          if (newest) {
            navigateToTerminal(newest.id);
          }
        }
      } catch (error) {
        console.error('Failed to find created SSH terminal:', error);
      } finally {
        setCreating(false);
      }
    }
  };

  const handleDeleteTerminal = (id: string) => {
    const terminal = terminals.find((t) => t.id === id);
    if (terminal) {
      setTerminalToDelete(terminal);
    }
  };

  const confirmDeleteTerminal = async () => {
    if (!session?.accessToken || !terminalToDelete) return;

    const idToDelete = terminalToDelete.id;

    try {
      const response = await terminalsApi.delete(idToDelete, session.accessToken);
      if (response.success) {
        // Use functional update to ensure we have the latest state
        setTerminals((prev) => prev.filter((t) => t.id !== idToDelete));
      }
    } catch (error) {
      console.error('Failed to delete terminal:', error);
    } finally {
      setTerminalToDelete(null);
    }
  };

  const handleRenameTerminal = async (id: string, newName: string) => {
    if (!session?.accessToken || !newName.trim()) return;

    try {
      const response = await terminalsApi.update(id, { name: newName.trim() }, session.accessToken);
      if (response.success) {
        setTerminals(terminals.map((t) => (t.id === id ? { ...t, name: newName.trim() } : t)));
      }
    } catch (error) {
      console.error('Failed to rename terminal:', error);
    }
  };

  const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
    if (!session?.accessToken) return;

    // Optimistic update
    setTerminals((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isFavorite } : t))
    );

    try {
      const response = await terminalsApi.toggleFavorite(id, isFavorite, session.accessToken);
      if (!response.success) {
        // Revert on error
        setTerminals((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isFavorite: !isFavorite } : t))
        );
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // Revert on error
      setTerminals((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isFavorite: !isFavorite } : t))
      );
    }
  };

  const handleContextMenu = (e: React.MouseEvent, terminal: TerminalData) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      terminal,
    });
  };

  const handleContextMenuConnect = () => {
    if (contextMenu) {
      navigateToTerminal(contextMenu.terminal.id);
    }
  };

  const handleContextMenuRename = () => {
    if (contextMenu) {
      setTerminalToRename(contextMenu.terminal.id);
    }
  };

  const handleContextMenuShare = () => {
    if (contextMenu) {
      setTerminalToShare(contextMenu.terminal);
    }
  };

  const handleContextMenuDelete = () => {
    if (contextMenu) {
      handleDeleteTerminal(contextMenu.terminal.id);
    }
  };

  const handleCreateCategory = async () => {
    if (!session?.accessToken || !newCategoryName.trim()) return;

    setCreatingCategory(true);
    try {
      const response = await categoriesApi.create(
        { name: newCategoryName.trim() },
        session.accessToken
      );

      if (response.success && response.data) {
        setCategories([...categories, response.data]);
        setNewCategoryName('');
        setShowCategoryInput(false);
      }
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!session?.accessToken) return;

    try {
      const response = await categoriesApi.delete(id, session.accessToken);
      if (response.success) {
        setCategories(categories.filter((c) => c.id !== id));
        if (selectedCategory === id) {
          setSelectedCategory(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleDragOver = (event: DragEndEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setOverId(null);

    if (!over) return;

    const activeTerminal = terminals.find((t) => t.id === active.id);
    if (!activeTerminal) return;

    // Check if dropped on a category
    const droppedOnCategory = over.id.toString().startsWith('category-');
    const droppedOnAll = over.id === 'category-all';

    if (droppedOnCategory || droppedOnAll) {
      const newCategoryId = droppedOnAll ? null : over.id.toString().replace('category-', '');

      // Only update if category changed
      if (activeTerminal.categoryId !== newCategoryId) {
        // Update locally first for instant feedback
        setTerminals((prev) =>
          prev.map((t) =>
            t.id === active.id
              ? {
                  ...t,
                  categoryId: newCategoryId,
                  category: newCategoryId
                    ? categories.find((c) => c.id === newCategoryId) || null
                    : null,
                }
              : t
          )
        );

        // Save to backend
        if (session?.accessToken) {
          try {
            await terminalsApi.update(
              active.id as string,
              { categoryId: newCategoryId },
              session.accessToken
            );
          } catch (error) {
            console.error('Failed to update terminal category:', error);
            // Revert on error
            loadData();
          }
        }
      }
    } else if (active.id !== over.id) {
      // Reordering terminals
      const oldIndex = terminals.findIndex((t) => t.id === active.id);
      const newIndex = terminals.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(terminals, oldIndex, newIndex);
        setTerminals(newOrder);

        // Save new order to backend
        if (session?.accessToken) {
          try {
            await terminalsApi.reorder(
              { terminalIds: newOrder.map((t) => t.id) },
              session.accessToken
            );
          } catch (error) {
            console.error('Failed to save order:', error);
          }
        }
      }
    }
  };

  // Filter terminals by selected category, favorites, shared, and search
  const filteredTerminals = showSharedOnly
    ? sharedTerminals.filter((t) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            t.name.toLowerCase().includes(query) ||
            t.user?.name?.toLowerCase().includes(query) ||
            t.user?.email?.toLowerCase().includes(query)
          );
        }
        return true;
      })
    : terminals
        .filter((t) => {
          if (showFavoritesOnly && !t.isFavorite) return false;
          if (selectedCategory && t.categoryId !== selectedCategory) return false;
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              t.name.toLowerCase().includes(query) ||
              t.category?.name.toLowerCase().includes(query)
            );
          }
          return true;
        })
        .sort((a, b) => {
          // Sort favorites to top
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return 0;
        });

  const favoritesCount = terminals.filter((t) => t.isFavorite).length;

  if (loading) {
    return (
      <>
        {/* Mobile loading skeleton */}
        <div className="md:hidden h-[calc(100vh-8rem)]">
          <MobileTerminalList terminals={[]} isLoading={true} />
        </div>
        {/* Desktop loading skeleton */}
        <div className="hidden md:block p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-24 bg-muted rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile View - Status monitoring interface */}
      <div className="md:hidden h-[calc(100vh-8rem)]">
        <MobileTerminalList
          terminals={terminals}
          onRefresh={loadData}
          isLoading={loading}
        />
      </div>

      {/* Desktop View - Full feature interface */}
      <div className={cn(
        "transition-opacity duration-150",
        isNavigating ? "opacity-0" : "opacity-100"
      )}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <div className="hidden md:block p-8">
          {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Terminals</h1>
            <p className="text-muted-foreground mt-1">
              Manage your terminal sessions
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Help button */}
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard size={18} className="text-muted-foreground" />
            </button>

            {/* Terminal theme selector */}
            <TerminalThemeSelector />

            {/* View mode toggle */}
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} isDark={isDark} />

            <Button
              onClick={handleOpenCreateModal}
              disabled={creating}
              className="gap-2"
            >
              <Plus size={16} />
              {creating ? 'Creating...' : 'New Terminal'}
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search terminals... (Ctrl+F)"
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

        {/* Categories - Drop targets */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <DroppableCategory id="category-all" isOver={overId === 'category-all'}>
            <button
              onClick={() => {
                setSelectedCategory(null);
                setShowFavoritesOnly(false);
                setShowSharedOnly(false);
              }}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                !selectedCategory && !showFavoritesOnly && !showSharedOnly
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
                overId === 'category-all' && 'ring-2 ring-primary'
              )}
            >
              All ({terminals.length})
            </button>
          </DroppableCategory>

          {/* Favorites filter */}
          <button
            onClick={() => {
              setShowFavoritesOnly(!showFavoritesOnly);
              setSelectedCategory(null);
              setShowSharedOnly(false);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
              showFavoritesOnly
                ? 'bg-yellow-500 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Star size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            Favorites ({favoritesCount})
          </button>

          {/* Shared with me filter */}
          <button
            onClick={() => {
              setShowSharedOnly(!showSharedOnly);
              setSelectedCategory(null);
              setShowFavoritesOnly(false);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
              showSharedOnly
                ? 'bg-purple-500 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Users size={14} />
            Shared with me ({sharedTerminals.length})
          </button>

          {categories.map((category) => (
            <DroppableCategory
              key={category.id}
              id={`category-${category.id}`}
              isOver={overId === `category-${category.id}`}
            >
              <div className="relative group">
                <button
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setShowFavoritesOnly(false);
                    setShowSharedOnly(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
                    selectedCategory === category.id
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                    overId === `category-${category.id}` && 'ring-2 ring-primary'
                  )}
                  style={{
                    backgroundColor:
                      selectedCategory === category.id ? category.color : undefined,
                  }}
                >
                  <Folder size={14} />
                  {category.name}
                  <span className="opacity-60">
                    ({terminals.filter((t) => t.categoryId === category.id).length})
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            </DroppableCategory>
          ))}

          {showCategoryInput ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="px-3 py-2 rounded-full text-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                  if (e.key === 'Escape') {
                    setShowCategoryInput(false);
                    setNewCategoryName('');
                  }
                }}
              />
              <button
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
                className="p-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 disabled:opacity-50"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setShowCategoryInput(false);
                  setNewCategoryName('');
                }}
                className="p-2 bg-muted rounded-full hover:bg-muted/80"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCategoryInput(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-dashed border-border"
            >
              <FolderPlus size={14} />
              Add Category
            </button>
          )}
        </div>

        {/* Terminal grid/list */}
        {filteredTerminals.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            {showSharedOnly ? (
              <Users size={48} className="mx-auto text-muted-foreground mb-4" />
            ) : (
              <TerminalIcon size={48} className="mx-auto text-muted-foreground mb-4" />
            )}
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              {searchQuery
                ? 'No terminals found'
                : showSharedOnly
                ? 'No shared terminals'
                : showFavoritesOnly
                ? 'No favorite terminals'
                : selectedCategory
                ? 'No terminals in this category'
                : 'No terminals yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? 'Try a different search term'
                : showSharedOnly
                ? 'When someone shares a terminal with you, it will appear here'
                : showFavoritesOnly
                ? 'Star a terminal to add it to favorites'
                : selectedCategory
                ? 'Create a terminal and assign it to this category'
                : 'Create your first terminal to get started'}
            </p>
            {!searchQuery && !showFavoritesOnly && !showSharedOnly && (
              <Button
                onClick={handleOpenCreateModal}
                disabled={creating}
                className="gap-2"
              >
                <Plus size={16} />
                Create Terminal
              </Button>
            )}
          </div>
        ) : viewMode === 'list' && !showSharedOnly ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <TerminalListView
              terminals={filteredTerminals as TerminalData[]}
              onDelete={handleDeleteTerminal}
              onToggleFavorite={handleToggleFavorite}
              isDark={isDark}
            />
          </div>
        ) : showSharedOnly ? (
          // Shared terminals grouped by owner
          <div className="space-y-8">
            {(() => {
              // Group terminals by owner
              const grouped = (filteredTerminals as SharedTerminal[]).reduce((acc, terminal) => {
                const ownerId = terminal.user.id;
                if (!acc[ownerId]) {
                  acc[ownerId] = {
                    user: terminal.user,
                    terminals: [],
                  };
                }
                acc[ownerId].terminals.push(terminal);
                return acc;
              }, {} as Record<string, { user: SharedTerminal['user']; terminals: SharedTerminal[] }>);

              return Object.values(grouped).map(({ user, terminals: userTerminals }) => (
                <div key={user.id}>
                  {/* User section header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: isDark ? '#333' : '#e5e5e5' }}
                    >
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <User size={16} className="text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Terminals de {user.name || user.email}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {userTerminals.length} terminal{userTerminals.length !== 1 ? 'es' : ''}
                      </p>
                    </div>
                  </div>

                  {/* User's terminals grid */}
                  <div
                    className={cn(
                      'grid gap-4 transition-all',
                      viewMode === 'compact'
                        ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    )}
                  >
                    {userTerminals.map((terminal, index) => (
                      <div
                        key={terminal.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-200"
                        style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationFillMode: 'both' }}
                      >
                        <SharedTerminalCard
                          terminal={terminal}
                          onConnect={navigateToTerminal}
                          isDark={isDark}
                          isCompact={viewMode === 'compact'}
                          hideOwner
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
          <SortableContext
            items={filteredTerminals.map((t) => t.id)}
            strategy={rectSortingStrategy}
          >
            <div
              className={cn(
                'grid gap-4 transition-all',
                viewMode === 'compact'
                  ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              )}
            >
              {(filteredTerminals as TerminalData[]).map((terminal, index) => (
                <div
                  key={terminal.id}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-200"
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationFillMode: 'both' }}
                >
                  <DraggableTerminalCard
                    terminal={terminal}
                    onDelete={handleDeleteTerminal}
                    onRename={handleRenameTerminal}
                    onToggleFavorite={handleToggleFavorite}
                    onContextMenu={handleContextMenu}
                    onConnect={navigateToTerminal}
                    isRenaming={terminalToRename === terminal.id}
                    onRenameComplete={() => setTerminalToRename(null)}
                    isDark={isDark}
                    isCompact={viewMode === 'compact'}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        )}

        {/* Delete Confirmation Modal */}
        {terminalToDelete && (
          <DeleteConfirmModal
            terminal={terminalToDelete}
            onConfirm={confirmDeleteTerminal}
            onCancel={() => setTerminalToDelete(null)}
            isDark={isDark}
          />
        )}

        {/* Shortcuts Help Modal */}
        <ShortcutsHelpModalWithContext isDark={isDark} />

        {/* Create Terminal Modal */}
        <CreateTerminalModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateLocal={handleCreateLocalTerminal}
          onCreateSSH={handleCreateSSHTerminal}
          isDark={isDark}
          token={session?.accessToken}
        />

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            terminal={contextMenu.terminal}
            onClose={() => setContextMenu(null)}
            onConnect={handleContextMenuConnect}
            onRename={handleContextMenuRename}
            onShare={handleContextMenuShare}
            onDelete={handleContextMenuDelete}
            isDark={isDark}
          />
        )}

        {/* Share Terminal Modal */}
        {terminalToShare && (
          <ShareTerminalModal
            isOpen={true}
            onClose={() => setTerminalToShare(null)}
            terminalId={terminalToShare.id}
            terminalName={terminalToShare.name}
            isDark={isDark}
          />
        )}
        </div>
      </DndContext>
      </div>
    </>
  );
}

// Main component with provider wrapper
export default function TerminalsPage() {
  const [triggerCreate, setTriggerCreate] = useState(false);

  const handleCreateTerminal = useCallback(() => {
    // Trigger the modal to open - will be handled in content component
    setTriggerCreate(true);
    setTimeout(() => setTriggerCreate(false), 100);
  }, []);

  const handleFocusSearch = useCallback(() => {
    // Focus search input - handled internally in TerminalsPageContent
    const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
    searchInput?.focus();
  }, []);

  return (
    <KeyboardShortcutsProvider
      onCreateTerminal={handleCreateTerminal}
      onFocusSearch={handleFocusSearch}
    >
      <TerminalsPageContent triggerCreate={triggerCreate} />
    </KeyboardShortcutsProvider>
  );
}
