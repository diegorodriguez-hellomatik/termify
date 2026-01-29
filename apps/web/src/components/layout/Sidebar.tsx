'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  Terminal,
  Settings,
  LogOut,
  User,
  LayoutDashboard,
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
  PanelLeft,
  FolderTree,
  Menu,
  Search,
  GitBranch,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileExplorer } from '@/components/files/FileExplorer';
import { TasksPanel } from '@/components/tasks/TasksPanel';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
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

export function Sidebar({ userName, userEmail, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<string>('explorer');

  // Detect if we're on a terminal detail page
  const isTerminalView = pathname?.startsWith('/terminals/') && pathname !== '/terminals';
  const terminalId = isTerminalView ? (params?.id as string) : null;

  // Auto-expand settings when on settings page
  useEffect(() => {
    if (pathname === '/settings') {
      setSettingsExpanded(true);
    }
  }, [pathname]);

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

  // Save state to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, String(isHidden));
      localStorage.setItem(ACTIVE_PANEL_KEY, activePanel);
    }
  }, [isCollapsed, isHidden, activePanel, mounted]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const navItems = [
    { href: '/terminals', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/workspace', icon: LayoutGrid, label: 'Workspace' },
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
    { id: 'explorer', icon: Files, label: 'Explorer' },
    ...(isTerminalView ? [
      { id: 'files', icon: FolderTree, label: 'Files' },
      { id: 'tasks', icon: ListTodo, label: 'Tasks' },
    ] : []),
    { id: 'search', icon: Search, label: 'Search', disabled: true },
    { id: 'git', icon: GitBranch, label: 'Source Control', disabled: true },
  ];

  // Minimal sidebar for non-terminal views
  if (!isTerminalView) {
    return (
      <div className="hidden md:flex sticky top-0 h-screen relative">
        {/* Activity Bar */}
        <div
          className={cn(
            'bg-card border-r border-border flex flex-col items-center py-2 transition-all duration-300 ease-in-out overflow-hidden',
            isHidden ? 'w-0 border-r-0' : 'w-12'
          )}
        >
          {/* Logo */}
          <Link href="/terminals" className="mb-4 p-2 hover:bg-muted rounded-md transition-colors">
            <Terminal className="h-5 w-5 text-primary" />
          </Link>

          {/* Navigation Icons */}
          <div className="flex-1 flex flex-col items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'w-10 h-10 flex items-center justify-center rounded-md transition-colors relative',
                  isActive(item.href)
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title={item.label}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            ))}
          </div>

          {/* Bottom icons */}
          <div className="flex flex-col items-center gap-1">
            <NotificationsDropdown />
            <button
              onClick={() => setIsHidden(true)}
              className="w-10 h-10 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Hide sidebar"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
            <button
              onClick={onSignOut}
              className="w-10 h-10 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Show sidebar button when hidden */}
        {isHidden && (
          <button
            onClick={() => setIsHidden(false)}
            className="absolute left-2 top-2 p-2 bg-card border border-border rounded-md hover:bg-muted transition-colors shadow-sm z-10"
            title="Show sidebar"
          >
            <PanelLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="hidden md:flex sticky top-0 h-screen">
      {/* Activity Bar (VS Code style) */}
      <div className="w-12 bg-card border-r border-border flex flex-col items-center py-2">
        {/* Logo */}
        <Link href="/terminals" className="mb-4 p-2 hover:bg-muted rounded-md transition-colors">
          <Terminal className="h-5 w-5 text-primary" />
        </Link>

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
          'bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out overflow-hidden',
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
                  {settingsExpanded && (
                    <ul className="mt-1 ml-4 pl-3 border-l border-border space-y-0.5">
                      {settingsSubItems.map((subItem) => (
                        <li key={subItem.id}>
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
                  )}
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
      </aside>

    </div>
  );
}
