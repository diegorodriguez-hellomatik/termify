'use client';

import { signOut } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';

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
    <WorkspaceProvider>
      <div className="h-screen flex flex-col md:flex-row overflow-hidden">
        {/* Mobile Navigation */}
        <MobileNav userName={userName} userEmail={userEmail} />

        {/* Desktop Sidebar - Sticky */}
        <Sidebar
          userName={userName}
          userEmail={userEmail}
          onSignOut={handleSignOut}
        />

        {/* Main content */}
        <main className="flex-1 flex flex-col pt-14 pb-20 md:pt-0 md:pb-0 md:h-screen">
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  );
}
