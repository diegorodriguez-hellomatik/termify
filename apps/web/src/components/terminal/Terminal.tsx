'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalStatus } from '@claude-terminal/shared';
import { useTerminalSocket } from '@/hooks/useTerminalSocket';
import { Play, Square, RefreshCw, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  terminalId: string;
  token: string;
  initialStatus?: TerminalStatus;
  className?: string;
  defaultTheme?: 'light' | 'dark';
  onReady?: () => void;
}

const DARK_THEME = {
  background: '#1a1b26',
  foreground: '#a9b1d6',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#33467c',
  black: '#32344a',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#ad8ee6',
  cyan: '#449dab',
  white: '#787c99',
  brightBlack: '#444b6a',
  brightRed: '#ff7a93',
  brightGreen: '#b9f27c',
  brightYellow: '#ff9e64',
  brightBlue: '#7da6ff',
  brightMagenta: '#bb9af7',
  brightCyan: '#0db9d7',
  brightWhite: '#acb0d0',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1e1e1e',
  cursor: '#1e1e1e',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  black: '#1e1e1e',
  red: '#cd3131',
  green: '#14ce14',
  yellow: '#b5ba00',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

const STATUS_COLORS: Record<TerminalStatus, string> = {
  [TerminalStatus.STOPPED]: 'bg-gray-500',
  [TerminalStatus.STARTING]: 'bg-yellow-500 animate-pulse',
  [TerminalStatus.RUNNING]: 'bg-green-500',
  [TerminalStatus.CRASHED]: 'bg-red-500',
};

const STATUS_LABELS: Record<TerminalStatus, string> = {
  [TerminalStatus.STOPPED]: 'Stopped',
  [TerminalStatus.STARTING]: 'Starting...',
  [TerminalStatus.RUNNING]: 'Running',
  [TerminalStatus.CRASHED]: 'Crashed',
};

export function Terminal({
  terminalId,
  token,
  initialStatus = TerminalStatus.STOPPED,
  className,
  defaultTheme = 'light',
  onReady,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<TerminalStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(defaultTheme);

  // Callbacks that write directly to terminal
  const handleOutput = useCallback((data: string) => {
    if (terminalRef.current) {
      terminalRef.current.write(data);
    }
  }, []);

  const handleStatusChange = useCallback((newStatus: TerminalStatus) => {
    setStatus(newStatus);
    setError(null);
  }, []);

  const handleConnected = useCallback((bufferedOutput?: string) => {
    if (bufferedOutput && terminalRef.current) {
      terminalRef.current.write(bufferedOutput);
    }
  }, []);

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
  }, []);

  const { isConnected, send, resize, start, stop, connect, disconnect } =
    useTerminalSocket({
      terminalId,
      token,
      onOutput: handleOutput,
      onStatusChange: handleStatusChange,
      onConnected: handleConnected,
      onError: handleError,
    });

  // Track if we've initialized to prevent double-init in StrictMode
  const initializedRef = useRef(false);
  const hasAutoStartedRef = useRef(false);

  // Initialize xterm - same pattern as working test page
  useEffect(() => {
    if (!containerRef.current) return;
    if (initializedRef.current) return; // Prevent double-init in StrictMode
    initializedRef.current = true;

    const currentTheme = theme === 'light' ? LIGHT_THEME : DARK_THEME;

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      theme: currentTheme,
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Open terminal in container
    terminal.open(containerRef.current);
    fitAddon.fit();

    // Store refs
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Show initial message
    terminal.writeln('\x1b[32mTerminal initialized.\x1b[0m');
    terminal.writeln('Connecting...');
    terminal.writeln('');

    setIsReady(true);

    // Handle user input - use ref to avoid stale closure
    terminal.onData((data) => {
      send(data);
    });

    // Connect to WebSocket
    connect();

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
      if (terminalRef.current) {
        resize(terminalRef.current.cols, terminalRef.current.rows);
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup only runs on unmount, not on StrictMode double-invoke
    return () => {
      window.removeEventListener('resize', handleResize);
      // Don't disconnect here - let the hook handle it on unmount
    };
  }, []); // Empty deps - run once on mount

  // Separate cleanup for unmount
  useEffect(() => {
    return () => {
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
      if (fitAddonRef.current) {
        fitAddonRef.current = null;
      }
      disconnect();
      initializedRef.current = false;
    };
  }, [disconnect]);

  // Auto-start terminal when WebSocket connects
  useEffect(() => {
    if (isConnected && isReady && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      // Small delay to ensure connection is fully established
      setTimeout(() => {
        start();
      }, 200);
    }
  }, [isConnected, isReady, start]);

  // Refit when status changes to RUNNING and notify parent
  useEffect(() => {
    if (status === TerminalStatus.RUNNING && fitAddonRef.current && terminalRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        if (terminalRef.current) {
          resize(terminalRef.current.cols, terminalRef.current.rows);
        }
        // Notify parent that terminal is ready
        onReady?.();
      }, 100);
    }
  }, [status, resize, onReady]);

  // Sync theme when defaultTheme prop changes
  useEffect(() => {
    if (terminalRef.current && defaultTheme !== theme) {
      setTheme(defaultTheme);
      terminalRef.current.options.theme = defaultTheme === 'light' ? LIGHT_THEME : DARK_THEME;
    }
  }, [defaultTheme]);

  const handleStart = () => {
    terminalRef.current?.clear();
    terminalRef.current?.writeln('Starting Claude Code...');
    start();
  };

  const handleStop = () => {
    stop();
  };

  const handleReconnect = () => {
    disconnect();
    setTimeout(() => connect(), 500);
  };

  const handleFitTerminal = () => {
    fitAddonRef.current?.fit();
    if (terminalRef.current) {
      resize(terminalRef.current.cols, terminalRef.current.rows);
    }
  };

  return (
    <div className={cn('flex flex-col', className)} style={{ height: '100%' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[status])} />
            <span className="text-sm text-muted-foreground">
              {STATUS_LABELS[status]}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === TerminalStatus.STOPPED || status === TerminalStatus.CRASHED ? (
            <Button size="sm" variant="outline" onClick={handleStart}>
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
          ) : status === TerminalStatus.RUNNING ? (
            <Button size="sm" variant="outline" onClick={handleStop}>
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
          ) : null}

          <Button size="sm" variant="ghost" onClick={handleReconnect}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button size="sm" variant="ghost" onClick={handleFitTerminal}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Terminal container - with explicit height like working test */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: '400px',
          backgroundColor: theme === 'light' ? '#ffffff' : '#1a1b26',
        }}
      />
    </div>
  );
}
