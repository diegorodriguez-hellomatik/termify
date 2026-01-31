'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/context/ThemeContext';
import { ThemeWrapper } from '@/components/ThemeWrapper';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ThemeWrapper>
          {children}
          <Toaster />
        </ThemeWrapper>
      </ThemeProvider>
    </SessionProvider>
  );
}
