'use client';

import { useState, useRef } from 'react';
import {
  Code,
  Plus,
  Search,
  Keyboard,
  Terminal,
  Maximize,
  Minimize,
  Zap,
  CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SnippetsModal } from '@/components/snippets/SnippetsModal';
import { ProfilesModal } from '@/components/profiles/ProfilesModal';
import { AutoPilotPanel } from '@/components/workspace/AutoPilotPanel';
import { TerminalProfile } from '@/lib/api';
import { useAutoPilot } from '@/hooks/useAutoPilot';

interface QuickActionsToolbarProps {
  token: string;
  onNewTerminal?: () => void;
  onNewTerminalWithProfile?: (profile: TerminalProfile) => void;
  onUseSnippet?: (command: string) => void;
  onOpenQuickSwitcher?: () => void;
  onOpenShortcuts?: () => void;
  onToggleTasks?: () => void;
  tasksOpen?: boolean;
  taskCount?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  className?: string;
}

export function QuickActionsToolbar({
  token,
  onNewTerminal,
  onNewTerminalWithProfile,
  onUseSnippet,
  onOpenQuickSwitcher,
  onOpenShortcuts,
  onToggleTasks,
  tasksOpen = false,
  taskCount = 0,
  isFullscreen = false,
  onToggleFullscreen,
  className,
}: QuickActionsToolbarProps) {
  const [showSnippets, setShowSnippets] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showAutoPilot, setShowAutoPilot] = useState(false);
  const autoPilotButtonRef = useRef<HTMLButtonElement>(null);

  const { enabled: autoPilotEnabled, executingTasks } = useAutoPilot();

  const handleSelectProfile = (profile: TerminalProfile) => {
    onNewTerminalWithProfile?.(profile);
    setShowProfiles(false);
  };

  // Get position for auto-pilot panel
  const getAutoPilotPosition = () => {
    if (!autoPilotButtonRef.current) return { x: 16, y: 60 };
    const rect = autoPilotButtonRef.current.getBoundingClientRect();
    return {
      x: window.innerWidth - rect.right + rect.width,
      y: rect.bottom + 8,
    };
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 p-1 bg-muted/50 rounded-lg',
          className
        )}
      >
        {/* New terminal */}
        <button
          onClick={onNewTerminal}
          className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors"
          title="New Terminal (Ctrl+N)"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New</span>
        </button>

        {/* Profiles */}
        <button
          onClick={() => setShowProfiles(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors"
          title="Terminal Profiles"
        >
          <Terminal size={16} />
          <span className="hidden sm:inline">Profiles</span>
        </button>

        {/* Snippets */}
        <button
          onClick={() => setShowSnippets(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors"
          title="Command Snippets"
        >
          <Code size={16} />
          <span className="hidden sm:inline">Snippets</span>
        </button>

        {/* Tasks */}
        {onToggleTasks && (
          <button
            onClick={onToggleTasks}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors relative',
              tasksOpen
                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                : 'hover:bg-muted'
            )}
            title="Workspace Tasks"
          >
            <CheckSquare size={16} />
            <span className="hidden sm:inline">Tasks</span>
            {taskCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {taskCount > 9 ? '9+' : taskCount}
              </span>
            )}
          </button>
        )}

        <div className="w-px h-5 bg-border mx-1" />

        {/* Auto-Pilot */}
        <button
          ref={autoPilotButtonRef}
          onClick={() => setShowAutoPilot(!showAutoPilot)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors relative',
            autoPilotEnabled
              ? 'bg-primary/20 text-primary hover:bg-primary/30'
              : 'hover:bg-muted'
          )}
          title="Auto-Pilot"
        >
          <Zap size={16} className={autoPilotEnabled ? 'text-primary' : ''} />
          <span className="hidden sm:inline text-sm">Auto-Pilot</span>
          {autoPilotEnabled && executingTasks.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {executingTasks.length}
            </span>
          )}
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Quick switcher */}
        <button
          onClick={onOpenQuickSwitcher}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Quick Switch (Ctrl+K)"
        >
          <Search size={16} />
        </button>

        {/* Keyboard shortcuts */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard size={16} />
        </button>

        {/* Fullscreen toggle */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen (F11)"}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        )}
      </div>

      {/* Modals */}
      <SnippetsModal
        isOpen={showSnippets}
        onClose={() => setShowSnippets(false)}
        token={token}
        onUseSnippet={onUseSnippet}
      />
      <ProfilesModal
        isOpen={showProfiles}
        onClose={() => setShowProfiles(false)}
        token={token}
        onSelectProfile={handleSelectProfile}
      />
      <AutoPilotPanel
        isOpen={showAutoPilot}
        onClose={() => setShowAutoPilot(false)}
        position={getAutoPilotPosition()}
      />
    </>
  );
}
