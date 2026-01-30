'use client';

import { cn } from '@/lib/utils';
import { Workspace } from '@/lib/api';

interface WorkspaceTabsProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null; // null means "All", undefined means "Independent"
  onSelectWorkspace: (workspaceId: string | null) => void;
}

export function WorkspaceTabs({
  workspaces,
  selectedWorkspaceId,
  onSelectWorkspace,
}: WorkspaceTabsProps) {
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
      {/* All Tasks Tab */}
      <button
        onClick={() => onSelectWorkspace(null)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
          selectedWorkspaceId === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
        )}
      >
        All
      </button>

      {/* Workspace Tabs */}
      {workspaces.map((workspace) => (
        <button
          key={workspace.id}
          onClick={() => onSelectWorkspace(workspace.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
            selectedWorkspaceId === workspace.id
              ? 'text-white'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          )}
          style={{
            backgroundColor:
              selectedWorkspaceId === workspace.id
                ? workspace.color || '#6366f1'
                : undefined,
          }}
        >
          {workspace.icon && <span>{workspace.icon}</span>}
          {workspace.name}
        </button>
      ))}

      {/* Independent Tasks Tab (tasks without workspace) */}
      <button
        onClick={() => onSelectWorkspace('independent')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
          selectedWorkspaceId === 'independent'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
        )}
      >
        Independent
      </button>
    </div>
  );
}
