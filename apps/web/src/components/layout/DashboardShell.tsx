'use client';

import { signOut } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
}

function DashboardContent({ children, userName, userEmail, userImage }: DashboardShellProps) {
  const { isFullscreen } = useWorkspace();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Navigation - hidden in fullscreen */}
      {!isFullscreen && (
        <MobileNav userName={userName} userEmail={userEmail} userImage={userImage} />
      )}

      {/* Desktop Sidebar - hidden in fullscreen */}
      {!isFullscreen && (
        <Sidebar
          userName={userName}
          userEmail={userEmail}
          userImage={userImage}
          onSignOut={handleSignOut}
        />
      )}

      {/* Main content */}
      <main className={cn(
        "flex-1 flex flex-col md:h-screen overflow-auto",
        isFullscreen ? "pt-0 pb-0" : "pt-10 pb-16 md:pt-0 md:pb-0"
      )}>
        {children}
      </main>
    </div>
  );
}

export function DashboardShell({ children, userName, userEmail, userImage }: DashboardShellProps) {
  return (
    <WorkspaceProvider>
      <DashboardContent userName={userName} userEmail={userEmail} userImage={userImage}>
        {children}
      </DashboardContent>
    </WorkspaceProvider>
  );
}
