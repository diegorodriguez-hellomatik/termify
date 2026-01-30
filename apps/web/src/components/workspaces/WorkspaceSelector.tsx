'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  Settings2,
  Check,
  Layers,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Workspace } from '@/lib/api';

interface WorkspaceSelectorProps {
  isExpanded?: boolean;
  onManageWorkspaces?: () => void;
  onCreateWorkspace?: () => void;
}

export function WorkspaceSelector({
  isExpanded = true,
  onManageWorkspaces,
  onCreateWorkspace,
}: WorkspaceSelectorProps) {
  const {
    workspaces,
    currentWorkspace,
    currentWorkspaceId,
    loadingWorkspaces,
    switchWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle workspace selection
  const handleSelectWorkspace = async (workspace: Workspace) => {
    await switchWorkspace(workspace.id);
    setIsOpen(false);
  };

  // Get workspace display color
  const getWorkspaceColor = (workspace: Workspace | null) => {
    return workspace?.color || '#6366f1';
  };

  // Get workspace icon
  const getWorkspaceIcon = (workspace: Workspace | null) => {
    if (workspace?.icon) {
      return <span className="text-sm">{workspace.icon}</span>;
    }
    return <Layers className="h-4 w-4" />;
  };

  if (loadingWorkspaces) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 animate-pulse',
          isExpanded ? 'mx-2' : 'mx-auto w-10 h-10 justify-center'
        )}
      >
        {isExpanded && <div className="w-4 h-4 bg-muted rounded" />}
        {isExpanded && <div className="flex-1 h-4 bg-muted rounded" />}
      </div>
    );
  }

  if (!isExpanded) {
    // Collapsed view - just show icon with dropdown
    return (
      <div ref={dropdownRef} className="relative mx-auto">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-md transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted',
            isOpen && 'bg-muted text-foreground'
          )}
          title={currentWorkspace?.name || 'Select workspace'}
        >
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: getWorkspaceColor(currentWorkspace) + '20' }}
          >
            <div style={{ color: getWorkspaceColor(currentWorkspace) }}>
              {getWorkspaceIcon(currentWorkspace)}
            </div>
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute left-full top-0 ml-2 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Workspaces
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleSelectWorkspace(workspace)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                    workspace.id === currentWorkspaceId
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: getWorkspaceColor(workspace) + '20' }}
                  >
                    <div style={{ color: getWorkspaceColor(workspace) }}>
                      {getWorkspaceIcon(workspace)}
                    </div>
                  </div>
                  <span className="flex-1 text-left truncate">{workspace.name}</span>
                  {workspace.id === currentWorkspaceId && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                  {workspace.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      default
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-border pt-1">
              {onCreateWorkspace && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onCreateWorkspace();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create workspace</span>
                </button>
              )}
              {onManageWorkspaces && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onManageWorkspaces();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Settings2 className="h-4 w-4" />
                  <span>Manage workspaces</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expanded view
  return (
    <div ref={dropdownRef} className="relative mx-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors',
          'text-foreground hover:bg-muted',
          isOpen && 'bg-muted'
        )}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: getWorkspaceColor(currentWorkspace) + '20' }}
        >
          <div style={{ color: getWorkspaceColor(currentWorkspace) }}>
            {getWorkspaceIcon(currentWorkspace)}
          </div>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium truncate">
            {currentWorkspace?.name || 'Select workspace'}
          </p>
          {currentWorkspace && (
            <p className="text-xs text-muted-foreground">
              {currentWorkspace.terminalCount || 0} terminal{(currentWorkspace.terminalCount || 0) !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Workspaces
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleSelectWorkspace(workspace)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                  workspace.id === currentWorkspaceId
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: getWorkspaceColor(workspace) + '20' }}
                >
                  <div style={{ color: getWorkspaceColor(workspace) }}>
                    {getWorkspaceIcon(workspace)}
                  </div>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium truncate">{workspace.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {workspace.terminalCount || 0} terminal{(workspace.terminalCount || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                {workspace.id === currentWorkspaceId && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                {workspace.isDefault && workspace.id !== currentWorkspaceId && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                    default
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-border pt-1">
            {onCreateWorkspace && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onCreateWorkspace();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create workspace</span>
              </button>
            )}
            {onManageWorkspaces && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onManageWorkspaces();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Settings2 className="h-4 w-4" />
                <span>Manage workspaces</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
