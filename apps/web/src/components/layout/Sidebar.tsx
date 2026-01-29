'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Terminal,
  Settings,
  LogOut,
  User,
  LayoutDashboard,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function Sidebar({ userName, userEmail, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
    setMounted(true);
  }, []);

  // Save collapsed state to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    }
  }, [isCollapsed, mounted]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const navItems = [
    { href: '/terminals', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/workspace', icon: LayoutGrid, label: 'Workspace' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <aside
      className={cn(
        'hidden md:flex bg-card border-r border-border flex-col relative transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'absolute -right-3 top-6 z-50 w-6 h-6 rounded-full bg-card border border-border',
          'flex items-center justify-center shadow-sm',
          'hover:bg-muted transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
        )}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight size={14} className="text-muted-foreground" />
        ) : (
          <ChevronLeft size={14} className="text-muted-foreground" />
        )}
      </button>

      {/* Logo */}
      <div className={cn(
        'p-4 border-b border-border transition-all duration-300',
        isCollapsed && 'px-3'
      )}>
        <Link href="/terminals" className="flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary flex-shrink-0" />
          <span
            className={cn(
              'font-semibold whitespace-nowrap transition-all duration-300',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            )}
          >
            Claude Terminal
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className={cn(
        'flex-1 p-4 transition-all duration-300',
        isCollapsed && 'px-2'
      )}>
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200',
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  isCollapsed && 'justify-center px-2'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span
                  className={cn(
                    'whitespace-nowrap transition-all duration-300',
                    isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className={cn(
        'p-4 border-t border-border transition-all duration-300',
        isCollapsed && 'px-2'
      )}>
        <div className={cn(
          'flex items-center gap-3 mb-3',
          isCollapsed && 'justify-center'
        )}>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div
            className={cn(
              'flex-1 min-w-0 transition-all duration-300',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            )}
          >
            <p className="text-sm font-medium truncate">
              {userName || userEmail}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {userEmail}
            </p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground',
            'hover:text-foreground hover:bg-muted rounded-md transition-colors',
            isCollapsed && 'justify-center px-2'
          )}
          title={isCollapsed ? 'Sign out' : undefined}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span
            className={cn(
              'whitespace-nowrap transition-all duration-300',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            )}
          >
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
