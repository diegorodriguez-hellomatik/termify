'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import { Workspace } from '@/lib/api';

interface WorkspaceTabsProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string | null) => void;
}

interface TabIndicator {
  left: number;
  width: number;
}

export function WorkspaceTabs({
  workspaces,
  selectedWorkspaceId,
  onSelectWorkspace,
}: WorkspaceTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<TabIndicator>({ left: 0, width: 0 });
  const [isReady, setIsReady] = useState(false);

  // Get the key for the currently selected tab
  const getSelectedKey = () => {
    if (selectedWorkspaceId === null) return 'all';
    if (selectedWorkspaceId === 'independent') return 'independent';
    return selectedWorkspaceId;
  };

  // Get the color for the indicator
  const getIndicatorColor = () => {
    if (selectedWorkspaceId === null || selectedWorkspaceId === 'independent') {
      return 'hsl(var(--primary))';
    }
    const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
    return workspace?.color || '#6366f1';
  };

  // Update indicator position
  useLayoutEffect(() => {
    const updateIndicator = () => {
      if (!containerRef.current) return;

      const selectedKey = getSelectedKey();
      const selectedButton = containerRef.current.querySelector(
        `[data-tab-key="${selectedKey}"]`
      ) as HTMLButtonElement;

      if (selectedButton) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const buttonRect = selectedButton.getBoundingClientRect();

        setIndicator({
          left: buttonRect.left - containerRect.left + containerRef.current.scrollLeft,
          width: buttonRect.width,
        });
        setIsReady(true);
      }
    };

    updateIndicator();

    // Also update on window resize
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [selectedWorkspaceId, workspaces]);

  return (
    <div className="relative mb-6">
      <div
        ref={containerRef}
        className="flex items-center gap-1 overflow-x-auto pb-2 relative"
      >
        {/* Sliding indicator */}
        <div
          className={cn(
            'absolute top-0 h-[calc(100%-8px)] rounded-lg transition-all duration-300 ease-out z-0',
            !isReady && 'opacity-0'
          )}
          style={{
            left: indicator.left,
            width: indicator.width,
            backgroundColor: getIndicatorColor(),
          }}
        />

        {/* All Tasks Tab */}
        <button
          data-tab-key="all"
          onClick={() => onSelectWorkspace(null)}
          className={cn(
            'relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 whitespace-nowrap',
            selectedWorkspaceId === null
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>

        {/* Workspace Tabs */}
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            data-tab-key={workspace.id}
            onClick={() => onSelectWorkspace(workspace.id)}
            className={cn(
              'relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 whitespace-nowrap',
              selectedWorkspaceId === workspace.id
                ? 'text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {workspace.icon && <span>{workspace.icon}</span>}
            {workspace.name}
          </button>
        ))}

        {/* Independent Tasks Tab */}
        <button
          data-tab-key="independent"
          onClick={() => onSelectWorkspace('independent')}
          className={cn(
            'relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 whitespace-nowrap',
            selectedWorkspaceId === 'independent'
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Independent
        </button>
      </div>
    </div>
  );
}
