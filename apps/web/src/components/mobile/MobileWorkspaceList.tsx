'use client';

import { useState } from 'react';
import {
  Layers,
  MoreHorizontal,
  Trash2,
  Edit2,
  Star,
  Share2,
  Terminal,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Workspace } from '@/lib/api';
import { MobileContentHeader } from './MobileContentHeader';

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
  terminal: Terminal,
  box: Box,
  zap: Zap,
  shield: Shield,
  lock: Lock,
  key: Key,
};

const getWorkspaceIcon = (iconName: string | null | undefined) => {
  if (!iconName) return Layers;
  return WORKSPACE_ICONS[iconName] || Layers;
};

interface MobileWorkspaceListProps {
  workspaces: Workspace[];
  onOpenWorkspace: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  onEditWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspace: Workspace) => void;
  onShareWorkspace: (workspace: Workspace) => void;
  onSetDefault: (workspace: Workspace) => void;
  isLoading?: boolean;
}

function MobileWorkspaceCard({
  workspace,
  onOpen,
  onEdit,
  onDelete,
  onShare,
  onSetDefault,
  canDelete,
}: {
  workspace: Workspace;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onSetDefault: () => void;
  canDelete: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const IconComp = getWorkspaceIcon(workspace.icon);
  const color = workspace.color || '#6366f1';

  return (
    <div
      className={cn(
        'py-3 px-4 bg-card',
        'active:bg-muted transition-colors',
        'touch-manipulation'
      )}
      onClick={onOpen}
    >
      <div className="flex items-center gap-3">
        {/* Color bar */}
        <div
          className="w-1 h-12 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + '20' }}
        >
          <IconComp size={20} style={{ color }} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">{workspace.name}</p>
            {workspace.isDefault && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex-shrink-0">
                default
              </span>
            )}
          </div>
          {workspace.description && (
            <p className="text-xs text-muted-foreground truncate">{workspace.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Terminal size={12} />
            <span>{workspace.terminalCount || 0} terminals</span>
          </div>
        </div>

        {/* Menu button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <MoreHorizontal size={18} className="text-muted-foreground" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div
                className="absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    onEdit();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => {
                    onShare();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Share2 size={14} />
                  Share
                </button>
                {!workspace.isDefault && (
                  <button
                    onClick={() => {
                      onSetDefault();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <Star size={14} />
                    Set as Default
                  </button>
                )}
                {canDelete && (
                  <>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        onDelete();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function MobileWorkspaceList({
  workspaces,
  onOpenWorkspace,
  onCreateWorkspace,
  onEditWorkspace,
  onDeleteWorkspace,
  onShareWorkspace,
  onSetDefault,
  isLoading = false,
}: MobileWorkspaceListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter workspaces by search
  const filteredWorkspaces = workspaces.filter((ws) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ws.name.toLowerCase().includes(query) ||
      ws.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <MobileContentHeader
        title="Workspaces"
        subtitle={`${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`}
        onCreateClick={onCreateWorkspace}
      />

      {/* Search bar */}
      {workspaces.length > 0 && (
        <div className="px-4 py-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workspaces..."
              className="w-full h-10 pl-9 pr-8 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Workspace List */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          // Loading skeleton
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 px-4 flex items-center gap-3 animate-pulse">
                <div className="w-1 h-12 bg-muted rounded-full" />
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
                <div className="w-10 h-10 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : filteredWorkspaces.length === 0 && searchQuery ? (
          // No search results
          <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
            <Search size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No workspaces found</h3>
            <p className="text-muted-foreground text-sm">
              Try a different search term
            </p>
          </div>
        ) : workspaces.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
            <Layers size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No workspaces yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create a workspace to organize your terminals
            </p>
          </div>
        ) : (
          // Workspace cards
          <div className="divide-y divide-border">
            {filteredWorkspaces.map((workspace) => (
              <MobileWorkspaceCard
                key={workspace.id}
                workspace={workspace}
                onOpen={() => onOpenWorkspace(workspace)}
                onEdit={() => onEditWorkspace(workspace)}
                onDelete={() => onDeleteWorkspace(workspace)}
                onShare={() => onShareWorkspace(workspace)}
                onSetDefault={() => onSetDefault(workspace)}
                canDelete={workspaces.length > 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
