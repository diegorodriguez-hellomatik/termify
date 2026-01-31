'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamic import to avoid SSR issues with xterm
const Terminal = dynamic(
  () => import('@/components/terminal/Terminal').then((mod) => mod.Terminal),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface MobileTerminalProps {
  terminalId: string;
  token: string;
  name: string;
  settings?: {
    fontSize?: number | null;
    fontFamily?: string | null;
    theme?: string | null;
  };
  onClose?: () => void;
}

export function MobileTerminal({
  terminalId,
  token,
  name,
  settings,
  onClose,
}: MobileTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-black overflow-hidden"
    >
      <Terminal
        terminalId={terminalId}
        token={token}
        className="h-full w-full"
        hideToolbar
        fontSize={settings?.fontSize ?? 14}
        fontFamily={settings?.fontFamily ?? undefined}
        themeOverride={settings?.theme ?? undefined}
      />
    </div>
  );
}
