'use client';

import { signOut } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface DashboardShellProps {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
}

export function DashboardShell({ children, userName, userEmail }: DashboardShellProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Navigation */}
      <MobileNav userName={userName} userEmail={userEmail} />

      {/* Desktop Sidebar */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 pb-20 md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  );
}
