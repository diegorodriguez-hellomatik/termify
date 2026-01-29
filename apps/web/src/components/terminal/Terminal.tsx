'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalStatus } from '@claude-terminal/shared';
import { useTerminalSocket } from '@/hooks/useTerminalSocket';
import { useTheme } from '@/context/ThemeContext';
import { getXtermTheme, getTerminalTheme } from '@/lib/terminal-themes';
import { Play, Square, RefreshCw, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TerminalThemeSelector } from '@/components/settings/TerminalThemeSelector';
import { cn } from '@/lib/utils';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  terminalId: string;
  token: string;
  initialStatus?: TerminalStatus;
  className?: string;
  onReady?: () => void;
  isActive?: boolean;
}

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
  onReady,
  isActive = true,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<TerminalStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Get theme from context
  const { terminalTheme } = useTheme();
  const currentTheme = getTerminalTheme(terminalTheme);

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

    const xtermTheme = getXtermTheme(terminalTheme);

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      theme: xtermTheme,
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

    // Fit again after container has final dimensions
    setTimeout(() => fitAddon.fit(), 100);
    setTimeout(() => fitAddon.fit(), 500);

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

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (terminalRef.current) {
        resize(terminalRef.current.cols, terminalRef.current.rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    // Cleanup only runs on unmount, not on StrictMode double-invoke
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
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

  // Update theme when terminalTheme changes
  useEffect(() => {
    if (terminalRef.current) {
      const xtermTheme = getXtermTheme(terminalTheme);
      terminalRef.current.options.theme = xtermTheme;
    }
  }, [terminalTheme]);

  // Refit when terminal becomes active (visible)
  useEffect(() => {
    if (isActive && fitAddonRef.current && terminalRef.current) {
      // Small delay to ensure the container is visible and has dimensions
      const timeoutId = setTimeout(() => {
        fitAddonRef.current?.fit();
        if (terminalRef.current) {
          resize(terminalRef.current.cols, terminalRef.current.rows);
        }
        // Focus the terminal when it becomes active
        terminalRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isActive, resize]);

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
    <div className={cn('flex flex-col', className)}>
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
          <TerminalThemeSelector showLabel={false} />

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

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{
          backgroundColor: currentTheme.colors.background,
          minHeight: 0,
        }}
      />
    </div>
  );
}
