'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/context/ThemeContext';
import { ThemeWrapper } from '@/components/ThemeWrapper';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ThemeWrapper>
          {children}
        </ThemeWrapper>
      </ThemeProvider>
    </SessionProvider>
  );
}
