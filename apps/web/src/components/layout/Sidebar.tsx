'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  Terminal,
  Settings,
  LogOut,
  User,
  LayoutGrid,
  ChevronDown,
  Palette,
  Keyboard,
  Bell,
  FileJson,
  Key,
  MonitorCog,
  Files,
  PanelLeftClose,
  FolderTree,
  Search,
  GitBranch,
  ListTodo,
  Users,
  GripVertical,
  CheckSquare,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileExplorer } from '@/components/files/FileExplorer';
import { TasksPanel } from '@/components/tasks/TasksPanel';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import { TermifyLogo } from '@/components/ui/TermifyLogo';

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  onSignOut: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';
const SIDEBAR_HIDDEN_KEY = 'sidebar-hidden';
const ACTIVE_PANEL_KEY = 'sidebar-active-panel';

// Settings sub-sections for anchor navigation
const settingsSubItems = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'terminal-theme', label: 'Terminal Theme', icon: Palette },
  { id: 'view-mode', label: 'View Mode', icon: LayoutGrid },
  { id: 'terminal-defaults', label: 'Defaults', icon: MonitorCog },
  { id: 'keyboard-shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'import-export', label: 'Import/Export', icon: FileJson },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export function Sidebar({ userName, userEmail, userImage, onSignOut }: SidebarProps) {
  // Get initials for avatar fallback
  const userInitials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : userEmail?.[0]?.toUpperCase() || 'U';
  const pathname = usePathname();
  const params = useParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<string>('explorer');

  // Track workspace mode to prevent saving temporary state
  const isInWorkspaceMode = useRef(false);
  const previousHiddenState = useRef<boolean | null>(null);

  // Detect if we're on a terminal detail page
  const isTerminalView = pathname?.startsWith('/terminals/') && pathname !== '/terminals';
  const terminalId = isTerminalView ? (params?.id as string) : null;

  // Auto-expand settings when on settings page
  useEffect(() => {
    if (pathname === '/settings') {
      setSettingsExpanded(true);
    }
  }, [pathname]);

  // Handle sidebar state when entering/leaving workspaces
  useEffect(() => {
    const isInWorkspace = pathname?.startsWith('/workspace/') && pathname !== '/workspace';

    if (isInWorkspace && !isInWorkspaceMode.current) {
      // Entering workspace - save current state and collapse
      previousHiddenState.current = isHidden;
      isInWorkspaceMode.current = true;
      setIsHidden(true);
    } else if (!isInWorkspace && isInWorkspaceMode.current) {
      // Leaving workspace - restore previous state
      isInWorkspaceMode.current = false;
      if (previousHiddenState.current !== null) {
        setIsHidden(previousHiddenState.current);
        previousHiddenState.current = null;
      }
    }
  }, [pathname, isHidden]);

  // Switch to files panel when on terminal view
  useEffect(() => {
    if (isTerminalView && activePanel !== 'files') {
      setActivePanel('files');
      setIsCollapsed(false);
    }
  }, [isTerminalView]);

  // Load state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    const savedHidden = localStorage.getItem(SIDEBAR_HIDDEN_KEY);
    const savedPanel = localStorage.getItem(ACTIVE_PANEL_KEY);
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true');
    }
    if (savedHidden !== null) {
      setIsHidden(savedHidden === 'true');
    }
    if (savedPanel !== null && !isTerminalView) {
      setActivePanel(savedPanel);
    }
    setMounted(true);
  }, []);

  // Save state to localStorage (but not when in workspace mode - that's temporary)
  useEffect(() => {
    if (mounted && !isInWorkspaceMode.current) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, String(isHidden));
      localStorage.setItem(ACTIVE_PANEL_KEY, activePanel);
    }
  }, [isCollapsed, isHidden, activePanel, mounted]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const navItems = [
    { href: '/terminals', icon: Terminal, label: 'Terminals' },
    { href: '/servers', icon: Server, label: 'Servers' },
    { href: '/workspace', icon: LayoutGrid, label: 'Workspace' },
    { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { href: '/teams', icon: Users, label: 'Teams' },
    { href: '/api-keys', icon: Key, label: 'API Keys' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');
  const isSettingsActive = pathname === '/settings';

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Activity bar items (VS Code style icons on the left)
  const activityItems = [
    // Explorer is now handled by the Terminal logo icon
    ...(isTerminalView ? [
      { id: 'files', icon: FolderTree, label: 'Files' },
      { id: 'tasks', icon: ListTodo, label: 'Tasks' },
    ] : []),
    { id: 'search', icon: Search, label: 'Search', disabled: true },
    { id: 'git', icon: GitBranch, label: 'Source Control', disabled: true },
  ];

  // Minimal sidebar for non-terminal views
  if (!isTerminalView) {
    const isExpanded = !isHidden; // Reuse isHidden as "collapsed" state

    return (
      <div className="hidden md:flex sticky top-0 h-screen" data-sidebar>
        {/* Sidebar */}
        <div
          className={cn(
            'bg-card border-r border-border flex flex-col py-3 transition-all duration-300 ease-in-out overflow-hidden relative',
            isExpanded ? 'w-52' : 'w-16'
          )}
        >
          {/* Logo */}
          <Link
            href="/terminals"
            className={cn(
              'mb-4 p-2 hover:bg-muted rounded-md transition-colors flex items-center gap-3',
              isExpanded ? 'mx-2' : 'mx-auto'
            )}
          >
            <TermifyLogo size={20} className="text-foreground" />
            {isExpanded && <span className="font-semibold text-sm">Termify</span>}
          </Link>

          {/* Navigation Items */}
          <div className="flex-1 flex flex-col gap-1 px-2">
            {navItems.filter(item => item.href !== '/settings').map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md transition-colors',
                  isExpanded ? 'px-3 py-2.5' : 'w-12 h-12 justify-center mx-auto',
                  isActive(item.href)
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title={!isExpanded ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {isExpanded && <span className="text-sm">{item.label}</span>}
              </Link>
            ))}

            {/* Settings with expandable sub-items */}
            {isExpanded ? (
              <div>
                <Link
                  href="/settings"
                  onClick={() => setSettingsExpanded(true)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors',
                    isSettingsActive
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Settings className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm flex-1 text-left">Settings</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      settingsExpanded && 'rotate-180'
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSettingsExpanded(!settingsExpanded);
                    }}
                  />
                </Link>

                {/* Settings Sub-items */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200 ease-in-out',
                    settingsExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <ul className="mt-1 ml-4 pl-3 border-l border-border space-y-0.5">
                    {settingsSubItems.map((subItem, index) => (
                      <li
                        key={subItem.id}
                        className={cn(
                          'transition-all duration-200',
                          settingsExpanded ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
                        )}
                        style={{ transitionDelay: settingsExpanded ? `${index * 30}ms` : '0ms' }}
                      >
                        <Link
                          href={`/settings#${subItem.id}`}
                          onClick={(e) => {
                            if (pathname === '/settings') {
                              e.preventDefault();
                              scrollToSection(subItem.id);
                            }
                          }}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors',
                            'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          )}
                        >
                          <subItem.icon className="h-3.5 w-3.5" />
                          <span>{subItem.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <Link
                href="/settings"
                className={cn(
                  'flex items-center gap-3 rounded-md transition-colors w-12 h-12 justify-center mx-auto',
                  isSettingsActive
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Settings"
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
              </Link>
            )}
          </div>

          {/* Bottom items */}
          <div className="flex flex-col gap-1 px-2">
            {/* User Profile - Clickable to Settings */}
            <Link
              href="/settings#profile"
              className={cn(
                'flex items-center gap-3 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted',
                isExpanded ? 'px-3 py-2.5' : 'w-12 h-12 justify-center mx-auto'
              )}
              title={!isExpanded ? `${userName || userEmail}` : undefined}
            >
              {/* Avatar */}
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center">
                {userImage ? (
                  <img
                    src={userImage}
                    alt={userName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-medium text-primary">{userInitials}</span>
                )}
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{userName || 'User'}</p>
                </div>
              )}
            </Link>

            {/* Notifications */}
            <div className={cn(isExpanded ? '' : 'mx-auto')}>
              <NotificationsDropdown showLabel={isExpanded} />
            </div>

            {/* Sign out */}
            <button
              onClick={onSignOut}
              className={cn(
                'flex items-center gap-3 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted',
                isExpanded ? 'px-3 py-2.5' : 'w-12 h-12 justify-center mx-auto'
              )}
              title={!isExpanded ? 'Sign out' : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {isExpanded && <span className="text-sm">Sign out</span>}
            </button>
          </div>

          {/* Edge collapse handle */}
          <button
            onClick={() => setIsHidden(!isHidden)}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -right-1.5 z-10 flex items-center justify-center',
              'w-3 h-16 rounded-md',
              'bg-border/60 hover:bg-muted-foreground/30 transition-all duration-200',
              'hover:w-4 hover:h-20'
            )}
            title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:flex sticky top-0 h-screen" data-sidebar>
      {/* Activity Bar (VS Code style) */}
      <div className="w-12 bg-card border-r border-border flex flex-col items-center py-2">
        {/* Logo - toggles Explorer panel */}
        <button
          onClick={() => {
            if (activePanel === 'explorer' && !isCollapsed) {
              setIsCollapsed(true);
            } else {
              setActivePanel('explorer');
              setIsCollapsed(false);
            }
          }}
          className={cn(
            'mb-4 p-2 rounded-md transition-colors relative',
            activePanel === 'explorer' && !isCollapsed
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title="Explorer"
        >
          <TermifyLogo size={20} />
          {activePanel === 'explorer' && !isCollapsed && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r" />
          )}
        </button>

        {/* Activity Icons */}
        <div className="flex-1 flex flex-col items-center gap-1">
          {activityItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.disabled) return;
                if (activePanel === item.id && !isCollapsed) {
                  setIsCollapsed(true);
                } else {
                  setActivePanel(item.id);
                  setIsCollapsed(false);
                }
              }}
              className={cn(
                'w-10 h-10 flex items-center justify-center rounded-md transition-colors relative',
                activePanel === item.id && !isCollapsed
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
                !item.disabled && 'hover:bg-muted',
                item.disabled && 'opacity-40 cursor-not-allowed'
              )}
              title={item.label}
              disabled={item.disabled}
            >
              <item.icon className="h-5 w-5" />
              {activePanel === item.id && !isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r" />
              )}
            </button>
          ))}
        </div>

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-1">
          <NotificationsDropdown />
          <Link
            href="/settings"
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-md transition-colors',
              isSettingsActive
                ? 'text-foreground bg-muted'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <button
            onClick={onSignOut}
            className="w-10 h-10 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Side Panel */}
      <aside
        className={cn(
          'bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out overflow-hidden relative',
          isCollapsed ? 'w-0' : 'w-64'
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border min-w-[256px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {activePanel === 'explorer' ? 'Explorer' :
             activePanel === 'files' ? 'Files' :
             activePanel === 'tasks' ? 'Tasks' : activePanel}
          </span>
          <button
            onClick={toggleSidebar}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Close panel"
          >
            <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto min-w-[256px]">
          {activePanel === 'explorer' && (
            <nav className="p-2">
              <ul className="space-y-0.5">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm',
                        isActive(item.href)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}

                {/* Settings with expandable sub-items */}
                <li>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm',
                      isSettingsActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    onClick={() => setSettingsExpanded(!settingsExpanded)}
                  >
                    <Settings className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">Settings</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform duration-200',
                        settingsExpanded && 'rotate-180'
                      )}
                    />
                  </div>

                  {/* Settings Sub-items */}
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-200 ease-in-out',
                      settingsExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    )}
                  >
                    <ul className="mt-1 ml-4 pl-3 border-l border-border space-y-0.5">
                      {settingsSubItems.map((subItem, index) => (
                        <li
                          key={subItem.id}
                          className={cn(
                            'transition-all duration-200',
                            settingsExpanded ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
                          )}
                          style={{ transitionDelay: settingsExpanded ? `${index * 30}ms` : '0ms' }}
                        >
                          <Link
                            href={`/settings#${subItem.id}`}
                            onClick={(e) => {
                              if (pathname === '/settings') {
                                e.preventDefault();
                                scrollToSection(subItem.id);
                              }
                            }}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors',
                              'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            )}
                          >
                            <subItem.icon className="h-3.5 w-3.5" />
                            <span>{subItem.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              </ul>
            </nav>
          )}

          {activePanel === 'files' && terminalId && (
            <FileExplorer
              terminalId={terminalId}
              className="h-full"
              onFileSelect={(file) => {
                console.log('File selected:', file);
              }}
            />
          )}

          {activePanel === 'tasks' && terminalId && (
            <TasksPanel
              terminalId={terminalId}
              className="h-full"
            />
          )}

          {activePanel === 'search' && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Search coming soon
            </div>
          )}

          {activePanel === 'git' && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Source control coming soon
            </div>
          )}
        </div>

        {/* User section */}
        <div className="p-3 border-t border-border min-w-[256px]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {userName || userEmail}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
            </div>
          </div>
        </div>

        {/* Edge collapse handle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -right-1.5 z-10 flex items-center justify-center',
            'w-3 h-16 rounded-md',
            'bg-border/60 hover:bg-muted-foreground/30 transition-all duration-200',
            'hover:w-4 hover:h-20',
            isCollapsed && 'hidden'
          )}
          title="Collapse panel"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </aside>
    </div>
  );
}
