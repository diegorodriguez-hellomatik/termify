'use client';

import {
  Folder,
  Briefcase,
  Wrench,
  Rocket,
  Home,
  Settings,
  Laptop,
  Globe,
  Star,
  Flame,
  Lightbulb,
  Code,
  Database,
  Server,
  Cloud,
  Terminal,
  Box,
  Zap,
  Shield,
  Lock,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Workspace } from '@/lib/api';

// Icon mapping for workspaces (same as workspace/page.tsx)
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
  if (!iconName) return null;
  return WORKSPACE_ICONS[iconName.toLowerCase()] || null;
};

interface WorkspaceTabsProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
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
            ? 'bg-foreground text-background'
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
          {(() => {
            const IconComp = getWorkspaceIcon(workspace.icon);
            return IconComp ? <IconComp size={16} /> : null;
          })()}
          {workspace.name}
        </button>
      ))}

      {/* Independent Tasks Tab */}
      <button
        onClick={() => onSelectWorkspace('independent')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
          selectedWorkspaceId === 'independent'
            ? 'bg-foreground text-background'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
        )}
      >
        Independent
      </button>
    </div>
  );
}
