import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import {
  Terminal,
  Settings,
  LogOut,
  User,
  LayoutDashboard,
  LayoutGrid,
} from 'lucide-react';
import { MobileNav } from '@/components/layout/MobileNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Navigation */}
      <MobileNav
        userName={session.user?.name}
        userEmail={session.user?.email}
      />

      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <Link href="/terminals" className="flex items-center gap-2">
            <Terminal className="h-6 w-6 text-primary" />
            <span className="font-semibold">Claude Terminal</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <Link
                href="/terminals"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LayoutDashboard className="h-5 w-5" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/workspace"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LayoutGrid className="h-5 w-5" />
                Workspace
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Settings className="h-5 w-5" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session.user?.name || session.user?.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {session.user?.email}
              </p>
            </div>
          </div>
          <form
            action={async () => {
              'use server';
              const { signOut } = await import('@/lib/auth');
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 pb-20 md:pt-0 md:pb-0">{children}</main>
    </div>
  );
}
