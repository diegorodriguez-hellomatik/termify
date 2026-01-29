'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Terminal,
  Settings,
  LogOut,
  User,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/lib/actions/auth';

interface MobileNavProps {
  userName?: string | null;
  userEmail?: string | null;
}

export function MobileNav({ userName, userEmail }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: '/terminals', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/workspace', icon: LayoutGrid, label: 'Workspace' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/terminals" className="flex items-center gap-2">
            <Terminal className="h-6 w-6 text-primary" />
            <span className="font-semibold">Claude Terminal</span>
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-0 right-0 w-72 h-full bg-card shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold">Menu</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* User info */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{userName || userEmail}</p>
                  <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="p-4">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                        pathname === item.href
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Sign out */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-inset-bottom">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[64px]',
                pathname === item.href
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
