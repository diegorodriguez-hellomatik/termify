'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/context/ThemeContext';
import { ServerStatsProvider } from '@/context/ServerStatsContext';
import { GlobalChatProvider } from '@/contexts/GlobalChatContext';
import { ThemeWrapper } from '@/components/ThemeWrapper';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ServerStatsProvider>
          <GlobalChatProvider>
            <ThemeWrapper>
              {children}
              <Toaster />
            </ThemeWrapper>
          </GlobalChatProvider>
        </ServerStatsProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
