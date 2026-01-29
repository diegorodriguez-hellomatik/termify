'use client';

import { useState } from 'react';
import {
  Code,
  Settings2,
  Plus,
  Search,
  Keyboard,
  Palette,
  History,
  Upload,
  Download,
  Terminal,
  SplitSquareHorizontal,
  SplitSquareVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SnippetsModal } from '@/components/snippets/SnippetsModal';
import { ProfilesModal } from '@/components/profiles/ProfilesModal';
import { TerminalProfile } from '@/lib/api';

interface QuickActionsToolbarProps {
  token: string;
  onNewTerminal?: () => void;
  onNewTerminalWithProfile?: (profile: TerminalProfile) => void;
  onUseSnippet?: (command: string) => void;
  onOpenQuickSwitcher?: () => void;
  onOpenShortcuts?: () => void;
  onOpenThemes?: () => void;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  className?: string;
}

export function QuickActionsToolbar({
  token,
  onNewTerminal,
  onNewTerminalWithProfile,
  onUseSnippet,
  onOpenQuickSwitcher,
  onOpenShortcuts,
  onOpenThemes,
  onSplitHorizontal,
  onSplitVertical,
  className,
}: QuickActionsToolbarProps) {
  const [showSnippets, setShowSnippets] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);

  const handleSelectProfile = (profile: TerminalProfile) => {
    onNewTerminalWithProfile?.(profile);
    setShowProfiles(false);
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

        <div className="w-px h-5 bg-border mx-1" />

        {/* Split controls */}
        <button
          onClick={onSplitHorizontal}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Split Horizontal"
        >
          <SplitSquareHorizontal size={16} />
        </button>
        <button
          onClick={onSplitVertical}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Split Vertical"
        >
          <SplitSquareVertical size={16} />
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

        {/* Themes */}
        <button
          onClick={onOpenThemes}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Terminal Theme"
        >
          <Palette size={16} />
        </button>

        {/* Keyboard shortcuts */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard size={16} />
        </button>
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
    </>
  );
}
