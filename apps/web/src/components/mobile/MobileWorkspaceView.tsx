'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Terminal,
  X,
  MoreVertical,
  Maximize2,
  Layers,
  ListTodo,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace, Tab } from '@/contexts/WorkspaceContext';
import { MobileTerminal } from './MobileTerminal';
import { Workspace } from '@/lib/api';

interface MobileWorkspaceViewProps {
  token: string;
  currentWorkspace: Workspace | null;
  onBackToList: () => void;
  onOpenQuickSwitcher: () => void;
  onCreateTerminal: () => void;
  onToggleTasks?: () => void;
  tasksOpen?: boolean;
  taskCount?: number;
}

export function MobileWorkspaceView({
  token,
  currentWorkspace,
  onBackToList,
  onOpenQuickSwitcher,
  onCreateTerminal,
  onToggleTasks,
  tasksOpen,
  taskCount = 0,
}: MobileWorkspaceViewProps) {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    getTerminalSettings,
  } = useWorkspace();

  const [showTabMenu, setShowTabMenu] = useState<string | null>(null);

  // Get terminal tabs only
  const terminalTabs = tabs.filter(
    (tab): tab is Tab & { terminalId: string } =>
      tab.type === 'terminal' && !!tab.terminalId
  );

  // Get active terminal
  const activeTab = terminalTabs.find((t) => t.id === activeTabId) || terminalTabs[0];

  // Handle swipe gestures for tab switching
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (terminalTabs.length > 1) {
      const currentIndex = terminalTabs.findIndex((t) => t.id === activeTab?.id);
      if (isLeftSwipe && currentIndex < terminalTabs.length - 1) {
        // Swipe left -> next tab
        setActiveTab(terminalTabs[currentIndex + 1].id);
      } else if (isRightSwipe && currentIndex > 0) {
        // Swipe right -> previous tab
        setActiveTab(terminalTabs[currentIndex - 1].id);
      }
    }
  };

  const getWorkspaceColor = () => currentWorkspace?.color || '#6366f1';

  // Empty state when no terminals
  if (terminalTabs.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
          <button
            onClick={onBackToList}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: getWorkspaceColor() + '20' }}
          >
            <Layers size={16} style={{ color: getWorkspaceColor() }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">
              {currentWorkspace?.name || 'Workspace'}
            </h1>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
            <Terminal size={40} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No terminals open</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Open a terminal to get started working in this workspace
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={onOpenQuickSwitcher}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              <Terminal size={18} />
              Open Existing Terminal
            </button>
            <button
              onClick={onCreateTerminal}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus size={18} />
              Create New Terminal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
        <button
          onClick={onBackToList}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} className="text-muted-foreground" />
        </button>

        {/* Tab indicator */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: getWorkspaceColor() + '20' }}
          >
            <Terminal size={12} style={{ color: getWorkspaceColor() }} />
          </div>
          <span className="font-medium text-sm truncate">{activeTab?.name}</span>
          {terminalTabs.length > 1 && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {terminalTabs.findIndex((t) => t.id === activeTab?.id) + 1}/{terminalTabs.length}
            </span>
          )}
        </div>

        {/* Actions */}
        {onToggleTasks && (
          <button
            onClick={onToggleTasks}
            className={cn(
              'p-2 rounded-lg transition-colors relative',
              tasksOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <ListTodo size={18} />
            {taskCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {taskCount > 9 ? '9+' : taskCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={onOpenQuickSwitcher}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Plus size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Terminal content */}
      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {activeTab && (
          <MobileTerminal
            key={activeTab.id}
            terminalId={activeTab.terminalId}
            token={token}
            name={activeTab.name}
            settings={getTerminalSettings(activeTab.terminalId)}
            onClose={() => closeTab(activeTab.id)}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      {terminalTabs.length > 1 && (
        <div className="border-t border-border bg-background safe-area-inset-bottom">
          <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto">
            {terminalTabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg min-w-[80px] max-w-[140px] transition-colors',
                  tab.id === activeTab?.id
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <Terminal size={14} className="flex-shrink-0" />
                <span className="text-xs font-medium truncate">{tab.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-destructive/20 transition-colors flex-shrink-0 ml-auto"
                >
                  <X size={10} className="text-muted-foreground hover:text-destructive" />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Swipe hint for new users */}
      {terminalTabs.length > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none">
          <p className="text-[10px] text-muted-foreground/50 bg-background/80 px-2 py-0.5 rounded">
            Swipe left/right to switch tabs
          </p>
        </div>
      )}
    </div>
  );
}
