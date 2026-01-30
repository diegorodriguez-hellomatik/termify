'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Terminal as TerminalIcon,
  Keyboard,
  LayoutGrid,
  Grid3x3,
  List,
  Layers,
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Edit2,
  Star,
  Folder,
  Briefcase,
  Wrench,
  Rocket,
  Home,
  Settings,
  Laptop,
  Globe,
  Flame,
  Lightbulb,
  Code,
  Database,
  Server,
  Cloud,
  Box,
  Zap,
  Shield,
  Lock,
  Key,
  Search,
  X,
  Share2,
} from 'lucide-react';

// Icon mapping for workspaces
const WORKSPACE_ICONS: Record<string, React.FC<{ className?: string; size?: number; style?: React.CSSProperties }>> = {
  folder: Folder,
  briefcase: Briefcase,
  wrench: Wrench,
  rocket: Rocket,
  home: Home,
  settings: Settings,
  laptop: Laptop,
  globe: Globe,
  star: Star,
  flame: Flame,
  lightbulb: Lightbulb,
  code: Code,
  database: Database,
  server: Server,
  cloud: Cloud,
  terminal: TerminalIcon,
  box: Box,
  zap: Zap,
  shield: Shield,
  lock: Lock,
  key: Key,
};

const getWorkspaceIcon = (iconName: string | null | undefined) => {
  if (!iconName) return null;
  return WORKSPACE_ICONS[iconName] || null;
};
import { PageLayout, PageHeader, PageContent } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { terminalsApi, TerminalProfile, Workspace, PersonalTask, TaskPriority } from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useWorkspace, PaneNode } from '@/contexts/WorkspaceContext';
import { TabBar } from '@/components/workspace/TabBar';
import { FloatingWorkspace } from '@/components/workspace/FloatingWorkspace';
import { WorkspaceDndProvider } from '@/components/workspace/WorkspaceDndProvider';
import { DropPosition } from '@/components/workspace/DropZoneOverlay';
import { QuickSwitcher } from '@/components/workspace/QuickSwitcher';
import { QuickActionsToolbar } from '@/components/workspace/QuickActionsToolbar';
import { WorkspaceTasksPanel } from '@/components/workspace/WorkspaceTasksPanel';
import { PersonalTaskDetailModal } from '@/components/tasks/PersonalTaskDetailModal';
import { TerminalThemeSelector } from '@/components/settings/TerminalThemeSelector';
import { ShortcutsHelpModal } from '@/components/ui/ShortcutsHelpModal';
import { WorkspaceModal } from '@/components/workspaces/WorkspaceModal';
import { WorkspaceEditModal } from '@/components/workspaces/WorkspaceEditModal';
import { ShareWorkspaceModal } from '@/components/workspaces/ShareWorkspaceModal';
import { usePersonalTasks } from '@/hooks/usePersonalTasks';
import { TerminalTasksProvider } from '@/contexts/TerminalTasksContext';
import { cn } from '@/lib/utils';

interface TerminalData {
  id: string;
  name: string;
  status: string;
  cols: number;
  rows: number;
  createdAt: string;
  lastActiveAt: string | null;
  isFavorite?: boolean;
  category?: { id: string; name: string; color: string } | null;
}

// View mode: 'list' shows workspace cards, 'workspace' shows terminal view
type ViewMode = 'list' | 'workspace';

// Card view mode for workspace list
type CardViewMode = 'grid' | 'compact' | 'list';

// View Mode Toggle Component
function ViewModeToggle({
  viewMode,
  onChange,
  isDark,
}: {
  viewMode: CardViewMode;
  onChange: (mode: CardViewMode) => void;
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

// Sortable Workspace Card Component
function SortableWorkspaceCard({
  workspace,
  isDark,
  isCompact,
  isList,
  onOpen,
  onContextMenu,
  onDelete,
  canDelete,
}: {
  workspace: Workspace;
  isDark: boolean;
  isCompact?: boolean;
  isList?: boolean;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: workspace.id,
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

  const getWorkspaceColor = (ws: Workspace) => ws.color || '#6366f1';

  // List view - horizontal layout
  if (isList) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          'group relative rounded-lg border cursor-grab active:cursor-grabbing',
          !isDragging && 'hover:shadow-md transition-shadow transition-border duration-200',
          isDark
            ? 'bg-card border-border hover:border-muted-foreground/30'
            : 'bg-white border-gray-200 hover:border-gray-300',
          isDragging && 'shadow-2xl ring-2 ring-primary/50 cursor-grabbing'
        )}
        onClick={(e) => {
          if (!isDragging) onOpen();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e);
        }}
      >
        <div className="flex items-center gap-4 p-3">
          {/* Color indicator */}
          <div
            className="w-1 h-10 rounded-full"
            style={{ backgroundColor: getWorkspaceColor(workspace) }}
          />
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: getWorkspaceColor(workspace) + '20' }}
          >
            {(() => {
              const IconComp = getWorkspaceIcon(workspace.icon);
              return IconComp ? (
                <IconComp size={20} style={{ color: getWorkspaceColor(workspace) }} />
              ) : (
                <Layers size={20} style={{ color: getWorkspaceColor(workspace) }} />
              );
            })()}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{workspace.name}</h3>
              {workspace.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex-shrink-0">
                  default
                </span>
              )}
            </div>
            {workspace.description && (
              <p className="text-sm text-muted-foreground truncate">{workspace.description}</p>
            )}
          </div>
          {/* Stats */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-shrink-0">
            <TerminalIcon size={14} />
            <span>{workspace.terminalCount || 0}</span>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onContextMenu(e);
              }}
              className="p-1.5 rounded-md hover:bg-muted transition-all"
            >
              <MoreHorizontal size={16} className="text-muted-foreground" />
            </button>
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-md hover:bg-destructive/10 transition-all"
                title="Delete workspace"
              >
                <Trash2 size={16} className="text-destructive" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Compact view - smaller cards
  if (isCompact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          'group relative rounded-lg border cursor-grab active:cursor-grabbing',
          !isDragging && 'hover:shadow-md transition-shadow transition-border duration-200',
          isDark
            ? 'bg-card border-border hover:border-muted-foreground/30'
            : 'bg-white border-gray-200 hover:border-gray-300',
          isDragging && 'shadow-2xl ring-2 ring-primary/50 cursor-grabbing'
        )}
        onClick={(e) => {
          if (!isDragging) onOpen();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e);
        }}
      >
        {/* Color bar */}
        <div
          className="h-1.5 rounded-t-lg"
          style={{ backgroundColor: getWorkspaceColor(workspace) }}
        />
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: getWorkspaceColor(workspace) + '20' }}
              >
                {(() => {
                  const IconComp = getWorkspaceIcon(workspace.icon);
                  return IconComp ? (
                    <IconComp size={14} style={{ color: getWorkspaceColor(workspace) }} />
                  ) : (
                    <Layers size={14} style={{ color: getWorkspaceColor(workspace) }} />
                  );
                })()}
              </div>
              <h3 className="font-medium text-sm text-foreground truncate">{workspace.name}</h3>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1 rounded hover:bg-destructive/10 transition-all"
                >
                  <Trash2 size={12} className="text-destructive" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TerminalIcon size={12} />
            <span>{workspace.terminalCount || 0} terminals</span>
            {workspace.isDefault && (
              <span className="ml-auto text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">
                default
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default grid view
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative rounded-xl border cursor-grab active:cursor-grabbing flex flex-col',
        !isDragging && 'hover:shadow-lg transition-shadow transition-border duration-200',
        isDark
          ? 'bg-card border-border hover:border-muted-foreground/30'
          : 'bg-white border-gray-200 hover:border-gray-300',
        isDragging && 'shadow-2xl ring-2 ring-primary/50 cursor-grabbing'
      )}
      onClick={(e) => {
        // Only trigger onOpen if not dragging
        if (!isDragging) {
          onOpen();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
    >
      {/* Color bar */}
      <div
        className="h-2 rounded-t-xl flex-shrink-0"
        style={{ backgroundColor: getWorkspaceColor(workspace) }}
      />

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: getWorkspaceColor(workspace) + '20' }}
            >
              {(() => {
                const IconComp = getWorkspaceIcon(workspace.icon);
                return IconComp ? (
                  <IconComp size={24} style={{ color: getWorkspaceColor(workspace) }} />
                ) : (
                  <Layers size={24} style={{ color: getWorkspaceColor(workspace) }} />
                );
              })()}
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">{workspace.name}</h3>
              {workspace.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  default
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onContextMenu(e);
              }}
              className="p-1.5 rounded-md hover:bg-muted transition-all"
            >
              <MoreHorizontal size={16} className="text-muted-foreground" />
            </button>
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-md hover:bg-destructive/10 transition-all"
                title="Delete workspace"
              >
                <Trash2 size={16} className="text-destructive" />
              </button>
            )}
          </div>
        </div>

        {/* Description - with min height to maintain card size */}
        <div className="flex-1 min-h-[40px] mb-4">
          {workspace.description ? (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {workspace.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">
              No description
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-auto pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <TerminalIcon size={14} />
            <span>{workspace.terminalCount || 0} terminals</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const { isDark } = useTheme();

  // Check if we're on a workspace ID route (e.g., /workspace/abc123)
  const isWorkspaceIdRoute = pathname?.startsWith('/workspace/') && pathname !== '/workspace';
  const {
    tabs,
    activeTab,
    layout,
    openTab,
    splitPane,
    showQuickSwitcher,
    setShowQuickSwitcher,
    setSimpleLayout,
    reorderTabs,
    // Workspace management
    workspaces,
    currentWorkspace,
    currentWorkspaceId,
    switchWorkspace,
    loadingWorkspaces,
    createWorkspace,
    deleteWorkspace,
    updateWorkspace,
    reorderWorkspaces,
  } = useWorkspace();

  // Drag-and-drop state
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  // DnD sensors - minimal distance for responsive drag
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveWorkspaceId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWorkspaceId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = workspaces.findIndex((w) => w.id === active.id);
    const newIndex = workspaces.findIndex((w) => w.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(workspaces, oldIndex, newIndex);
      await reorderWorkspaces(newOrder.map((w) => w.id));
    }
  };

  const [terminals, setTerminals] = useState<TerminalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [pendingSplit, setPendingSplit] = useState<{
    direction: 'horizontal' | 'vertical';
    sourceTerminalId: string;
  } | null>(null);

  // View mode state with transition - initialized from URL
  const urlView = searchParams?.get('view');
  const [viewMode, setViewMode] = useState<ViewMode>(
    isWorkspaceIdRoute || urlView === 'workspace' ? 'workspace' : 'list'
  );
  // Only transition when navigating manually, not on direct URL access
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Sync viewMode with URL on route changes
  useEffect(() => {
    if (isWorkspaceIdRoute && currentWorkspaceId) {
      setViewMode('workspace');
    } else if (!isWorkspaceIdRoute && pathname === '/workspace') {
      setViewMode('list');
    }
  }, [isWorkspaceIdRoute, currentWorkspaceId, pathname]);

  // Workspace modal states
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showWorkspaceEditModal, setShowWorkspaceEditModal] = useState(false);
  const [showShareWorkspaceModal, setShowShareWorkspaceModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  // Context menu state - workspaceId is optional for empty space clicks
  const [contextMenu, setContextMenu] = useState<{ workspaceId?: string; x: number; y: number } | null>(null);

  // Delete confirmation state
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Card view mode state
  const [cardViewMode, setCardViewMode] = useState<CardViewMode>('grid');

  // Tasks panel state
  const [tasksPanelOpen, setTasksPanelOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PersonalTask | null>(null);

  // Fetch tasks for current workspace
  const {
    tasks: workspaceTasks,
    createTask,
    updateTask,
    deleteTask,
  } = usePersonalTasks({ workspaceId: currentWorkspaceId || undefined });

  // Get fullscreen state from context
  const { isFullscreen, toggleFullscreen } = useWorkspace();

  // Auto layout function from FloatingWorkspace
  const [autoLayoutFn, setAutoLayoutFn] = useState<(() => void) | null>(null);

  // Filter workspaces by search
  const filteredWorkspaces = workspaces.filter((ws) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ws.name.toLowerCase().includes(query) ||
      ws.description?.toLowerCase().includes(query)
    );
  });

  // Load terminals
  useEffect(() => {
    const loadTerminals = async () => {
      if (!session?.accessToken) return;

      try {
        const response = await terminalsApi.list(session.accessToken);
        if (response.success && response.data) {
          setTerminals(response.data.terminals);
        }
      } catch (error) {
        console.error('Failed to load terminals:', error);
      } finally {
        setLoading(false);
      }
    };

    if (sessionStatus === 'authenticated') {
      loadTerminals();
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [session?.accessToken, sessionStatus, router]);

  // Register keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F to focus search (works even from input)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Ignore if in input for other shortcuts
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowQuickSwitcher(true);
      }

      // Show shortcuts help with ? or Shift+?
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // F11 to toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }

      // Escape to exit fullscreen first, then go back to list
      if (e.key === 'Escape') {
        if (isFullscreen) {
          toggleFullscreen();
        } else if (viewMode === 'workspace') {
          handleBackToList();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowQuickSwitcher, viewMode, isFullscreen, toggleFullscreen]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Open terminal and create tab
  const handleOpenTerminal = useCallback(
    (terminalId: string, name: string) => {
      openTab(terminalId, name);
    },
    [openTab]
  );

  // Create new terminal
  const handleCreateTerminal = async () => {
    if (!session?.accessToken) return;

    try {
      const response = await terminalsApi.create(
        { name: `Terminal ${terminals.length + 1}` },
        session.accessToken
      );

      if (response.success && response.data) {
        setTerminals((prev) => [...prev, response.data]);
        openTab(response.data.id, response.data.name);
      }
    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  };

  // Create terminal with profile
  const handleCreateTerminalWithProfile = async (profile: TerminalProfile) => {
    if (!session?.accessToken) return;

    try {
      const response = await terminalsApi.create(
        {
          name: profile.name,
          cols: profile.cols,
          rows: profile.rows,
          cwd: profile.cwd || undefined,
        },
        session.accessToken
      );

      if (response.success && response.data) {
        setTerminals((prev) => [...prev, response.data]);
        openTab(response.data.id, response.data.name);
      }
    } catch (error) {
      console.error('Failed to create terminal with profile:', error);
    }
  };

  // Handle snippet use
  const handleUseSnippet = (command: string) => {
    console.log('Use snippet:', command);
  };

  // Handle adding a tab
  const handleAddTab = () => {
    if (terminals.length > 0) {
      setShowQuickSwitcher(true);
    } else {
      handleCreateTerminal();
    }
  };

  // Handle split
  const handleSplitHorizontal = (currentTerminalId: string) => {
    setPendingSplit({ direction: 'horizontal', sourceTerminalId: currentTerminalId });
    setShowQuickSwitcher(true);
  };

  const handleSplitVertical = (currentTerminalId: string) => {
    setPendingSplit({ direction: 'vertical', sourceTerminalId: currentTerminalId });
    setShowQuickSwitcher(true);
  };

  // Helper to find pane ID
  const findPaneId = useCallback((terminalId: string): string | null => {
    if (!layout) return null;

    const find = (node: PaneNode): string | null => {
      if (node.type === 'terminal' && node.terminalId === terminalId) {
        return node.id;
      }
      if (node.children) {
        for (const child of node.children) {
          const found = find(child);
          if (found) return found;
        }
      }
      return null;
    };

    return find(layout);
  }, [layout]);

  // Execute split with selected terminal
  const executeSplit = useCallback((terminalId: string, name: string) => {
    if (!pendingSplit) {
      openTab(terminalId, name);
      return;
    }

    const paneId = findPaneId(pendingSplit.sourceTerminalId);
    if (paneId) {
      splitPane(paneId, pendingSplit.direction, terminalId);
      openTab(terminalId, name);
    }
    setPendingSplit(null);
  }, [pendingSplit, findPaneId, splitPane, openTab]);

  // Handle tab dropped on a pane (VS Code-style split)
  const handleTabDrop = useCallback((paneId: string, terminalId: string, position: DropPosition) => {
    if (!position || position === 'center') {
      // Center drop = just focus that terminal, no split needed
      return;
    }

    // Determine direction based on drop position
    const direction: 'horizontal' | 'vertical' =
      position === 'left' || position === 'right' ? 'horizontal' : 'vertical';

    // For left/top drops, we need to swap the order after splitting
    // The current splitPane puts the new terminal second
    // TODO: For now, just split - can add swap logic later
    splitPane(paneId, direction, terminalId);
  }, [splitPane]);

  // Create new terminal for split
  const handleCreateNewForSplit = async () => {
    if (!session?.accessToken || !pendingSplit) return;

    try {
      const response = await terminalsApi.create(
        { name: `Terminal ${terminals.length + 1}` },
        session.accessToken
      );

      if (response.success && response.data) {
        setTerminals((prev) => [...prev, response.data]);
        executeSplit(response.data.id, response.data.name);
      }
    } catch (error) {
      console.error('Failed to create terminal for split:', error);
    }
  };

  // Open a workspace with animation
  const handleOpenWorkspace = async (workspace: Workspace) => {
    setIsTransitioning(true);
    await switchWorkspace(workspace.id);
    // Update URL to reflect the workspace
    router.push(`/workspace/${workspace.id}`, { scroll: false });
    // Small delay for smooth transition
    setTimeout(() => {
      setViewMode('workspace');
      setTimeout(() => setIsTransitioning(false), 100);
    }, 50);
  };

  // Go back to list with animation
  const handleBackToList = () => {
    setIsTransitioning(true);
    // Update URL to remove workspace ID
    router.push('/workspace', { scroll: false });
    setTimeout(() => {
      setViewMode('list');
      setTimeout(() => setIsTransitioning(false), 100);
    }, 50);
  };

  // Create new workspace
  const handleCreateWorkspace = () => {
    setEditingWorkspace(null);
    setShowWorkspaceEditModal(true);
  };

  // Edit workspace
  const handleEditWorkspace = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setShowWorkspaceEditModal(true);
    setContextMenu(null);
  };

  // Delete workspace - show confirmation modal
  const handleDeleteWorkspace = (workspace: Workspace) => {
    if (workspaces.length <= 1) {
      alert('Cannot delete the last workspace');
      return;
    }
    setWorkspaceToDelete(workspace);
    setContextMenu(null);
  };

  // Confirm workspace deletion
  const confirmDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    await deleteWorkspace(workspaceToDelete.id);
    setWorkspaceToDelete(null);
  };

  // Set as default
  const handleSetDefault = async (workspace: Workspace) => {
    await updateWorkspace(workspace.id, { isDefault: true });
    setContextMenu(null);
  };

  // Clone workspace
  const handleCloneWorkspace = async (workspace: Workspace) => {
    const clonedWorkspace = await createWorkspace({
      name: `${workspace.name} (Copy)`,
      description: workspace.description || undefined,
      color: workspace.color || undefined,
      icon: workspace.icon || undefined,
    });
    setContextMenu(null);
  };

  // Handle right-click on empty space
  const handleEmptySpaceContextMenu = (e: React.MouseEvent) => {
    // Only trigger if clicking directly on the container, not on a card
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-empty-space]')) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  // Get workspace color
  const getWorkspaceColor = (workspace: Workspace) => workspace.color || '#6366f1';

  if (loading || sessionStatus === 'loading' || loadingWorkspaces) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Workspace List View
  if (viewMode === 'list') {
    return (
      <PageLayout className={cn(
        "flex-1 flex flex-col min-h-0 transition-all duration-150",
        isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
      )}>
        <PageHeader
          title="Workspaces"
          description="Organize your terminals into projects and environments"
          actions={
            <div className="flex items-center gap-3">
              <ViewModeToggle viewMode={cardViewMode} onChange={setCardViewMode} isDark={isDark} />
              <Button onClick={handleCreateWorkspace} className="gap-2">
                <Plus size={16} />
                New Workspace
              </Button>
            </div>
          }
        />

        {/* Workspace Grid */}
        <PageContent className="flex-1 overflow-y-auto">
          {/* Search bar */}
          {workspaces.length > 0 && (
            <div className="relative max-w-md mb-4">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workspaces... (Ctrl+F)"
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
          )}
          {filteredWorkspaces.length === 0 && searchQuery ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Layers size={40} className="text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">No workspaces found</h2>
              <p className="text-muted-foreground">Try a different search term</p>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                  border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                }}
              >
                <Layers size={40} className="text-muted-foreground" />
              </div>
              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: isDark ? '#fff' : '#1a1a1a' }}
              >
                No workspaces yet
              </h2>
              <p
                className="text-center mb-6 max-w-md"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                Create your first workspace to organize your terminals into different projects or environments.
              </p>
              <button
                onClick={handleCreateWorkspace}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all"
              >
                <Plus size={16} />
                Create Workspace
              </button>
            </div>
          ) : (
            <div onContextMenu={handleEmptySpaceContextMenu} className="min-h-[calc(100vh-220px)]">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredWorkspaces.map((w) => w.id)}
                strategy={rectSortingStrategy}
              >
                <div data-empty-space
                  key={`workspace-grid-${cardViewMode}`}
                  className={cn(
                    'grid gap-4',
                    cardViewMode === 'list'
                      ? 'grid-cols-1'
                      : cardViewMode === 'compact'
                      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                    'animate-in fade-in duration-200'
                  )}>
                  {filteredWorkspaces.map((workspace, index) => (
                    <div
                      key={workspace.id}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-200"
                      style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationFillMode: 'both' }}
                    >
                    <SortableWorkspaceCard
                      key={workspace.id}
                      workspace={workspace}
                      isDark={isDark}
                      isCompact={cardViewMode === 'compact'}
                      isList={cardViewMode === 'list'}
                      onOpen={() => handleOpenWorkspace(workspace)}
                      onDelete={() => handleDeleteWorkspace(workspace)}
                      canDelete={workspaces.length > 1}
                      onContextMenu={(e) => {
                        e.stopPropagation();
                        setContextMenu({
                          workspaceId: workspace.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                    />
                    </div>
                  ))}

                  {/* Add workspace card */}
                  <button
                    onClick={handleCreateWorkspace}
                    className={cn(
                      'rounded-xl border-2 border-dashed transition-all duration-200',
                      'flex items-center justify-center gap-2',
                      'hover:border-primary hover:bg-primary/5',
                      isDark
                        ? 'border-border text-muted-foreground'
                        : 'border-gray-300 text-gray-500',
                      cardViewMode === 'list' ? 'py-4' : cardViewMode === 'compact' ? 'min-h-[120px] flex-col' : 'min-h-[220px] flex-col'
                    )}
                  >
                    <Plus size={cardViewMode === 'list' ? 18 : 28} />
                    <span className="font-medium">{cardViewMode === 'list' ? 'New Workspace' : 'Create Workspace'}</span>
                  </button>
                </div>
              </SortableContext>
            </DndContext>
            </div>
          )}
        </PageContent>

        {/* Context Menu - rendered in portal to avoid transform positioning issues */}
        {contextMenu && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 176),
              top: Math.min(contextMenu.y, window.innerHeight - 200),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const workspace = workspaces.find((w) => w.id === contextMenu.workspaceId);
              if (!workspace) {
                // Blank area context menu - show "New Workspace"
                return (
                  <button
                    onClick={() => {
                      handleCreateWorkspace();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <Plus size={14} className="text-primary" />
                    New Workspace
                  </button>
                );
              }
              return (
                <>
                  <button
                    onClick={() => handleOpenWorkspace(workspace)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <LayoutGrid size={14} />
                    Open
                  </button>
                  <button
                    onClick={() => handleEditWorkspace(workspace)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setEditingWorkspace(workspace);
                      setShowShareWorkspaceModal(true);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <Share2 size={14} />
                    Share
                  </button>
                  {!workspace.isDefault && (
                    <button
                      onClick={() => handleSetDefault(workspace)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Star size={14} />
                      Set as default
                    </button>
                  )}
                  {workspaces.length > 1 && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => handleDeleteWorkspace(workspace)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </>
                  )}
                </>
              );
            })()}
          </div>,
          document.body
        )}

        {/* Modals */}
        <WorkspaceModal
          isOpen={showWorkspaceModal}
          onClose={() => setShowWorkspaceModal(false)}
          onCreateWorkspace={handleCreateWorkspace}
          onEditWorkspace={handleEditWorkspace}
        />

        <WorkspaceEditModal
          isOpen={showWorkspaceEditModal}
          onClose={() => {
            setShowWorkspaceEditModal(false);
            setEditingWorkspace(null);
          }}
          workspace={editingWorkspace}
        />

        <DeleteConfirmModal
          isOpen={!!workspaceToDelete}
          title="Delete Workspace"
          itemName={workspaceToDelete?.name || ''}
          itemType="workspace"
          description="This will remove all terminal associations from this workspace."
          onConfirm={confirmDeleteWorkspace}
          onCancel={() => setWorkspaceToDelete(null)}
        />

        {/* Share Workspace Modal */}
        {editingWorkspace && (
          <ShareWorkspaceModal
            isOpen={showShareWorkspaceModal}
            onClose={() => {
              setShowShareWorkspaceModal(false);
              setEditingWorkspace(null);
            }}
            workspaceId={editingWorkspace.id}
            workspaceName={editingWorkspace.name}
            isDark={isDark}
            token={session?.accessToken}
          />
        )}
    </PageLayout>
    );
  }

  // Workspace Terminal View
  return (
    <div className={cn(
      "flex-1 flex flex-col min-h-0 transition-all duration-150",
      isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
    )}>
      {/* Header - hidden in fullscreen */}
      {!isFullscreen && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-border"
          style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}
        >
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={handleBackToList}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Back to workspaces"
            >
              <ArrowLeft size={18} className="text-muted-foreground" />
            </button>

            {/* Workspace info */}
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: (currentWorkspace?.color || '#6366f1') + '20' }}
            >
              {(() => {
                const IconComp = getWorkspaceIcon(currentWorkspace?.icon);
                return IconComp ? (
                  <IconComp size={14} style={{ color: currentWorkspace?.color || '#6366f1' }} />
                ) : (
                  <Layers size={14} style={{ color: currentWorkspace?.color || '#6366f1' }} />
                );
              })()}
            </div>
            <h1 className="text-sm font-semibold">{currentWorkspace?.name || 'Workspace'}</h1>
            <span className="text-xs text-muted-foreground">
              {tabs.length} terminal{tabs.length !== 1 ? 's' : ''} open
            </span>
          </div>

          <div className="flex items-center gap-2">
            {session?.accessToken && (
              <QuickActionsToolbar
                token={session.accessToken}
                onNewTerminal={handleCreateTerminal}
                onNewTerminalWithProfile={handleCreateTerminalWithProfile}
                onUseSnippet={handleUseSnippet}
                onOpenQuickSwitcher={() => setShowQuickSwitcher(true)}
                onOpenShortcuts={() => setShowShortcuts(true)}
                onToggleTasks={() => setTasksPanelOpen(!tasksPanelOpen)}
                tasksOpen={tasksPanelOpen}
                taskCount={workspaceTasks.length}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
              />
            )}

            {/* Share button */}
            <button
              onClick={() => setShowShareWorkspaceModal(true)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Share workspace"
            >
              <Share2 size={18} className="text-muted-foreground" />
            </button>

            <TerminalThemeSelector showLabel={false} />
          </div>
        </div>
      )}

      {/* Tab bar and Main content wrapped in DndProvider */}
      <WorkspaceDndProvider
        onTabDrop={handleTabDrop}
        onTabReorder={reorderTabs}
        tabIds={tabs.map(t => t.id)}
      >
        {/* Tab bar */}
        <TabBar
          onAddTab={handleAddTab}
          isDark={isDark}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onAutoLayout={autoLayoutFn ?? undefined}
        />

        {/* Main content - adjust height based on fullscreen */}
        <div
          className="relative w-full"
          style={{ height: isFullscreen ? 'calc(100vh - 32px)' : 'calc(100vh - 44px - 40px)' }}
        >
          {tabs.length === 0 ? (
            <div
              className="h-full flex flex-col items-center justify-center p-8"
              style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                  border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                }}
              >
                <TerminalIcon size={40} className="text-muted-foreground" />
              </div>

              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: isDark ? '#fff' : '#1a1a1a' }}
              >
                No terminals open
              </h2>
              <p
                className="text-center mb-6 max-w-md"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                Open a terminal to get started. You can have multiple floating terminals
                open and arrange them as you like.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowQuickSwitcher(true)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-black/5 hover:bg-black/10 text-black'
                  )}
                >
                  <Keyboard size={16} />
                  Open Terminal
                  <kbd
                    className={cn(
                      'ml-2 px-1.5 py-0.5 rounded text-xs font-mono',
                      isDark ? 'bg-white/10' : 'bg-black/5'
                    )}
                  >
                    ⌘K
                  </kbd>
                </button>

                <button
                  onClick={handleCreateTerminal}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all"
                >
                  <Plus size={16} />
                  Create New
                </button>
              </div>
            </div>
          ) : (
            session?.accessToken && (
              <FloatingWorkspace
                token={session.accessToken}
                onResetLayoutReady={(fn) => setAutoLayoutFn(() => fn)}
              />
            )
          )}
        </div>
      </WorkspaceDndProvider>

      {/* Quick switcher */}
      <QuickSwitcher
        terminals={terminals.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          lastActiveAt: t.lastActiveAt,
          createdAt: t.createdAt,
          isFavorite: t.isFavorite,
          categoryName: t.category?.name,
          categoryColor: t.category?.color,
        }))}
        onSelect={pendingSplit ? executeSplit : handleOpenTerminal}
        onClose={() => {
          setShowQuickSwitcher(false);
          setPendingSplit(null);
        }}
        isDark={isDark}
        mode={pendingSplit ? { type: 'split', ...pendingSplit } : 'open'}
        onCreateNew={pendingSplit ? handleCreateNewForSplit : undefined}
      />

      {/* Shortcuts help modal */}
      <ShortcutsHelpModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Workspace Modals */}
      <WorkspaceEditModal
        isOpen={showWorkspaceEditModal}
        onClose={() => {
          setShowWorkspaceEditModal(false);
          setEditingWorkspace(null);
        }}
        workspace={editingWorkspace}
      />

      {/* Share Workspace Modal */}
      {currentWorkspace && (
        <ShareWorkspaceModal
          isOpen={showShareWorkspaceModal}
          onClose={() => setShowShareWorkspaceModal(false)}
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          isDark={isDark}
          token={session?.accessToken}
        />
      )}

      {/* Tasks Panel */}
      <WorkspaceTasksPanel
        tasks={workspaceTasks}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        isOpen={tasksPanelOpen}
        onToggle={() => setTasksPanelOpen(!tasksPanelOpen)}
        onCreateTask={createTask}
        onTaskClick={setSelectedTask}
      />

      {/* Task Detail Modal */}
      {selectedTask && (
        <PersonalTaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          workspaces={workspaces}
        />
      )}
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <TerminalTasksProvider>
      <WorkspaceContent />
    </TerminalTasksProvider>
  );
}
